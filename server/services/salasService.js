// Servicio de salas multijugador: hace las lecturas a BD (preguntas, perfil) y
// delega el estado en memoria a salasStore. La validación de acceso a las
// preguntas la garantiza contenidoRepo (filtra por usuario).
import { salasStore } from '../salas/salasStore.js'
import { contenidoRepo } from '../repositories/contenidoRepo.js'
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { fallo } from './ApiError.js'

export const salasService = {
  async crear(usuarioId, body) {
    const temas = Array.isArray(body?.temas) ? body.temas.map(String) : []
    const tiempo = [10, 20, 30, 60].includes(Number(body?.tiempo)) ? Number(body.tiempo) : 20
    const hostJuega = body?.hostJuega !== false // por defecto participa
    if (temas.length === 0) throw fallo(400, 'Elige al menos un tema')
    const temasRows = await contenidoRepo.preguntasOpcionDeTemas(temas, usuarioId)
    const hostPerfil = await usuariosRepo.perfil(usuarioId)
    return salasStore.crear({ hostId: usuarioId, hostPerfil, temasRows, tiempo, hostJuega })
  },

  async unirse(usuarioId, codigoRaw) {
    const codigo = String(codigoRaw || '').trim()
    if (!/^\d{5}$/.test(codigo)) throw fallo(400, 'El código debe tener 5 dígitos')
    const perfil = await usuariosRepo.perfil(usuarioId)
    return salasStore.unirse(codigo, usuarioId, perfil)
  },

  estado(usuarioId, codigo) {
    return salasStore.estado(codigo, usuarioId)
  },
  iniciar(usuarioId, codigo) {
    return salasStore.iniciar(codigo, usuarioId)
  },
  responder(usuarioId, codigo, opcion) {
    return salasStore.responder(codigo, usuarioId, opcion)
  },
  siguiente(usuarioId, codigo) {
    return salasStore.siguiente(codigo, usuarioId)
  },
  terminar(usuarioId, codigo) {
    return salasStore.terminar(codigo, usuarioId)
  },
  salir(usuarioId, codigo) {
    return salasStore.salir(codigo, usuarioId)
  },
}
