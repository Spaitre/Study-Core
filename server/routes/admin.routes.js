// Rutas de administrador (protegidas, bajo /api/admin; exigen es_admin).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { adminService } from '../services/adminService.js'

const router = Router()

router.get(
  '/estadisticas',
  ah(async (req, res) => {
    res.json(await adminService.estadisticas(req.usuarioId))
  }),
)

export default router
