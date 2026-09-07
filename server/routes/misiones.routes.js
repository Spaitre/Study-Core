// Rutas de misiones de bienvenida (protegidas, bajo /api/misiones).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { misionesService } from '../services/misionesService.js'

const router = Router()

router.get(
  '/',
  ah(async (req, res) => {
    res.json(await misionesService.resumen(req.usuarioId))
  }),
)

export default router
