// Repositorio de sesiones de estudio e historial/estadísticas.
import { database } from '../db/index.js'

export const sesionesRepo = {
  async insertarSesion(fechaISO, materiaId, total, aciertos, usuarioId, exec = database) {
    const info = await exec.run(
      'INSERT INTO sesiones (fecha, materia_id, total, aciertos, usuario_id) VALUES (?, ?, ?, ?, ?)',
      [fechaISO, materiaId, total, aciertos, usuarioId],
    )
    return info.lastInsertRowid
  },

  insertarRespuesta(sesionId, preguntaId, temaId, temaNombre, correcta, respondida, exec = database) {
    return exec.run(
      `INSERT INTO sesion_respuestas (sesion_id, pregunta_id, tema_id, tema_nombre, correcta, respondida)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sesionId, preguntaId, temaId, temaNombre, correcta, respondida],
    )
  },

  statsGlobal(usuarioId) {
    return database.get(
      `SELECT COUNT(*) AS sesiones, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(aciertos), 0) AS aciertos
       FROM sesiones WHERE usuario_id = ?`,
      [usuarioId],
    )
  },

  statsPorTema(usuarioId) {
    return database.all(
      `SELECT sr.tema_nombre AS nombre, COUNT(*) AS total, SUM(sr.correcta) AS aciertos
       FROM sesion_respuestas sr JOIN sesiones s ON s.id = sr.sesion_id
       WHERE s.usuario_id = ? AND sr.tema_nombre IS NOT NULL
       GROUP BY sr.tema_nombre ORDER BY aciertos * 1.0 / total DESC`,
      [usuarioId],
    )
  },

  sesionesRecientes(usuarioId) {
    return database.all(
      `SELECT s.id, s.fecha, s.total, s.aciertos, m.nombre AS materia
       FROM sesiones s LEFT JOIN materias m ON m.id = s.materia_id
       WHERE s.usuario_id = ? ORDER BY s.id DESC LIMIT 10`,
      [usuarioId],
    )
  },
}
