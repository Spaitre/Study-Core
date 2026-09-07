// Repositorio de avatares desbloqueados por usuario (ver avataresCatalogo.js).
import { database } from '../db/index.js'

export const avataresRepo = {
  async claves(usuarioId) {
    const filas = await database.all('SELECT avatar FROM usuario_avatares WHERE usuario_id = ?', [usuarioId])
    return filas.map((f) => f.avatar)
  },

  async otorgar(usuarioId, avatar, fechaISO, exec = database) {
    return exec.run(
      `INSERT INTO usuario_avatares (usuario_id, avatar, obtenido_en)
       VALUES (?, ?, ?)
       ON CONFLICT(usuario_id, avatar) DO NOTHING`,
      [usuarioId, avatar, fechaISO],
    )
  },
}
