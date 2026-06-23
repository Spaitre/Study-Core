// Servicio de amigos: solicitar/aceptar/eliminar y listados con perfil adjunto.
import { amigosRepo } from '../repositories/amigosRepo.js'
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { fallo } from './ApiError.js'

export const amigosService = {
  // Cada listado resuelve amistad + perfil en una sola consulta (sin N+1).
  listar(usuarioId) {
    return amigosRepo.aceptadosConPerfil(usuarioId)
  },

  solicitudes(usuarioId) {
    return amigosRepo.recibidasConPerfil(usuarioId)
  },

  enviadas(usuarioId) {
    return amigosRepo.enviadasConPerfil(usuarioId)
  },

  // Enviar solicitud por correo o nombre de usuario. Devuelve { estado }.
  async solicitar(usuarioId, identificador) {
    const ident = String(identificador || '').trim()
    if (!ident) throw fallo(400, 'Escribe un correo o nombre de usuario')
    const objetivo = await usuariosRepo.buscarPorIdentificador(ident.toLowerCase(), ident)
    if (!objetivo) throw fallo(404, 'No se encontró un usuario con ese correo o nombre')
    if (objetivo.id === usuarioId) throw fallo(400, 'No puedes agregarte a ti mismo')

    const existente = await amigosRepo.relacionEntre(usuarioId, objetivo.id)
    if (existente) {
      if (existente.estado === 'aceptada') throw fallo(409, 'Ya son amigos')
      if (existente.solicitante_id === usuarioId)
        throw fallo(409, 'Ya enviaste una solicitud a este usuario')
      // El otro usuario ya te había enviado solicitud: se acepta automáticamente.
      await amigosRepo.aceptarPorId(existente.id)
      return { estado: 'aceptada' }
    }

    await amigosRepo.crearSolicitud(usuarioId, objetivo.id)
    return { estado: 'pendiente' }
  },

  async aceptar(usuarioId, amistadId) {
    const cambios = await amigosRepo.aceptarSolicitud(amistadId, usuarioId)
    if (cambios === 0) throw fallo(404, 'No existe la solicitud')
  },

  async eliminar(usuarioId, amistadId) {
    const cambios = await amigosRepo.borrar(amistadId, usuarioId)
    if (cambios === 0) throw fallo(404, 'No existe')
  },
}
