// Repositorio de progreso de gamificación: racha, XP, monedas y cajas de regalo.
import { database } from '../db/index.js'

export const progresoRepo = {
  async obtener(usuarioId, exec = database) {
    return exec.get('SELECT * FROM usuario_progreso WHERE usuario_id = ?', [usuarioId])
  },

  // Crea la fila de progreso si no existe (cuentas nuevas o previas a esta
  // funcionalidad). Idempotente vía ON CONFLICT.
  async asegurarFila(usuarioId, exec = database) {
    await exec.run(
      `INSERT INTO usuario_progreso (usuario_id, racha_actual, racha_maxima, ultima_fecha_actividad, xp_total, monedas)
       VALUES (?, 0, 0, NULL, 0, 0)
       ON CONFLICT(usuario_id) DO NOTHING`,
      [usuarioId],
    )
  },

  async actualizarActividad(usuarioId, { rachaActual, rachaMaxima, ultimaFechaActividad, xpTotal }, exec = database) {
    return exec.run(
      `UPDATE usuario_progreso
       SET racha_actual = ?, racha_maxima = ?, ultima_fecha_actividad = ?, xp_total = ?
       WHERE usuario_id = ?`,
      [rachaActual, rachaMaxima, ultimaFechaActividad, xpTotal, usuarioId],
    )
  },

  async sumarMonedas(usuarioId, cantidad, exec = database) {
    return exec.run('UPDATE usuario_progreso SET monedas = monedas + ? WHERE usuario_id = ?', [
      cantidad,
      usuarioId,
    ])
  },

  async sumarXp(usuarioId, cantidad, exec = database) {
    return exec.run('UPDATE usuario_progreso SET xp_total = xp_total + ? WHERE usuario_id = ?', [
      cantidad,
      usuarioId,
    ])
  },

  async crearCaja(usuarioId, origen, fechaISO, exec = database) {
    const info = await exec.run(
      'INSERT INTO usuario_cajas (usuario_id, origen, creado_en) VALUES (?, ?, ?)',
      [usuarioId, origen, fechaISO],
    )
    return info.lastInsertRowid
  },

  cajasPendientes(usuarioId) {
    return database.all(
      'SELECT id, origen, creado_en FROM usuario_cajas WHERE usuario_id = ? AND abierta_en IS NULL ORDER BY id',
      [usuarioId],
    )
  },

  obtenerCaja(id, usuarioId) {
    return database.get('SELECT * FROM usuario_cajas WHERE id = ? AND usuario_id = ?', [
      id,
      usuarioId,
    ])
  },

  // `WHERE abierta_en IS NULL` hace el guard atómico: si dos peticiones
  // llegan a abrir la misma caja, solo una consigue `changes > 0` (ver
  // progresoService.abrirCaja, que solo entrega la recompensa cuando esto
  // pasa de 0).
  async marcarAbierta(id, tipo, cantidad, clave, fechaISO, exec = database) {
    return exec.run(
      `UPDATE usuario_cajas
       SET abierta_en = ?, recompensa_tipo = ?, recompensa_cantidad = ?, recompensa_clave = ?
       WHERE id = ? AND abierta_en IS NULL`,
      [fechaISO, tipo, cantidad, clave, id],
    )
  },

  async clavesCosmeticos(usuarioId) {
    const filas = await database.all(
      'SELECT clave FROM usuario_cosmeticos WHERE usuario_id = ?',
      [usuarioId],
    )
    return filas.map((f) => f.clave)
  },

  async otorgarCosmetico(usuarioId, clave, fechaISO, exec = database) {
    return exec.run(
      `INSERT INTO usuario_cosmeticos (usuario_id, clave, obtenido_en)
       VALUES (?, ?, ?)
       ON CONFLICT(usuario_id, clave) DO NOTHING`,
      [usuarioId, clave, fechaISO],
    )
  },
}
