// Repositorio de contenido de estudio: carpetas, materias, temas y preguntas.
// Aquí viven los fragmentos de acceso (ACC_*) y todo el SQL del dominio. Los
// métodos aceptan un `exec` opcional para componer transacciones desde el servicio.
import { database } from '../db/index.js'

// Acceso a contenido: un usuario puede tocar una carpeta/materia si es suya y
// personal (proyecto_id NULL) o si pertenece a un proyecto del que es miembro.
// (Esperan dos veces el usuario_id.)
const ACC_MATERIA = `((m.usuario_id = ? AND m.proyecto_id IS NULL) OR m.proyecto_id IN (SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = ?))`
const ACC_CARPETA = `((usuario_id = ? AND proyecto_id IS NULL) OR proyecto_id IN (SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = ?))`

// Tablas permitidas para idUnico (id global con sufijo si choca).
const TABLAS_ID = new Set(['carpetas', 'materias', 'temas'])

export const contenidoRepo = {
  // ----- ids únicos -----
  async idUnico(base, tabla, exec = database) {
    if (!TABLAS_ID.has(tabla)) throw new Error(`Tabla no permitida para idUnico: ${tabla}`)
    let id = base
    let n = 2
    while (await exec.get(`SELECT 1 FROM ${tabla} WHERE id = ?`, [id])) id = `${base}-${n++}`
    return id
  },

  // ----- Carpetas -----
  carpetasPersonal(usuarioId) {
    return database.all(
      `SELECT c.id, c.nombre, COUNT(m.id) AS materias
       FROM carpetas c LEFT JOIN materias m ON m.carpeta_id = c.id
       WHERE c.usuario_id = ? AND c.proyecto_id IS NULL
       GROUP BY c.id ORDER BY c.posicion, c.nombre`,
      [usuarioId],
    )
  },
  carpetasProyecto(proyectoId) {
    return database.all(
      `SELECT c.id, c.nombre, COUNT(m.id) AS materias
       FROM carpetas c LEFT JOIN materias m ON m.carpeta_id = c.id
       WHERE c.proyecto_id = ?
       GROUP BY c.id ORDER BY c.posicion, c.nombre`,
      [proyectoId],
    )
  },
  carpetaAccesible(id, uid, exec = database) {
    return exec.get(`SELECT id, proyecto_id FROM carpetas WHERE id = ? AND ${ACC_CARPETA}`, [id, uid, uid])
  },
  carpetaParaImport(id, uid) {
    return database.get(
      `SELECT id, usuario_id, proyecto_id FROM carpetas WHERE id = ? AND ${ACC_CARPETA}`,
      [id, uid, uid],
    )
  },
  // ¿Existe la carpeta en el contexto dado? (para crear materia dentro).
  carpetaEnContexto(id, proyectoId, usuarioId) {
    return proyectoId
      ? database.get('SELECT 1 FROM carpetas WHERE id = ? AND proyecto_id = ?', [id, proyectoId])
      : database.get('SELECT 1 FROM carpetas WHERE id = ? AND usuario_id = ? AND proyecto_id IS NULL', [
          id,
          usuarioId,
        ])
  },
  carpetaInfo(id) {
    return database.get('SELECT id, nombre FROM carpetas WHERE id = ?', [id])
  },
  async maxPosCarpeta(proyectoId, usuarioId, exec = database) {
    const row = proyectoId
      ? await exec.get('SELECT COALESCE(MAX(posicion),0)+1 AS p FROM carpetas WHERE proyecto_id = ?', [proyectoId])
      : await exec.get(
          'SELECT COALESCE(MAX(posicion),0)+1 AS p FROM carpetas WHERE usuario_id = ? AND proyecto_id IS NULL',
          [usuarioId],
        )
    return row.p
  },
  insertarCarpeta(id, nombre, pos, usuarioId, proyectoId, exec = database) {
    return exec.run(
      'INSERT INTO carpetas (id, nombre, posicion, usuario_id, proyecto_id) VALUES (?, ?, ?, ?, ?)',
      [id, nombre, pos, usuarioId, proyectoId],
    )
  },
  actualizarCarpetaNombre(id, nombre, exec = database) {
    return exec.run('UPDATE carpetas SET nombre = ? WHERE id = ?', [nombre, id])
  },
  borrarMateriasDeCarpeta(carpetaId, exec = database) {
    return exec.run('DELETE FROM materias WHERE carpeta_id = ?', [carpetaId])
  },
  borrarCarpeta(id, exec = database) {
    return exec.run('DELETE FROM carpetas WHERE id = ?', [id])
  },
  reordenarCarpeta(pos, id, uid, exec = database) {
    return exec.run(`UPDATE carpetas SET posicion = ? WHERE id = ? AND ${ACC_CARPETA}`, [pos, id, uid, uid])
  },
  materiasDeCarpeta(carpetaId) {
    return database.all('SELECT id, nombre, icono FROM materias WHERE carpeta_id = ? ORDER BY posicion, nombre', [
      carpetaId,
    ])
  },

  // ----- Materias -----
  materiasPersonal(usuarioId) {
    return database.all(
      'SELECT id, nombre, icono, carpeta_id FROM materias WHERE usuario_id = ? AND proyecto_id IS NULL ORDER BY posicion, nombre',
      [usuarioId],
    )
  },
  materiasProyecto(proyectoId) {
    return database.all(
      'SELECT id, nombre, icono, carpeta_id FROM materias WHERE proyecto_id = ? ORDER BY posicion, nombre',
      [proyectoId],
    )
  },
  materiaAccesible(id, uid) {
    // Reutiliza ACC_CARPETA (mismas columnas usuario_id/proyecto_id en materias).
    return database.get(`SELECT id, proyecto_id FROM materias WHERE id = ? AND ${ACC_CARPETA}`, [id, uid, uid])
  },
  async maxPosMateria(proyectoId, usuarioId, exec = database) {
    const row = proyectoId
      ? await exec.get('SELECT COALESCE(MAX(posicion),0)+1 AS p FROM materias WHERE proyecto_id = ?', [proyectoId])
      : await exec.get(
          'SELECT COALESCE(MAX(posicion),0)+1 AS p FROM materias WHERE usuario_id = ? AND proyecto_id IS NULL',
          [usuarioId],
        )
    return row.p
  },
  insertarMateria(id, nombre, icono, pos, carpetaId, usuarioId, proyectoId, exec = database) {
    return exec.run(
      'INSERT INTO materias (id, nombre, icono, posicion, carpeta_id, usuario_id, proyecto_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, nombre, icono, pos, carpetaId, usuarioId, proyectoId],
    )
  },
  actualizarMateria(id, nombre, icono, exec = database) {
    return exec.run('UPDATE materias SET nombre = ?, icono = ? WHERE id = ?', [nombre, icono, id])
  },
  borrarMateria(id, exec = database) {
    return exec.run('DELETE FROM materias WHERE id = ?', [id])
  },
  reordenarMateria(pos, id, uid, exec = database) {
    return exec.run(`UPDATE materias SET posicion = ? WHERE id = ? AND ${ACC_CARPETA}`, [pos, id, uid, uid])
  },
  materiaInfo(id) {
    return database.get('SELECT id, nombre, icono FROM materias WHERE id = ?', [id])
  },

  // ----- Temas -----
  temasDeMateria(materiaId) {
    return database.all(
      `SELECT t.id, t.nombre, COUNT(p.id) AS total
       FROM temas t LEFT JOIN preguntas p ON p.tema_id = t.id
       WHERE t.materia_id = ? GROUP BY t.id ORDER BY t.nombre`,
      [materiaId],
    )
  },
  temasDeMateriaSimple(materiaId) {
    return database.all('SELECT id, nombre FROM temas WHERE materia_id = ? ORDER BY nombre', [materiaId])
  },
  // Temas (con conteo) de varias materias en una sola consulta. Incluye
  // materia_id para agrupar; orden por nombre como en temasDeMateria.
  temasDeMaterias(materiaIds) {
    const ph = materiaIds.map(() => '?').join(',')
    return database.all(
      `SELECT t.materia_id, t.id, t.nombre, COUNT(p.id) AS total
       FROM temas t LEFT JOIN preguntas p ON p.tema_id = t.id
       WHERE t.materia_id IN (${ph})
       GROUP BY t.id ORDER BY t.nombre`,
      [...materiaIds],
    )
  },
  temaAccesible(id, uid, exec = database) {
    return exec.get(
      `SELECT t.id, t.materia_id, m.proyecto_id
       FROM temas t JOIN materias m ON m.id = t.materia_id
       WHERE t.id = ? AND ${ACC_MATERIA}`,
      [id, uid, uid],
    )
  },
  insertarTema(id, materiaId, nombre, exec = database) {
    return exec.run('INSERT INTO temas (id, materia_id, nombre) VALUES (?, ?, ?)', [id, materiaId, nombre])
  },
  actualizarTema(id, nombre, exec = database) {
    return exec.run('UPDATE temas SET nombre = ? WHERE id = ?', [nombre, id])
  },
  borrarTema(id, exec = database) {
    return exec.run('DELETE FROM temas WHERE id = ?', [id])
  },

  // ----- Preguntas -----
  pregAccesible(id, uid, exec = database) {
    return exec.get(
      `SELECT p.id, p.tema_id, m.proyecto_id
       FROM preguntas p JOIN temas t ON t.id = p.tema_id JOIN materias m ON m.id = t.materia_id
       WHERE p.id = ? AND ${ACC_MATERIA}`,
      [id, uid, uid],
    )
  },
  preguntasDeTema(temaId) {
    return database.all(
      'SELECT id, pregunta, opciones, respuesta_correcta, explicacion, tipo FROM preguntas WHERE tema_id = ? ORDER BY id',
      [temaId],
    )
  },
  insertarPregunta(temaId, pregunta, opcionesJSON, rc, explicacion, hash, tipo, exec = database) {
    return exec.run(
      `INSERT INTO preguntas (tema_id, pregunta, opciones, respuesta_correcta, explicacion, hash, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [temaId, pregunta, opcionesJSON, rc, explicacion, hash, tipo],
    )
  },
  // Inserta deduplicando por hash (OR IGNORE). Devuelve nº de filas insertadas (0/1).
  async insertarPreguntaImport(temaId, pregunta, opcionesJSON, rc, explicacion, hash, tipo, exec = database) {
    const info = await exec.run(
      `INSERT OR IGNORE INTO preguntas (tema_id, pregunta, opciones, respuesta_correcta, explicacion, hash, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [temaId, pregunta, opcionesJSON, rc, explicacion, hash, tipo],
    )
    return info.changes
  },
  actualizarPregunta(id, pregunta, opcionesJSON, rc, explicacion, hash, tipo, exec = database) {
    return exec.run(
      `UPDATE preguntas SET pregunta = ?, opciones = ?, respuesta_correcta = ?, explicacion = ?, hash = ?, tipo = ?
       WHERE id = ?`,
      [pregunta, opcionesJSON, rc, explicacion, hash, tipo, id],
    )
  },
  borrarPregunta(id, exec = database) {
    return exec.run('DELETE FROM preguntas WHERE id = ?', [id])
  },
  async contarTema(temaId, exec = database) {
    const { c } = await exec.get('SELECT COUNT(*) AS c FROM preguntas WHERE tema_id = ?', [temaId])
    return c
  },
  preguntasParaExport(temaId) {
    return database.all(
      'SELECT pregunta, opciones, respuesta_correcta, explicacion FROM preguntas WHERE tema_id = ? ORDER BY id',
      [temaId],
    )
  },

  // Preguntas de varios temas (orden aleatorio), validando acceso del usuario.
  preguntasDeTemas(temaIds, uid) {
    const ph = temaIds.map(() => '?').join(',')
    return database.all(
      `SELECT p.*, t.nombre AS tema_nombre, m.nombre AS materia_nombre
       FROM preguntas p JOIN temas t ON t.id = p.tema_id JOIN materias m ON m.id = t.materia_id
       WHERE p.tema_id IN (${ph}) AND ${ACC_MATERIA}
       ORDER BY RANDOM()`,
      [...temaIds, uid, uid],
    )
  },

  // Solo preguntas de opción múltiple de varios temas (para el multijugador).
  preguntasOpcionDeTemas(temaIds, uid) {
    const ph = temaIds.map(() => '?').join(',')
    return database.all(
      `SELECT p.* FROM preguntas p
       JOIN temas t ON t.id = p.tema_id JOIN materias m ON m.id = t.materia_id
       WHERE p.tema_id IN (${ph}) AND p.tipo = 'opcion' AND ${ACC_MATERIA}
       ORDER BY RANDOM()`,
      [...temaIds, uid, uid],
    )
  },

  buscar(usuarioId, like) {
    return database.all(
      `SELECT p.*, t.nombre AS tema_nombre, m.nombre AS materia_nombre
       FROM preguntas p JOIN temas t ON t.id = p.tema_id JOIN materias m ON m.id = t.materia_id
       WHERE m.usuario_id = ? AND m.proyecto_id IS NULL AND (p.pregunta LIKE ? OR p.explicacion LIKE ?)
       ORDER BY m.nombre, t.nombre LIMIT 100`,
      [usuarioId, like, like],
    )
  },
}
