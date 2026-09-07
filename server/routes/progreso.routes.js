// Rutas de progreso de gamificación: racha/XP/monedas y cajas de regalo
// (protegidas, montadas en /api).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { progresoService } from '../services/progresoService.js'

const router = Router()

router.get(
  '/progreso',
  ah(async (req, res) => {
    res.json(await progresoService.resumen(req.usuarioId))
  }),
)

router.post(
  '/cajas/:id/abrir',
  ah(async (req, res) => {
    res.json(await progresoService.abrirCaja(req.usuarioId, Number(req.params.id)))
  }),
)

export default router
