// Repositorio de amistades: solicitudes (pendiente) y amistades (aceptada).
import { database } from '../db/index.js'

export const amigosRepo = {
  // Las tres listas hacen JOIN con usuarios para traer el perfil de la otra
  // persona en una sola consulta (antes era una consulta de perfil por fila).
  // Columnas en el mismo orden/forma que perfilDe + amistadId.
  // Amistades aceptadas (la otra persona).
  aceptadosConPerfil(usuarioId) {
    return database.all(
      `SELECT a.id AS amistadId, u.id, u.email, u.nombre_usuario AS nombreUsuario, u.foto_perfil AS foto, u.invitado
       FROM amistades a
       JOIN usuarios u ON u.id = (CASE WHEN a.solicitante_id = ? THEN a.receptor_id ELSE a.solicitante_id END)
       WHERE a.estado = 'aceptada' AND (a.solicitante_id = ? OR a.receptor_id = ?)
       ORDER BY a.id DESC`,
      [usuarioId, usuarioId, usuarioId],
    )
  },

  // Solicitudes recibidas (pendientes de que el usuario acepte) + perfil del solicitante.
  recibidasConPerfil(usuarioId) {
    return database.all(
      `SELECT a.id AS amistadId, u.id, u.email, u.nombre_usuario AS nombreUsuario, u.foto_perfil AS foto, u.invitado
       FROM amistades a JOIN usuarios u ON u.id = a.solicitante_id
       WHERE a.receptor_id = ? AND a.estado = 'pendiente' ORDER BY a.id DESC`,
      [usuarioId],
    )
  },

  // Solicitudes enviadas y pendientes + perfil del receptor.
  enviadasConPerfil(usuarioId) {
    return database.all(
      `SELECT a.id AS amistadId, u.id, u.email, u.nombre_usuario AS nombreUsuario, u.foto_perfil AS foto, u.invitado
       FROM amistades a JOIN usuarios u ON u.id = a.receptor_id
       WHERE a.solicitante_id = ? AND a.estado = 'pendiente' ORDER BY a.id DESC`,
      [usuarioId],
    )
  },

  // Relación existente entre dos usuarios (en cualquier dirección), si la hay.
  relacionEntre(a, b) {
    return database.get(
      `SELECT * FROM amistades
       WHERE (solicitante_id = ? AND receptor_id = ?)
          OR (solicitante_id = ? AND receptor_id = ?)`,
      [a, b, b, a],
    )
  },

  crearSolicitud(solicitanteId, receptorId) {
    return database.run(
      "INSERT INTO amistades (solicitante_id, receptor_id, estado, creado_en) VALUES (?, ?, 'pendiente', ?)",
      [solicitanteId, receptorId, new Date().toISOString()],
    )
  },

  // Marca como aceptada una amistad por id (usado al auto-aceptar recíproca).
  aceptarPorId(id) {
    return database.run("UPDATE amistades SET estado = 'aceptada' WHERE id = ?", [id])
  },

  // Acepta una solicitud recibida; devuelve nº de filas afectadas.
  async aceptarSolicitud(id, receptorId) {
    const r = await database.run(
      "UPDATE amistades SET estado = 'aceptada' WHERE id = ? AND receptor_id = ? AND estado = 'pendiente'",
      [id, receptorId],
    )
    return r.changes
  },

  // Rechaza/cancela/elimina cualquier amistad donde participe el usuario.
  async borrar(id, usuarioId) {
    const r = await database.run(
      'DELETE FROM amistades WHERE id = ? AND (solicitante_id = ? OR receptor_id = ?)',
      [id, usuarioId, usuarioId],
    )
    return r.changes
  },

  // ¿Son amigos confirmados? (lo usa el servicio de proyectos para la lista blanca).
  async sonAmigos(a, b) {
    const row = await database.get(
      `SELECT 1 FROM amistades WHERE estado = 'aceptada'
       AND ((solicitante_id = ? AND receptor_id = ?) OR (solicitante_id = ? AND receptor_id = ?))`,
      [a, b, b, a],
    )
    return !!row
  },
}
