// Servicio de sesiones de estudio y estadísticas.
import { database } from '../db/index.js'
import { sesionesRepo } from '../repositories/sesionesRepo.js'
import { progresoService } from './progresoService.js'
import { misionesService } from './misionesService.js'
import { fallo } from './ApiError.js'

export const sesionesService = {
  // Guarda una sesión terminada con sus respuestas (en una transacción).
  async guardar(usuarioId, body) {
    const { materiaId = null, respuestas = [], origen = 'personal', materiaNombre = null } = body || {}
    if (!Array.isArray(respuestas) || respuestas.length === 0) throw fallo(400, 'respuestas vacías')
    const total = respuestas.length
    const aciertos = respuestas.filter((r) => r.correcta).length

    const { sesionId, progreso } = await database.withTransaction(async (tx) => {
      const id = await sesionesRepo.insertarSesion(
        new Date().toISOString(),
        materiaId,
        total,
        aciertos,
        usuarioId,
        origen === 'publico' ? 'publico' : 'personal',
        materiaNombre,
        tx,
      )
      for (const r of respuestas) {
        await sesionesRepo.insertarRespuesta(
          id,
          r.preguntaId ?? null,
          r.temaId ?? null,
          r.temaNombre ?? null,
          r.correcta ? 1 : 0,
          r.respondida ? 1 : 0,
          tx,
        )
      }
      const progreso = await progresoService.registrarActividad(usuarioId, aciertos, tx)
      const mision = await misionesService.progresar(usuarioId, 'primera_sesion', tx)
      return {
        sesionId: id,
        progreso: {
          ...progreso,
          misionXp: mision.xpGanado,
          avatarDesbloqueado: mision.avatarDesbloqueado,
        },
      }
    })
    return { id: Number(sesionId), total, aciertos, progreso }
  },

  // Estadísticas históricas agregadas del usuario.
  async stats(usuarioId) {
    const [global, porTema, recientes] = await Promise.all([
      sesionesRepo.statsGlobal(usuarioId),
      sesionesRepo.statsPorTema(usuarioId),
      sesionesRepo.sesionesRecientes(usuarioId),
    ])
    return { global, porTema, recientes }
  },
}
