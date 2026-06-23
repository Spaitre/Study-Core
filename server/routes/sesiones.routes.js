// Rutas de sesiones de estudio y estadísticas (protegidas, montadas en /api).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { sesionesService } from '../services/sesionesService.js'

const router = Router()

router.post(
  '/sesiones',
  ah(async (req, res) => {
    res.json(await sesionesService.guardar(req.usuarioId, req.body))
  }),
)

router.get(
  '/stats',
  ah(async (req, res) => {
    res.json(await sesionesService.stats(req.usuarioId))
  }),
)

export default router
