// Rutas de perfil (protegidas, bajo /api/perfil).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { perfilService } from '../services/perfilService.js'

const router = Router()

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ perfil: await perfilService.obtener(req.usuarioId) })
  }),
)

// Comprobar en tiempo real si un nombre de usuario está disponible.
router.get(
  '/disponible',
  ah(async (req, res) => {
    res.json(await perfilService.disponible(req.query.nombre, req.usuarioId))
  }),
)

router.patch(
  '/',
  ah(async (req, res) => {
    const perfil = await perfilService.actualizar(req.usuarioId, {
      nombreUsuario: req.body?.nombreUsuario,
      foto: req.body?.foto,
    })
    res.json({ perfil })
  }),
)

export default router
