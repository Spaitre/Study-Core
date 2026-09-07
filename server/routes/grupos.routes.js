// Rutas de grupos colaborativos (protegidas, bajo /api/grupos).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { gruposService } from '../services/gruposService.js'

const router = Router()

router.get(
  '/',
  ah(async (req, res) => {
    res.json({ grupos: await gruposService.listar(req.usuarioId) })
  }),
)

router.post(
  '/',
  ah(async (req, res) => {
    res.json({ grupo: await gruposService.crear(req.usuarioId, req.body || {}) })
  }),
)

router.post(
  '/unirse',
  ah(async (req, res) => {
    res.json({ grupo: await gruposService.unirse(req.usuarioId, req.body?.codigo) })
  }),
)

router.get(
  '/:id',
  ah(async (req, res) => {
    res.json({ grupo: await gruposService.detalle(req.usuarioId, Number(req.params.id)) })
  }),
)

router.patch(
  '/:id',
  ah(async (req, res) => {
    const grupo = await gruposService.editar(req.usuarioId, Number(req.params.id), req.body || {})
    res.json({ grupo })
  }),
)

router.delete(
  '/:id',
  ah(async (req, res) => {
    await gruposService.eliminar(req.usuarioId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

router.delete(
  '/:id/miembros/:uid',
  ah(async (req, res) => {
    await gruposService.quitarMiembro(req.usuarioId, Number(req.params.id), Number(req.params.uid))
    res.json({ ok: true })
  }),
)

router.post(
  '/:id/salir',
  ah(async (req, res) => {
    await gruposService.salir(req.usuarioId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

router.get(
  '/:id/estadisticas',
  ah(async (req, res) => {
    res.json(await gruposService.estadisticas(req.usuarioId, Number(req.params.id)))
  }),
)

router.get(
  '/:id/objetivos',
  ah(async (req, res) => {
    res.json({ objetivos: await gruposService.listarObjetivos(req.usuarioId, Number(req.params.id)) })
  }),
)

router.post(
  '/:id/objetivos',
  ah(async (req, res) => {
    res.json(await gruposService.crearObjetivo(req.usuarioId, Number(req.params.id), req.body || {}))
  }),
)

router.delete(
  '/:id/objetivos/:oid',
  ah(async (req, res) => {
    await gruposService.borrarObjetivo(req.usuarioId, Number(req.params.id), Number(req.params.oid))
    res.json({ ok: true })
  }),
)

export default router
