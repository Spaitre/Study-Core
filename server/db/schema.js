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

// Migración: tipo de pregunta ('opcion' por defecto; 'flashcard' para tarjetas).
try {
  db.exec("ALTER TABLE preguntas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'opcion'")
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
// Avatar por defecto para cuentas sin foto.
db.exec("UPDATE usuarios SET foto_perfil = 'ajolote' WHERE foto_perfil IS NULL OR foto_perfil = ''")
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

// Proyectos colaborativos: carpetas/materias compartidas entre un grupo de
// amigos. El contenido del proyecto es independiente del contenido personal.
db.exec(`
  CREATE TABLE IF NOT EXISTS proyectos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre         TEXT NOT NULL,
    propietario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en      TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS proyecto_miembros (
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (proyecto_id, usuario_id)
  );
  CREATE INDEX IF NOT EXISTS idx_miembros_usuario ON proyecto_miembros(usuario_id);

  -- Lista blanca para proyectos con acceso 'selectivo': solo estos usuarios
  -- (más el propietario) pueden unirse/ver. Si está vacía => acceso abierto.
  CREATE TABLE IF NOT EXISTS proyecto_acceso (
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (proyecto_id, usuario_id)
  );
`)
// Las carpetas y materias pueden pertenecer a un proyecto (proyecto_id no nulo)
// en lugar de ser personales (proyecto_id nulo => usuario_id es el dueño).
for (const tabla of ['carpetas', 'materias']) {
  try {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN proyecto_id INTEGER`)
  } catch {
    // la columna ya existe
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_carpetas_proyecto ON carpetas(proyecto_id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_materias_proyecto ON materias(proyecto_id)')
// Temas por materia: usado en casi todo join/lookup de temas (catálogo, export).
db.exec('CREATE INDEX IF NOT EXISTS idx_temas_materia ON temas(materia_id)')

// Código único de 6 dígitos para unirse a un proyecto, y permiso de edición
// ('todos' = cualquier miembro puede modificar; 'solo_propietario' = solo el dueño).
try {
  db.exec('ALTER TABLE proyectos ADD COLUMN codigo TEXT')
} catch {
  // la columna ya existe
}
try {
  db.exec("ALTER TABLE proyectos ADD COLUMN permiso_edicion TEXT NOT NULL DEFAULT 'todos'")
} catch {
  // la columna ya existe
}
// Backfill: asigna un código único a proyectos previos que no lo tengan.
{
  const sinCodigo = db.prepare('SELECT id FROM proyectos WHERE codigo IS NULL').all()
  const existe = (c) => db.prepare('SELECT 1 FROM proyectos WHERE codigo = ?').get(c)
  for (const p of sinCodigo) {
    let codigo
    do {
      codigo = String(Math.floor(100000 + Math.random() * 900000))
    } while (existe(codigo))
    db.prepare('UPDATE proyectos SET codigo = ? WHERE id = ?').run(codigo, p.id)
  }
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_proyectos_codigo ON proyectos(codigo)')

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
