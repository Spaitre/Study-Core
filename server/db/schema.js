// Conexión SQLite + esquema + migraciones.
//
// Este módulo es el ÚNICO lugar que conoce el detalle de SQLite a nivel de
// esquema/DDL. La conexión cruda (`db`, síncrona) se expone solo para el
// adaptador de datos (`./sqlite.js`) y para código aún sin migrar; los
// repositorios y servicios deben usar la interfaz async de `./index.js`.
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Ruta de datos configurable para producción (disco persistente del hosting).
// En desarrollo usa data/ del repo (server/db -> ../../data). Se puede fijar
// DATA_DIR (carpeta) o DB_PATH (archivo) por variable de entorno.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '..', '..', 'data')
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(DATA_DIR, 'cerebro.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

// Integridad referencial + concurrencia razonable.
db.exec('PRAGMA foreign_keys = ON;')
db.exec('PRAGMA journal_mode = WAL;')
// Espera ante un bloqueo en vez de fallar con SQLITE_BUSY (varias peticiones).
db.exec('PRAGMA busy_timeout = 5000;')
// NORMAL es seguro con WAL y más rápido que FULL.
db.exec('PRAGMA synchronous = NORMAL;')

// Esquema. Todo el contenido de estudio y el historial viven aquí; el JSON
// solo es formato de importación/exportación.
db.exec(`
  CREATE TABLE IF NOT EXISTS materias (
    id     TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    icono  TEXT
  );

  CREATE TABLE IF NOT EXISTS temas (
    id         TEXT PRIMARY KEY,
    materia_id TEXT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    nombre     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preguntas (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    tema_id            TEXT NOT NULL REFERENCES temas(id) ON DELETE CASCADE,
    pregunta           TEXT NOT NULL,
    opciones           TEXT NOT NULL,          -- JSON array de strings
    respuesta_correcta INTEGER NOT NULL,
    explicacion        TEXT,
    hash               TEXT NOT NULL UNIQUE     -- para evitar duplicados
  );
  CREATE INDEX IF NOT EXISTS idx_preguntas_tema ON preguntas(tema_id);

  -- Registro de archivos JSON ya importados (para detectar cambios rápido).
  CREATE TABLE IF NOT EXISTS imported_files (
    filename     TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    imported_at  TEXT NOT NULL,
    inserted     INTEGER NOT NULL DEFAULT 0
  );

  -- Cada sesión de estudio finalizada.
  CREATE TABLE IF NOT EXISTS sesiones (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha      TEXT NOT NULL,
    materia_id TEXT,
    total      INTEGER NOT NULL,
    aciertos   INTEGER NOT NULL
  );

  -- Respuesta individual dentro de una sesión (para estadística por tema).
  CREATE TABLE IF NOT EXISTS sesion_respuestas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sesion_id   INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    pregunta_id INTEGER,
    tema_id     TEXT,
    tema_nombre TEXT,
    correcta    INTEGER NOT NULL,
    respondida  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_resp_sesion ON sesion_respuestas(sesion_id);
  CREATE INDEX IF NOT EXISTS idx_resp_tema   ON sesion_respuestas(tema_id);
`)

// Migración: columna de orden personalizado de materias (drag & drop).
// ALTER falla si ya existe, por eso se envuelve en try/catch.
try {
  db.exec('ALTER TABLE materias ADD COLUMN posicion INTEGER')
} catch {
  // la columna ya existe
}
// Backfill: a las materias sin posición se les asigna un orden inicial
// alfabético (para conservar el orden que ya se mostraba).
db.exec(
  `UPDATE materias SET posicion = (
     SELECT COUNT(*) FROM materias m2 WHERE m2.nombre <= materias.nombre
   ) WHERE posicion IS NULL`,
)

// Migración: mismo orden personalizado (drag & drop) pero para temas.
try {
  db.exec('ALTER TABLE temas ADD COLUMN posicion INTEGER')
} catch {
  // la columna ya existe
}
// Backfill alfabético, dentro de cada materia (no global).
db.exec(
  `UPDATE temas SET posicion = (
     SELECT COUNT(*) FROM temas t2
     WHERE t2.materia_id = temas.materia_id AND t2.nombre <= temas.nombre
   ) WHERE posicion IS NULL`,
)

// Migración: tipo de pregunta ('opcion' por defecto; 'flashcard' para tarjetas).
try {
  db.exec("ALTER TABLE preguntas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'opcion'")
} catch {
  // la columna ya existe
}

// Metadatos opcionales de caso clínico (categoría del tema dentro del caso y
// dificultad). Solo se usan para preguntas de opción múltiple generadas a
// partir de casos clínicos; el resto las deja en NULL.
// Nota: "patologia" quedó en desuso (reemplazada por "materia_caso" más abajo)
// pero se conserva la columna sin borrar, siguiendo el estilo de migración
// aditiva de este archivo.
for (const col of ['patologia', 'tema_categoria', 'dificultad']) {
  try {
    db.exec(`ALTER TABLE preguntas ADD COLUMN ${col} TEXT`)
  } catch {
    // la columna ya existe
  }
}
// Especialidad médica principal del caso clínico (p. ej. "Cardiología").
try {
  db.exec('ALTER TABLE preguntas ADD COLUMN materia_caso TEXT')
} catch {
  // la columna ya existe
}

// Carpetas: agrupan materias (jerarquía carpeta → materia → tema).
db.exec(`
  CREATE TABLE IF NOT EXISTS carpetas (
    id       TEXT PRIMARY KEY,
    nombre   TEXT NOT NULL,
    posicion INTEGER
  );
`)
// Las materias pertenecen a una carpeta.
try {
  db.exec('ALTER TABLE materias ADD COLUMN carpeta_id TEXT')
} catch {
  // la columna ya existe
}

// Migración de datos: las materias sin carpeta van a "6to semestre".
{
  const huerfanas = db
    .prepare('SELECT COUNT(*) AS c FROM materias WHERE carpeta_id IS NULL')
    .get().c
  if (huerfanas > 0) {
    let car = db.prepare('SELECT id FROM carpetas WHERE nombre = ?').get('6to semestre')
    if (!car) {
      const pos = db.prepare('SELECT COALESCE(MAX(posicion), 0) + 1 AS p FROM carpetas').get().p
      db.prepare('INSERT INTO carpetas (id, nombre, posicion) VALUES (?, ?, ?)').run(
        'carpeta-6to-semestre',
        '6to semestre',
        pos,
      )
      car = { id: 'carpeta-6to-semestre' }
    }
    db.prepare('UPDATE materias SET carpeta_id = ? WHERE carpeta_id IS NULL').run(car.id)
  }
}

// ----- Multiusuario: cada cuenta tiene sus propios datos -----
// El contenido de nivel superior (carpetas, materias) y el historial (sesiones)
// pertenecen a un usuario. Temas y preguntas heredan el dueño vía su materia;
// sesion_respuestas vía su sesión.
for (const tabla of ['carpetas', 'materias', 'sesiones']) {
  try {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN usuario_id INTEGER`)
  } catch {
    // la columna ya existe
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_materias_usuario ON materias(usuario_id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_carpetas_usuario ON carpetas(usuario_id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id)')

// Cuentas de usuario y tokens de sesión (auth).
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    creado_en     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en  TEXT NOT NULL,
    expira_en  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens(usuario_id);
`)

// Perfil de usuario: nombre visible (único) y foto (clave de avatar predefinido
// o un data URL con la imagen subida).
for (const col of ['nombre_usuario', 'foto_perfil']) {
  try {
    db.exec(`ALTER TABLE usuarios ADD COLUMN ${col} TEXT`)
  } catch {
    // la columna ya existe
  }
}
// Marca de cuenta de invitado (entrar sin registrarse).
try {
  db.exec('ALTER TABLE usuarios ADD COLUMN invitado INTEGER NOT NULL DEFAULT 0')
} catch {
  // la columna ya existe
}
// Bloqueo temporal por intentos de login fallidos.
try {
  db.exec('ALTER TABLE usuarios ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0')
} catch {
  // la columna ya existe
}
try {
  db.exec('ALTER TABLE usuarios ADD COLUMN bloqueado_hasta TEXT')
} catch {
  // la columna ya existe
}
// Avatar por defecto para cuentas sin foto.
// 'gato' porque 'ajolote' pasó a ser un avatar bloqueado (desbloqueable por
// misión, ver server/services/avataresCatalogo.js).
db.exec("UPDATE usuarios SET foto_perfil = 'gato' WHERE foto_perfil IS NULL OR foto_perfil = ''")
// Backfill de nombre de usuario único a partir del correo (cuentas previas).
{
  const sinNombre = db
    .prepare("SELECT id, email FROM usuarios WHERE nombre_usuario IS NULL OR nombre_usuario = ''")
    .all()
  const tomado = (n) => db.prepare('SELECT 1 FROM usuarios WHERE nombre_usuario = ?').get(n)
  for (const u of sinNombre) {
    const base = String(u.email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'usuario'
    let nombre = base
    let k = 2
    while (tomado(nombre)) nombre = `${base}${k++}`
    db.prepare('UPDATE usuarios SET nombre_usuario = ? WHERE id = ?').run(nombre, u.id)
  }
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre_usuario)')

// Amistades: solicitudes (pendiente) y amistades confirmadas (aceptada).
db.exec(`
  CREATE TABLE IF NOT EXISTS amistades (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    receptor_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    estado         TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'aceptada'
    creado_en      TEXT NOT NULL,
    UNIQUE(solicitante_id, receptor_id)
  );
  CREATE INDEX IF NOT EXISTS idx_amistades_receptor ON amistades(receptor_id);
  CREATE INDEX IF NOT EXISTS idx_amistades_solicitante ON amistades(solicitante_id);
`)

// Grupos de estudio: carpetas/materias compartidas entre un grupo de
// compañeros. El contenido del grupo es independiente del contenido personal.
// (Antes se llamaban "proyectos"; se renombraron las tablas viejas porque
// nunca llegaron a tener datos reales. RENAME conserva cualquier dato si ya
// existían; en una instalación nueva simplemente no hay nada que renombrar.)
for (const [de, a] of [
  ['proyectos', 'grupos'],
  ['proyecto_miembros', 'grupo_miembros'],
  ['proyecto_acceso', 'grupo_acceso'],
]) {
  try {
    db.exec(`ALTER TABLE ${de} RENAME TO ${a}`)
  } catch {
    // no existía la tabla vieja
  }
}
for (const tabla of ['grupo_miembros', 'grupo_acceso']) {
  try {
    db.exec(`ALTER TABLE ${tabla} RENAME COLUMN proyecto_id TO grupo_id`)
  } catch {
    // ya renombrada, o instalación nueva sin la columna vieja
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS grupos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre         TEXT NOT NULL,
    propietario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en      TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS grupo_miembros (
    grupo_id   INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, usuario_id)
  );
  CREATE INDEX IF NOT EXISTS idx_miembros_usuario ON grupo_miembros(usuario_id);

  -- Lista blanca para grupos con acceso 'selectivo': solo estos usuarios
  -- (más el propietario) pueden unirse/ver. Si está vacía => acceso abierto.
  CREATE TABLE IF NOT EXISTS grupo_acceso (
    grupo_id   INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (grupo_id, usuario_id)
  );
`)
// Las carpetas y materias pueden pertenecer a un grupo (grupo_id no nulo)
// en lugar de ser personales (grupo_id nulo => usuario_id es el dueño).
for (const tabla of ['carpetas', 'materias']) {
  try {
    db.exec(`ALTER TABLE ${tabla} RENAME COLUMN proyecto_id TO grupo_id`)
  } catch {
    // ya renombrada, o instalación nueva sin la columna vieja
  }
  try {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN grupo_id INTEGER`)
  } catch {
    // la columna ya existe
  }
}
db.exec('DROP INDEX IF EXISTS idx_carpetas_proyecto')
db.exec('DROP INDEX IF EXISTS idx_materias_proyecto')
db.exec('CREATE INDEX IF NOT EXISTS idx_carpetas_grupo ON carpetas(grupo_id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_materias_grupo ON materias(grupo_id)')
// Temas por materia: usado en casi todo join/lookup de temas (catálogo, export).
db.exec('CREATE INDEX IF NOT EXISTS idx_temas_materia ON temas(materia_id)')

// Código único de 6 dígitos para unirse a un grupo, y permiso de edición
// ('todos' = cualquier miembro puede modificar; 'solo_propietario' = solo el dueño).
try {
  db.exec('ALTER TABLE grupos ADD COLUMN codigo TEXT')
} catch {
  // la columna ya existe
}
try {
  db.exec("ALTER TABLE grupos ADD COLUMN permiso_edicion TEXT NOT NULL DEFAULT 'todos'")
} catch {
  // la columna ya existe
}
// Backfill: asigna un código único a grupos previos que no lo tengan.
{
  const sinCodigo = db.prepare('SELECT id FROM grupos WHERE codigo IS NULL').all()
  const existe = (c) => db.prepare('SELECT 1 FROM grupos WHERE codigo = ?').get(c)
  for (const p of sinCodigo) {
    let codigo
    do {
      codigo = String(Math.floor(100000 + Math.random() * 900000))
    } while (existe(codigo))
    db.prepare('UPDATE grupos SET codigo = ? WHERE id = ?').run(codigo, p.id)
  }
}
db.exec('DROP INDEX IF EXISTS idx_proyectos_codigo')
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_grupos_codigo ON grupos(codigo)')

// Objetivos grupales: un reto colectivo ("completar 500 preguntas de
// cardiología esta semana"). El progreso NO se guarda aquí: se calcula al
// vuelo contando sesion_respuestas de los miembros desde fecha_inicio (evita
// que se desincronice del historial real).
db.exec(`
  CREATE TABLE IF NOT EXISTS objetivos_grupales (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id     INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    descripcion  TEXT NOT NULL,
    materia_id   TEXT REFERENCES materias(id) ON DELETE SET NULL,
    meta         INTEGER NOT NULL,
    fecha_inicio TEXT NOT NULL,
    creado_por   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_objetivos_grupo ON objetivos_grupales(grupo_id);
`)

// Progreso de gamificación: racha diaria de estudio, XP, nivel (derivado del
// XP, ver server/services/progresoService.js) y monedas. "ultima_fecha_actividad"
// es la fecha UTC (YYYY-MM-DD) de la última sesión guardada; se compara contra
// la fecha UTC de hoy para saber si la racha avanza, se rompe o ya contaba.
db.exec(`
  CREATE TABLE IF NOT EXISTS usuario_progreso (
    usuario_id             INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    racha_actual           INTEGER NOT NULL DEFAULT 0,
    racha_maxima           INTEGER NOT NULL DEFAULT 0,
    ultima_fecha_actividad TEXT,
    xp_total               INTEGER NOT NULL DEFAULT 0,
    monedas                INTEGER NOT NULL DEFAULT 0
  );

  -- Cajas de regalo: se otorga una cada vez que la racha avanza a un nuevo día.
  -- La recompensa (tipo/cantidad) se decide al ABRIR la caja, no al crearla,
  -- para que el sorteo sea una sorpresa real y no algo ya fijado de antemano.
  CREATE TABLE IF NOT EXISTS usuario_cajas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    origen              TEXT NOT NULL DEFAULT 'racha_diaria',
    creado_en           TEXT NOT NULL,
    abierta_en          TEXT,
    recompensa_tipo     TEXT,
    recompensa_cantidad INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_cajas_usuario ON usuario_cajas(usuario_id);
`)

// Recompensa de cosmético (marco/insignia) ganada en una caja: la clave del
// catálogo (ver server/services/cosmeticosCatalogo.js). Columna aparte de
// recompensa_cantidad porque un cosmético no tiene cantidad, tiene identidad.
try {
  db.exec('ALTER TABLE usuario_cajas ADD COLUMN recompensa_clave TEXT')
} catch {
  // la columna ya existe
}

// Cosméticos (marcos de avatar e insignias) desbloqueados por cada usuario.
// El catálogo (nombre/rareza/render) vive en código, no en la BD, igual que
// los avatares (ver src/components/cosmeticos.js); aquí solo se guarda cuáles
// claves tiene cada quién.
db.exec(`
  CREATE TABLE IF NOT EXISTS usuario_cosmeticos (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    clave       TEXT NOT NULL,
    obtenido_en TEXT NOT NULL,
    PRIMARY KEY (usuario_id, clave)
  );
`)
// Marco de avatar actualmente equipado (clave del catálogo, o NULL = ninguno).
try {
  db.exec('ALTER TABLE usuarios ADD COLUMN marco_equipado TEXT')
} catch {
  // la columna ya existe
}

// Banco de contenido público (Comunidad): cualquier usuario puede publicar
// una materia o carpeta completa suya (con sus temas y preguntas) como una
// instantánea independiente — igual que un export/import JSON, así que
// editar o borrar el contenido original después no afecta lo ya publicado.
// Se auto-aprueba al publicar; se modera después por reportes.
db.exec(`
  DROP TABLE IF EXISTS reportes_preguntas_publicas;
  DROP TABLE IF EXISTS preguntas_publicas;

  CREATE TABLE IF NOT EXISTS contenido_publico (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    autor_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo              TEXT NOT NULL,          -- 'materia' | 'carpeta'
    nombre            TEXT NOT NULL,
    icono             TEXT,
    descripcion       TEXT,
    datos_json        TEXT NOT NULL,          -- snapshot en el mismo formato que exportar/importar
    materias_json     TEXT NOT NULL,          -- facetas para filtrar (arrays JSON de texto)
    temas_json        TEXT NOT NULL,
    dificultades_json TEXT NOT NULL,
    categorias_json   TEXT NOT NULL,          -- Epidemiología/Etiología/Fisiopatología/Cuadro clínico/Tratamiento
    total_temas       INTEGER NOT NULL DEFAULT 0,
    total_preguntas   INTEGER NOT NULL DEFAULT 0,
    estado            TEXT NOT NULL DEFAULT 'visible',
    creado_en         TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contenido_publico_autor ON contenido_publico(autor_id);

  -- Voto simple (👍) por usuario; un solo voto por contenido, se puede quitar.
  CREATE TABLE IF NOT EXISTS contenido_publico_votos (
    contenido_id INTEGER NOT NULL REFERENCES contenido_publico(id) ON DELETE CASCADE,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en    TEXT NOT NULL,
    PRIMARY KEY (contenido_id, usuario_id)
  );

  CREATE TABLE IF NOT EXISTS contenido_publico_comentarios (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    contenido_id INTEGER NOT NULL REFERENCES contenido_publico(id) ON DELETE CASCADE,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto        TEXT NOT NULL,
    creado_en    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comentarios_contenido ON contenido_publico_comentarios(contenido_id);

  -- Reportes de moderación (posterior a la publicación, único por usuario).
  CREATE TABLE IF NOT EXISTS contenido_publico_reportes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    contenido_id INTEGER NOT NULL REFERENCES contenido_publico(id) ON DELETE CASCADE,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    motivo       TEXT,
    creado_en    TEXT NOT NULL,
    UNIQUE(contenido_id, usuario_id)
  );
  CREATE INDEX IF NOT EXISTS idx_contenido_reportes ON contenido_publico_reportes(contenido_id);
`)

// Cuentas con permiso de moderación (cola de reportes del banco público).
try {
  db.exec('ALTER TABLE usuarios ADD COLUMN es_admin INTEGER NOT NULL DEFAULT 0')
} catch {
  // la columna ya existe
}
db.exec("UPDATE usuarios SET es_admin = 1 WHERE email = 'flores.tomas@uabc.edu.mx'")

// Origen de una sesión (personal o banco público) y, para el banco público,
// la materia (texto libre, ver preguntas_publicas) — sienta la base para los
// rankings de Comunidad sin tocar el historial personal existente.
try {
  db.exec("ALTER TABLE sesiones ADD COLUMN origen TEXT NOT NULL DEFAULT 'personal'")
} catch {
  // la columna ya existe
}
try {
  db.exec('ALTER TABLE sesiones ADD COLUMN materia_nombre TEXT')
} catch {
  // la columna ya existe
}

// Avatares desbloqueables por misión (ajolote, zorro, búho, rana, pingüino —
// ver server/services/avataresCatalogo.js). El resto de los avatares de
// authService.js están libres desde el inicio; aquí solo se guarda cuáles de
// los bloqueados ya desbloqueó cada usuario.
db.exec(`
  CREATE TABLE IF NOT EXISTS usuario_avatares (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    avatar      TEXT NOT NULL,
    obtenido_en TEXT NOT NULL,
    PRIMARY KEY (usuario_id, avatar)
  );

  -- Misiones de bienvenida (una vez por usuario): cada una otorga XP;
  -- completar las 3 desbloquea un avatar de regalo (ver misionesCatalogo.js).
  CREATE TABLE IF NOT EXISTS usuario_misiones (
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    clave          TEXT NOT NULL,
    completada_en  TEXT NOT NULL,
    PRIMARY KEY (usuario_id, clave)
  );
`)

// Cierre limpio de la conexión (apagado del servidor). Hace checkpoint del WAL.
export function closeDatabase() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
    db.close()
  } catch {
    // ya cerrada o sin checkpoint pendiente
  }
}

export { DATA_DIR, DB_PATH }
