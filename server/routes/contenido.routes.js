// Rutas de contenido de estudio (protegidas, montadas en /api): carpetas,
// materias, temas, preguntas, búsqueda e import/export. Solo HTTP.
import express, { Router } from 'express'
import { ah } from './_wrap.js'
import { contenidoService, resolverContexto } from '../services/contenidoService.js'

const router = Router()

// El contexto (personal o grupo) llega por ?grupo= o body.grupoId.
const ctxRaw = (req) => req.query.grupo ?? req.body?.grupoId

// ----- Carpetas -----
router.get(
  '/carpetas',
  ah(async (req, res) => {
    const { grupoId } = await resolverContexto(req.usuarioId, ctxRaw(req))
    res.json({ carpetas: await contenidoService.listarCarpetas(req.usuarioId, grupoId) })
  }),
)

router.post(
  '/carpetas',
  ah(async (req, res) => {
    const { grupoId } = await resolverContexto(req.usuarioId, ctxRaw(req))
    res.json({ carpeta: await contenidoService.crearCarpeta(req.usuarioId, grupoId, req.body?.nombre) })
  }),
)

router.put(
  '/carpetas/orden',
  ah(async (req, res) => {
    await contenidoService.reordenarCarpetas(req.usuarioId, req.body?.ids)
    res.json({ ok: true })
  }),
)

// Importar una o varias carpetas NUEVAS (con sus materias).
router.post(
  '/carpetas/importar',
  ah(async (req, res) => {
    const { grupoId } = await resolverContexto(req.usuarioId, ctxRaw(req))
    res.json(await contenidoService.importarCarpetas(req.usuarioId, grupoId, req.body))
  }),
)

// Importar materias completas a una carpeta existente.
router.post(
  '/carpetas/:id/importar',
  ah(async (req, res) => {
    res.json(await contenidoService.importarAcarpeta(req.usuarioId, req.params.id, req.body))
  }),
)

router.get(
  '/carpetas/:id/export',
  ah(async (req, res) => {
    res.json(await contenidoService.exportarCarpeta(req.usuarioId, req.params.id))
  }),
)

router.patch(
  '/carpetas/:id',
  ah(async (req, res) => {
    res.json({ carpeta: await contenidoService.renombrarCarpeta(req.usuarioId, req.params.id, req.body?.nombre) })
  }),
)

router.delete(
  '/carpetas/:id',
  ah(async (req, res) => {
    await contenidoService.eliminarCarpeta(req.usuarioId, req.params.id)
    res.json({ ok: true })
  }),
)

// ----- Materias -----
router.get(
  '/materias',
  ah(async (req, res) => {
    const { grupoId } = await resolverContexto(req.usuarioId, ctxRaw(req))
    res.json({ materias: await contenidoService.catalogo(req.usuarioId, grupoId) })
  }),
)

router.post(
  '/materias',
  ah(async (req, res) => {
    const { grupoId } = await resolverContexto(req.usuarioId, ctxRaw(req))
    res.json({ materia: await contenidoService.crearMateria(req.usuarioId, grupoId, req.body || {}) })
  }),
)

router.put(
  '/materias/orden',
  ah(async (req, res) => {
    await contenidoService.reordenarMaterias(req.usuarioId, req.body?.ids)
    res.json({ ok: true })
  }),
)

router.get(
  '/materias/:id/export',
  ah(async (req, res) => {
    res.json(await contenidoService.exportarMateriaPorId(req.usuarioId, req.params.id))
  }),
)

router.patch(
  '/materias/:id',
  ah(async (req, res) => {
    res.json({ materia: await contenidoService.renombrarMateria(req.usuarioId, req.params.id, req.body || {}) })
  }),
)

router.delete(
  '/materias/:id',
  ah(async (req, res) => {
    await contenidoService.eliminarMateria(req.usuarioId, req.params.id)
    res.json({ ok: true })
  }),
)

// ----- Temas -----
router.post(
  '/temas',
  ah(async (req, res) => {
    res.json({ tema: await contenidoService.crearTema(req.usuarioId, req.body || {}) })
  }),
)

router.put(
  '/temas/orden',
  ah(async (req, res) => {
    await contenidoService.reordenarTemas(req.usuarioId, req.body?.materiaId, req.body?.ids)
    res.json({ ok: true })
  }),
)

router.get(
  '/temas/:id/preguntas',
  ah(async (req, res) => {
    res.json({ preguntas: await contenidoService.preguntasDeTema(req.usuarioId, req.params.id) })
  }),
)

router.post(
  '/temas/:id/preguntas',
  ah(async (req, res) => {
    res.json(await contenidoService.crearPregunta(req.usuarioId, req.params.id, req.body || {}))
  }),
)

// Importar desde archivo: el cuerpo es binario (no JSON) -> express.raw.
router.post(
  '/temas/:id/importar/analizar',
  express.raw({ type: () => true, limit: '25mb' }),
  ah(async (req, res) => {
    const { preguntas, errores } = await contenidoService.analizarArchivo(
      req.usuarioId,
      req.params.id,
      req.body,
      req.query.ext,
    )
    res.json({ preguntas, errores })
  }),
)

router.post(
  '/temas/:id/importar/confirmar',
  ah(async (req, res) => {
    res.json(await contenidoService.confirmarImportacion(req.usuarioId, req.params.id, req.body))
  }),
)

router.patch(
  '/temas/:id',
  ah(async (req, res) => {
    res.json({ tema: await contenidoService.renombrarTema(req.usuarioId, req.params.id, req.body || {}) })
  }),
)

router.delete(
  '/temas/:id',
  ah(async (req, res) => {
    await contenidoService.eliminarTema(req.usuarioId, req.params.id)
    res.json({ ok: true })
  }),
)

// ----- Preguntas -----
router.get(
  '/preguntas',
  ah(async (req, res) => {
    res.json({ preguntas: await contenidoService.preguntasParaQuiz(req.usuarioId, req.query.temas) })
  }),
)

router.patch(
  '/preguntas/:id',
  ah(async (req, res) => {
    await contenidoService.editarPregunta(req.usuarioId, req.params.id, req.body || {})
    res.json({ ok: true })
  }),
)

router.delete(
  '/preguntas/:id',
  ah(async (req, res) => {
    res.json(await contenidoService.eliminarPregunta(req.usuarioId, req.params.id))
  }),
)

// ----- Búsqueda -----
router.get(
  '/search',
  ah(async (req, res) => {
    res.json({ resultados: await contenidoService.buscar(req.usuarioId, req.query.q) })
  }),
)

// Exportar todo el banco personal como JSON descargable.
router.get(
  '/export',
  ah(async (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="cerebro-export.json"')
    res.json(await contenidoService.exportarBancoPersonal(req.usuarioId))
  }),
)

export default router
