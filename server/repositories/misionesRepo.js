// Repositorio de misiones de bienvenida completadas por usuario.
import { database } from '../db/index.js'

export const misionesRepo = {
  async completadas(usuarioId, exec = database) {
    const filas = await exec.all('SELECT clave FROM usuario_misiones WHERE usuario_id = ?', [usuarioId])
    return filas.map((f) => f.clave)
  },

  // Devuelve true solo si esta llamada la marcó (primera vez); false si ya
  // estaba completada — así el servicio sabe si debe otorgar el XP o no.
  async marcarCompletada(usuarioId, clave, fechaISO, exec = database) {
    const info = await exec.run(
      `INSERT INTO usuario_misiones (usuario_id, clave, completada_en)
       VALUES (?, ?, ?)
       ON CONFLICT(usuario_id, clave) DO NOTHING`,
      [usuarioId, clave, fechaISO],
    )
    return info.changes > 0
  },
}
