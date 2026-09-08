// Rutas del banco de contenido público (Comunidad, protegidas, bajo /api/comunidad).
import { Router } from 'express'
import { ah } from './_wrap.js'
import { contenidoPublicoService } from '../services/contenidoPublicoService.js'

const router = Router()

// El filtro de tipo llega como un solo query param con valores separados
// por coma (p. ej. ?tipo=materia,tema) porque es de selección múltiple.
function aLista(v) {
  return v
    ? String(v)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
}

router.get(
  '/contenido',
  ah(async (req, res) => {
    const { tipo, buscar } = req.query
    res.json({
      contenido: await contenidoPublicoService.listar(req.usuarioId, {
        tipo: aLista(tipo),
        buscar,
      }),
    })
  }),
)

router.get(
  '/contenido/:id',
  ah(async (req, res) => {
    res.json(await contenidoPublicoService.detalle(req.usuarioId, Number(req.params.id)))
  }),
)

router.get(
  '/contenido/:id/preguntas',
  ah(async (req, res) => {
    res.json({ preguntas: await contenidoPublicoService.preguntasParaQuiz(Number(req.params.id)) })
  }),
)

router.post(
  '/contenido',
  ah(async (req, res) => {
    res.json(await contenidoPublicoService.publicar(req.usuarioId, req.body))
  }),
)

router.post(
  '/contenido/:id/votar',
  ah(async (req, res) => {
    res.json(await contenidoPublicoService.votar(req.usuarioId, Number(req.params.id)))
  }),
)

router.post(
  '/contenido/:id/comentar',
  ah(async (req, res) => {
    res.json({
      comentarios: await contenidoPublicoService.comentar(req.usuarioId, Number(req.params.id), req.body?.texto),
    })
  }),
)

router.post(
  '/contenido/:id/reportar',
  ah(async (req, res) => {
    await contenidoPublicoService.reportar(req.usuarioId, Number(req.params.id), req.body?.motivo)
    res.json({ ok: true })
  }),
)

router.post(
  '/contenido/:id/importar',
  ah(async (req, res) => {
    res.json(await contenidoPublicoService.importar(req.usuarioId, Number(req.params.id), req.body))
  }),
)

// ----- Moderación (solo cuentas con es_admin) -----
router.get(
  '/moderacion',
  ah(async (req, res) => {
    res.json({ contenido: await contenidoPublicoService.colaModeracion(req.usuarioId) })
  }),
)

router.post(
  '/moderacion/:id/ocultar',
  ah(async (req, res) => {
    await contenidoPublicoService.ocultar(req.usuarioId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

router.post(
  '/moderacion/:id/descartar',
  ah(async (req, res) => {
    await contenidoPublicoService.descartarReportes(req.usuarioId, Number(req.params.id))
    res.json({ ok: true })
  }),
)

export default router
