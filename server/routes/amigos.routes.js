// Rutas de amigos (protegidas, bajo /api/amigos).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { amigosService } from '../services/amigosService.js'

const router = Router()

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ amigos: await amigosService.listar(req.usuarioId) })
  }),
)

router.get(
  '/solicitudes',
  ah(async (req, res) => {
    res.json({ solicitudes: await amigosService.solicitudes(req.usuarioId) })
  }),
)

router.get(
  '/enviadas',
  ah(async (req, res) => {
    res.json({ enviadas: await amigosService.enviadas(req.usuarioId) })
  }),
)

router.post(
  '/solicitar',
  ah(async (req, res) => {
    res.json(await amigosService.solicitar(req.usuarioId, req.body?.identificador))
  }),
)

router.post(
  '/:id/aceptar',
  ah(async (req, res) => {
    await amigosService.aceptar(req.usuarioId, req.params.id)
    res.json({ ok: true })
  }),
)

router.delete(
  '/:id',
  ah(async (req, res) => {
    await amigosService.eliminar(req.usuarioId, req.params.id)
    res.json({ ok: true })
  }),
)

export default router
