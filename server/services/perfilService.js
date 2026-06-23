// Servicio de perfil: nombre de usuario (único, 1–20) y foto (avatar o data URL).
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { AVATARES } from './authService.js'
import { fallo } from './ApiError.js'

export const perfilService = {
  obtener(usuarioId) {
    return usuariosRepo.perfil(usuarioId)
  },

  // Chequeo en vivo de disponibilidad del nombre (excluyendo al propio usuario).
  async disponible(nombreRaw, usuarioId) {
    const nombre = String(nombreRaw || '').trim()
    if (nombre.length < 1 || nombre.length > 20) return { disponible: false, motivo: 'invalido' }
    const ocupado = await usuariosRepo.nombreTomado(nombre, usuarioId)
    return { disponible: !ocupado }
  },

  // Actualiza nombre y/o foto. Lanza ApiError en validación. Devuelve el perfil.
  async actualizar(usuarioId, { nombreUsuario, foto }) {
    if (nombreUsuario !== undefined) {
      const nombre = String(nombreUsuario).trim()
      if (nombre.length < 1 || nombre.length > 20)
        throw fallo(400, 'El nombre debe tener entre 1 y 20 caracteres')
      if (await usuariosRepo.nombreTomado(nombre, usuarioId))
        throw fallo(409, 'Ese nombre de usuario ya está en uso')
      await usuariosRepo.actualizarNombre(usuarioId, nombre)
    }
    if (foto !== undefined) {
      const f = String(foto)
      if (f.startsWith('data:image/')) {
        if (f.length > 1_500_000) throw fallo(400, 'La imagen es demasiado grande (máx ~1 MB)')
      } else if (!AVATARES.includes(f)) {
        throw fallo(400, 'Avatar inválido')
      }
      await usuariosRepo.actualizarFoto(usuarioId, f)
    }
    return usuariosRepo.perfil(usuarioId)
  },
}
