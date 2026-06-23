// Rutas de proyectos colaborativos (protegidas, bajo /api/proyectos).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { proyectosService } from '../services/proyectosService.js'

const router = Router()

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ proyectos: await proyectosService.listar(req.usuarioId) })
  }),
)

router.post(
  '/',
  ah(async (req, res) => {
    res.json({ proyecto: await proyectosService.crear(req.usuarioId, req.body || {}) })
  }),
)

router.post(
  '/unirse',
  ah(async (req, res) => {
    res.json({ proyecto: await proyectosService.unirse(req.usuarioId, req.body?.codigo) })
  }),
)

router.get(
  '/:id',
  ah(async (req, res) => {
    res.json({ proyecto: await proyectosService.detalle(req.usuarioId, Number(req.params.id)) })
  }),
)

router.patch(
  '/:id',
  ah(async (req, res) => {
    const proyecto = await proyectosService.editar(req.usuarioId, Number(req.params.id), req.body || {})
    res.json({ proyecto })
  }),
)

router.delete(
  '/:id',
  ah(async (req, res) => {
    await proyectosService.eliminar(req.usuarioId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

router.delete(
  '/:id/miembros/:uid',
  ah(async (req, res) => {
    await proyectosService.quitarMiembro(req.usuarioId, Number(req.params.id), Number(req.params.uid))
    res.json({ ok: true })
  }),
)

router.post(
  '/:id/salir',
  ah(async (req, res) => {
    await proyectosService.salir(req.usuarioId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

export default router
