// Servicio de misiones de bienvenida: avanza el progreso, otorga XP y, al
// completar las 3, desbloquea un avatar de regalo.
import { database } from '../db/index.js'
import { misionesRepo } from '../repositories/misionesRepo.js'
import { avataresRepo } from '../repositories/avataresRepo.js'
import { progresoRepo } from '../repositories/progresoRepo.js'
import { MISIONES, RECOMPENSA_FINAL_AVATAR } from './misionesCatalogo.js'

export const misionesService = {
  // Se llama desde el punto donde ocurre la acción (crear pregunta, guardar
  // sesión, aceptar amistad). Idempotente: si la misión ya estaba completada
  // no vuelve a dar XP. `tx` es opcional, para engancharse a una transacción
  // que ya esté en curso (p. ej. al guardar una sesión).
  //
  // Devuelve { esNueva, xpGanado, avatarDesbloqueado } para que quien llama
  // pueda mostrar un aviso en el momento exacto (el resumen por sí solo no
  // distingue "ya lo tenía" de "lo acabo de ganar").
  async progresar(usuarioId, clave, tx) {
    const exec = tx || database
    const vacio = { esNueva: false, xpGanado: 0, avatarDesbloqueado: null }
    const ahora = new Date().toISOString()
    const esNueva = await misionesRepo.marcarCompletada(usuarioId, clave, ahora, exec)
    if (!esNueva) return vacio

    const mision = MISIONES.find((m) => m.clave === clave)
    if (mision) {
      await progresoRepo.asegurarFila(usuarioId, exec)
      await progresoRepo.sumarXp(usuarioId, mision.xp, exec)
    }

    const completadas = await misionesRepo.completadas(usuarioId, exec)
    const todasCompletas = MISIONES.every((m) => completadas.includes(m.clave))
    let avatarDesbloqueado = null
    if (todasCompletas) {
      const info = await avataresRepo.otorgar(usuarioId, RECOMPENSA_FINAL_AVATAR, ahora, exec)
      if (info.changes > 0) avatarDesbloqueado = RECOMPENSA_FINAL_AVATAR
    }
    return { esNueva: true, xpGanado: mision?.xp || 0, avatarDesbloqueado }
  },

  async resumen(usuarioId) {
    const [completadas, avatares] = await Promise.all([
      misionesRepo.completadas(usuarioId),
      avataresRepo.claves(usuarioId),
    ])
    return {
      misiones: MISIONES.map((m) => ({ ...m, completada: completadas.includes(m.clave) })),
      avatarRecompensa: RECOMPENSA_FINAL_AVATAR,
      avatarDesbloqueado: avatares.includes(RECOMPENSA_FINAL_AVATAR),
      avataresDesbloqueados: avatares,
    }
  },
}
