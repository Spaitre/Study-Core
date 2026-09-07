// Servicio de perfil: nombre de usuario (único, 1–20), foto (avatar o data
// URL) y marco de avatar equipado (cosmético ganado en cajas de regalo).
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { progresoRepo } from '../repositories/progresoRepo.js'
import { avataresRepo } from '../repositories/avataresRepo.js'
import { COSMETICOS } from './cosmeticosCatalogo.js'
import { AVATARES_BLOQUEADOS } from './avataresCatalogo.js'
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

  // Actualiza nombre, foto y/o marco equipado. Lanza ApiError en validación.
  // Devuelve el perfil.
  async actualizar(usuarioId, { nombreUsuario, foto, marco }) {
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
      } else if (AVATARES_BLOQUEADOS.includes(f)) {
        const propios = await avataresRepo.claves(usuarioId)
        if (!propios.includes(f)) throw fallo(403, 'Todavía no has desbloqueado ese avatar')
      }
      await usuariosRepo.actualizarFoto(usuarioId, f)
    }
    if (marco !== undefined) {
      if (marco !== null) {
        const def = COSMETICOS.find((c) => c.clave === marco && c.tipo === 'marco')
        if (!def) throw fallo(400, 'Marco inválido')
        const propios = await progresoRepo.clavesCosmeticos(usuarioId)
        if (!propios.includes(marco)) throw fallo(403, 'No has desbloqueado ese marco')
      }
      await usuariosRepo.actualizarMarco(usuarioId, marco)
    }
    return usuariosRepo.perfil(usuarioId)
  },
}
