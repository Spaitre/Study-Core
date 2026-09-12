// Servicio del banco de contenido público (Comunidad): publicar una materia
// o carpeta completa (con sus temas/preguntas) como instantánea, listarlas
// con filtros, votar, comentar, importar a la cuenta propia y moderar.
import { contenidoPublicoRepo } from '../repositories/contenidoPublicoRepo.js'
import { contenidoRepo } from '../repositories/contenidoRepo.js'
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { contenidoService, barajarOpciones } from './contenidoService.js'
import { fallo } from './ApiError.js'

// Publicar exige ser el DUEÑO del contenido, no solo tener acceso a él: un
// miembro de un grupo puede ver/usar lo que comparten sus compañeros
// (materiaAccesible/carpetaAccesible/temaAccesible lo permiten para eso),
// pero publicarlo al banco público a nombre propio es otra cosa.
async function exigirDueno(fila, usuarioId, mensajeNoEncontrado) {
  if (!fila) throw fallo(404, mensajeNoEncontrado)
  if (fila.usuario_id !== usuarioId) throw fallo(403, 'Solo puedes publicar contenido propio')
}

async function exigirAdmin(usuarioId) {
  if (!(await usuariosRepo.esAdmin(usuarioId))) throw fallo(403, 'No tienes permiso de moderación')
}

// Recorre el snapshot exportado y extrae las facetas para filtrar/mostrar:
// nombres de materia, nombres de tema, dificultades y categorías de caso
// clínico presentes, más los totales.
function analizar(materias) {
  const setMaterias = new Set()
  const setTemas = new Set()
  const setDificultades = new Set()
  const setCategorias = new Set()
  let totalTemas = 0
  let totalPreguntas = 0
  for (const m of materias) {
    if (m.nombre) setMaterias.add(m.nombre)
    for (const t of m.temas || []) {
      totalTemas++
      if (t.nombre) setTemas.add(t.nombre)
      for (const p of t.preguntas || []) {
        totalPreguntas++
        if (p.dificultad) setDificultades.add(p.dificultad)
        if (p.temaCategoria) setCategorias.add(p.temaCategoria)
      }
    }
  }
  return {
    materias: [...setMaterias],
    temas: [...setTemas],
    dificultades: [...setDificultades],
    categorias: [...setCategorias],
    totalTemas,
    totalPreguntas,
  }
}

function paraCliente(fila) {
  return {
    ...fila,
    materias: JSON.parse(fila.materiasJson),
    temas: JSON.parse(fila.temasJson),
    dificultades: JSON.parse(fila.dificultadesJson),
    categorias: JSON.parse(fila.categoriasJson),
    haVotado: !!fila.haVotado,
    materiasJson: undefined,
    temasJson: undefined,
    dificultadesJson: undefined,
    categoriasJson: undefined,
  }
}

// ¿La fila cumple los filtros activos? Solo tipo (selección múltiple) y
// texto de búsqueda: los filtros son fijos, no varían según lo publicado.
function cumpleFiltros(item, f) {
  if (f.tipo?.length && !f.tipo.includes(item.tipo)) return false
  if (f.buscar) {
    const q = f.buscar.toLowerCase()
    const enTexto = item.nombre.toLowerCase().includes(q) || (item.descripcion || '').toLowerCase().includes(q)
    const enMaterias = item.materias.some((m) => m.toLowerCase().includes(q))
    if (!enTexto && !enMaterias) return false
  }
  return true
}

export const contenidoPublicoService = {
  async listar(usuarioId, filtros = {}) {
    const filas = (await contenidoPublicoRepo.listarVisibles(usuarioId)).map(paraCliente)
    return filas.filter((f) => cumpleFiltros(f, filtros))
  },

  async detalle(usuarioId, id) {
    const fila = await contenidoPublicoRepo.obtenerConVotos(id, usuarioId)
    if (!fila) throw fallo(404, 'No encontrado')
    const comentarios = await contenidoPublicoRepo.comentarios(id)
    return { ...paraCliente(fila), datos: JSON.parse(fila.datosJson), comentarios }
  },

  // Arma las preguntas para jugar este contenido AHORA MISMO, sin
  // importarlo antes a la cuenta propia: lee la instantánea publicada
  // (mismo formato que exportar/importar) y la aplana a la forma que espera
  // QuizScreen, barajando opciones igual que el banco personal.
  async preguntasParaQuiz(id) {
    const fila = await contenidoPublicoRepo.obtener(id)
    if (!fila || fila.estado !== 'visible') throw fallo(404, 'No encontrado')
    const datos = JSON.parse(fila.datos_json)
    const preguntas = []
    for (const m of datos.materias || []) {
      for (const t of m.temas || []) {
        for (const p of t.preguntas || []) {
          preguntas.push({
            id: `pub-${id}-${preguntas.length}`,
            pregunta: p.pregunta,
            opciones: p.opciones,
            respuestaCorrecta: p.respuestaCorrecta,
            explicacion: p.explicacion,
            tipo: p.tipo,
            temaId: t.id,
            temaNombre: t.nombre,
            materiaNombre: m.nombre,
            imagen: p.imagen || null,
          })
        }
      }
    }
    return preguntas.map(barajarOpciones)
  },

  async publicar(usuarioId, body) {
    const tipo = ['materia', 'carpeta', 'tema'].includes(body?.tipo) ? body.tipo : null
    if (!tipo) throw fallo(400, 'tipo debe ser "materia", "carpeta" o "tema"')
    const origenId = String(body?.origenId || '').trim()
    if (!origenId) throw fallo(400, 'Falta el origen a publicar')
    const descripcion = body?.descripcion ? String(body.descripcion).trim().slice(0, 500) || null : null

    let datos, nombre, icono
    if (tipo === 'materia') {
      await exigirDueno(await contenidoRepo.materiaAccesible(origenId, usuarioId), usuarioId, 'La materia no existe')
      datos = await contenidoService.exportarMateriaPorId(usuarioId, origenId)
      nombre = datos.materias[0]?.nombre || 'Materia'
      icono = datos.materias[0]?.icono || null
    } else if (tipo === 'tema') {
      await exigirDueno(await contenidoRepo.temaAccesible(origenId, usuarioId), usuarioId, 'El tema no existe')
      datos = await contenidoService.exportarTemaPorId(usuarioId, origenId)
      nombre = datos.materias[0]?.temas[0]?.nombre || 'Tema'
      icono = null
    } else {
      await exigirDueno(await contenidoRepo.carpetaAccesible(origenId, usuarioId), usuarioId, 'La carpeta no existe')
      datos = await contenidoService.exportarCarpeta(usuarioId, origenId)
      nombre = datos.carpeta || 'Carpeta'
      icono = null
    }
    const facetas = analizar(datos.materias)
    if (facetas.totalPreguntas === 0) throw fallo(400, 'No hay preguntas que publicar ahí')

    const id = await contenidoPublicoRepo.crear(usuarioId, {
      tipo,
      nombre,
      icono,
      descripcion,
      datos,
      materias: facetas.materias,
      temas: facetas.temas,
      dificultades: facetas.dificultades,
      categorias: facetas.categorias,
      totalTemas: facetas.totalTemas,
      totalPreguntas: facetas.totalPreguntas,
    })
    return this.detalle(usuarioId, id)
  },

  async votar(usuarioId, id) {
    const fila = await contenidoPublicoRepo.obtener(id)
    if (!fila || fila.estado !== 'visible') throw fallo(404, 'No encontrado')
    const yaVoto = await contenidoPublicoRepo.votoExiste(id, usuarioId)
    if (yaVoto) await contenidoPublicoRepo.quitarVoto(id, usuarioId)
    else await contenidoPublicoRepo.votar(id, usuarioId)
    return { votado: !yaVoto }
  },

  async comentar(usuarioId, id, texto) {
    const t = String(texto || '').trim()
    if (!t) throw fallo(400, 'El comentario está vacío')
    if (t.length > 500) throw fallo(400, 'Máximo 500 caracteres')
    const fila = await contenidoPublicoRepo.obtener(id)
    if (!fila || fila.estado !== 'visible') throw fallo(404, 'No encontrado')
    await contenidoPublicoRepo.comentar(id, usuarioId, t)
    return contenidoPublicoRepo.comentarios(id)
  },

  async reportar(usuarioId, id, motivo) {
    const fila = await contenidoPublicoRepo.obtener(id)
    if (!fila || fila.estado !== 'visible') throw fallo(404, 'No encontrado')
    await contenidoPublicoRepo.reportar(id, usuarioId, motivo ? String(motivo).trim().slice(0, 200) : null)
  },

  // Copia el snapshot publicado a la cuenta del usuario. Una materia o un
  // tema se agregan a una carpeta propia existente; una carpeta se importa
  // completa como carpeta nueva.
  async importar(usuarioId, id, body) {
    const fila = await contenidoPublicoRepo.obtener(id)
    if (!fila || fila.estado !== 'visible') throw fallo(404, 'No encontrado')
    const datos = JSON.parse(fila.datos_json)
    if (fila.tipo === 'carpeta') {
      return contenidoService.importarCarpetas(usuarioId, null, datos)
    }
    const carpetaDestinoId = String(body?.carpetaDestinoId || '').trim()
    if (!carpetaDestinoId) throw fallo(400, 'Elige a qué carpeta agregarla')
    return contenidoService.importarAcarpeta(usuarioId, carpetaDestinoId, datos)
  },

  async colaModeracion(usuarioId) {
    await exigirAdmin(usuarioId)
    return contenidoPublicoRepo.reportados()
  },
  async ocultar(usuarioId, id) {
    await exigirAdmin(usuarioId)
    await contenidoPublicoRepo.ocultar(id)
  },
  async descartarReportes(usuarioId, id) {
    await exigirAdmin(usuarioId)
    await contenidoPublicoRepo.descartarReportes(id)
  },
}
