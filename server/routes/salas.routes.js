// Rutas de salas multijugador (protegidas, bajo /api/salas).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { salasService } from '../services/salasService.js'

const router = Router()

router.post(
  '/',
  ah(async (req, res) => {
    res.json({ sala: await salasService.crear(req.usuarioId, req.body) })
  }),
)

router.post(
  '/unirse',
  ah(async (req, res) => {
    res.json({ sala: await salasService.unirse(req.usuarioId, req.body?.codigo) })
  }),
)

router.get(
  '/:codigo',
  ah(async (req, res) => {
    res.json({ sala: salasService.estado(req.usuarioId, req.params.codigo) })
  }),
)

router.post(
  '/:codigo/iniciar',
  ah(async (req, res) => {
    res.json({ sala: salasService.iniciar(req.usuarioId, req.params.codigo) })
  }),
)

router.post(
  '/:codigo/responder',
  ah(async (req, res) => {
    res.json(salasService.responder(req.usuarioId, req.params.codigo, req.body?.opcion))
  }),
)

router.post(
  '/:codigo/siguiente',
  ah(async (req, res) => {
    res.json({ sala: salasService.siguiente(req.usuarioId, req.params.codigo) })
  }),
)

router.post(
  '/:codigo/terminar',
  ah(async (req, res) => {
    res.json({ sala: salasService.terminar(req.usuarioId, req.params.codigo) })
  }),
)

router.post(
  '/:codigo/salir',
  ah(async (req, res) => {
    res.json(salasService.salir(req.usuarioId, req.params.codigo))
  }),
)

export default router
