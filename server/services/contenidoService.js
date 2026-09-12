// Servicio de contenido de estudio: carpetas, materias, temas y preguntas,
// más import/export JSON. Resuelve contexto (personal/grupo) y permisos,
// y orquesta las transacciones; el SQL vive en contenidoRepo.
import crypto from 'node:crypto'
import { database } from '../db/index.js'
import { contenidoRepo } from '../repositories/contenidoRepo.js'
import { esMiembro, puedeEditarGrupo } from './gruposService.js'
import { misionesService } from './misionesService.js'
import { extraerTexto, extraerNotasHtml, sanitizarNotasHtml, FORMATOS_SOPORTADOS } from '../importar/extraer.js'
import { parsearPreguntas } from '../importar/parsear.js'
import { fallo } from './ApiError.js'

// ----- Utilidades puras -----
function slugify(texto) {
  return (
    texto
      .normalize('NFD')
      .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '') // quita acentos
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  )
}

function preguntaHash(temaId, pregunta) {
  const normal = pregunta.trim().replace(/\s+/g, ' ').toLowerCase()
  return crypto.createHash('sha256').update(`${temaId}::${normal}`).digest('hex')
}

// Emoji por defecto cuando el nombre no sugiere ninguno.
const EMOJI_MATERIA_DEFECTO = '📚'

// Palabras clave → emoji para inferir el icono de una materia por su nombre.
// Orden importa: lo más específico/compuesto primero (se devuelve el 1er match).
// Las claves van sin acentos y en minúsculas (se comparan contra slugify).
// Clave de una sola palabra: coincide si ALGUNA palabra del nombre empieza por
// ella (prefijo). Clave con espacio: coincide como subcadena del nombre.
const EMOJI_MATERIA = [
  // Compuestas (antes que las genéricas que contienen)
  ['educacion fisica', '⚽'],
  ['salud publica', '📊'], ['salud mental', '🧠'], ['salud ocupacional', '🦺'],
  ['ciencias sociales', '🌍'], ['medio ambiente', '🌱'], ['bellas artes', '🎨'],
  ['base de datos', '🗄️'], ['medicina interna', '🩺'], ['medicina general', '🩺'],
  ['inteligencia artificial', '🤖'], ['seguridad informatica', '🔒'],

  // Medicina
  ['cardio', '❤️'], ['corazon', '❤️'], ['vascular', '❤️'],
  ['neumolog', '🫁'], ['pulmon', '🫁'], ['respirat', '🫁'],
  ['neuro', '🧠'], ['cerebro', '🧠'], ['psiqui', '🧠'], ['psicolog', '🧠'],
  ['trauma', '🦴'], ['ortoped', '🦴'], ['hueso', '🦴'], ['musculoesquelet', '🦴'], ['reumatolog', '🦴'],
  ['hematolog', '🩸'], ['sangre', '🩸'], ['transfusion', '🩸'],
  ['odontolog', '🦷'], ['estomatolog', '🦷'], ['dental', '🦷'], ['diente', '🦷'], ['endodon', '🦷'],
  ['oftalmolog', '👁️'], ['vision', '👁️'], ['optometr', '👁️'],
  ['otorrino', '👂'], ['audiolog', '👂'],
  ['dermatolog', '🧴'],
  ['nefrolog', '🫘'], ['urolog', '🫘'], ['rinon', '🫘'],
  ['microbiolog', '🦠'], ['bacteriolog', '🦠'], ['virolog', '🦠'], ['virus', '🦠'],
  ['infectolog', '🦠'], ['infeccios', '🦠'], ['parasitolog', '🦠'], ['micolog', '🦠'],
  ['inmunolog', '🛡️'], ['inmune', '🛡️'], ['alergolog', '🤧'],
  ['farmacolog', '💊'], ['farmac', '💊'], ['medicament', '💊'], ['toxicolog', '☠️'],
  ['pediatr', '🧒'], ['neonatolog', '🍼'], ['geriatr', '👴'], ['gerontolog', '👴'],
  ['ginecolog', '🤰'], ['obstetr', '🤰'], ['embaraz', '🤰'],
  ['radiolog', '🩻'], ['imagenolog', '🩻'],
  ['cirug', '🔪'], ['quirurg', '🔪'], ['anestesi', '💉'], ['vacun', '💉'], ['enfermeri', '🩺'],
  ['oncolog', '🎗️'],
  ['bioquimic', '🧪'], ['biofisic', '⚛️'], ['genetic', '🧬'], ['embriolog', '🧬'],
  ['histolog', '🔬'], ['patolog', '🔬'], ['citolog', '🔬'], ['laboratori', '🔬'],
  ['propedeutic', '🩺'], ['semiolog', '🩺'], ['clinic', '🩺'],
  ['endocrin', '🧪'], ['hormon', '🧪'], ['diabet', '🩸'],
  ['anatomi', '🫀'], ['fisiolog', '🫀'],
  ['nutri', '🥗'], ['dietet', '🥗'],
  ['epidemiolog', '📊'], ['bioestad', '📊'],
  ['bioetica', '⚖️'], ['etica', '⚖️'],
  ['urgenci', '🚑'], ['emergenci', '🚑'], ['veterinari', '🐾'],

  // Ciencias exactas y naturales
  ['matematic', '🔢'], ['calculo', '🔢'], ['algebra', '🔢'], ['aritmet', '🔢'],
  ['geometr', '📐'], ['trigonometr', '📐'],
  ['estadist', '📊'], ['probabilidad', '🎲'],
  ['fisica', '⚛️'], ['quimic', '🧪'],
  ['biolog', '🧬'], ['botanic', '🌿'], ['zoolog', '🦁'],
  ['ecolog', '🌱'], ['ambient', '🌱'], ['agronom', '🌾'], ['agricultur', '🌾'],
  ['astronom', '🔭'],
  ['geolog', '🪨'], ['geografi', '🌍'], ['meteorolog', '🌦️'], ['climatolog', '🌦️'], ['oceanograf', '🌊'],

  // Humanidades y sociales
  ['historia', '📜'], ['histor', '📜'],
  ['filosofi', '🤔'], ['logica', '🧩'],
  ['literatura', '📖'], ['lengua', '📖'], ['gramatica', '📖'], ['ortograf', '📖'],
  ['espanol', '📖'], ['lectura', '📖'], ['redacc', '✍️'], ['caligraf', '✍️'],
  ['idioma', '🗣️'], ['ingles', '🗣️'], ['frances', '🗣️'], ['aleman', '🗣️'],
  ['italiano', '🗣️'], ['portugues', '🗣️'], ['linguist', '🗣️'],
  ['antropolog', '🗿'], ['arqueolog', '🏺'], ['sociolog', '🌍'],
  ['civismo', '🏛️'], ['politic', '🏛️'], ['gobierno', '🏛️'],
  ['derecho', '⚖️'], ['juridic', '⚖️'], ['legislac', '⚖️'],
  ['religion', '🙏'], ['teolog', '🙏'],
  ['economi', '💰'], ['finanz', '💰'], ['contab', '💰'], ['contadur', '💰'],
  ['administrac', '💼'], ['negocio', '💼'], ['mercadotecnia', '📣'], ['marketing', '📣'], ['publicidad', '📣'],

  // Artes, oficios y tecnología
  ['musica', '🎵'], ['dibujo', '🎨'], ['pintura', '🎨'], ['diseno', '🎨'],
  ['teatro', '🎭'], ['danza', '💃'], ['baile', '💃'],
  ['cinematograf', '🎬'], ['audiovisual', '🎬'], ['fotograf', '📷'],
  ['gastronom', '🍳'], ['cocina', '🍳'], ['reposteria', '🧁'],
  ['deporte', '⚽'], ['futbol', '⚽'],
  ['informatic', '💻'], ['computac', '💻'], ['programac', '💻'], ['software', '💻'], ['codigo', '💻'],
  ['robotic', '🤖'], ['electr', '⚡'], ['mecanic', '⚙️'], ['arquitectur', '🏛️'], ['ingenieri', '🛠️'],
  ['redes', '🌐'], ['datos', '🗄️'],

  ['ciencia', '🔬'],
]

// Infiere un emoji a partir del nombre de la materia; 📚 si nada concuerda.
function emojiParaMateria(nombre) {
  const tokens = slugify(nombre).split('-').filter(Boolean)
  const completo = tokens.join(' ')
  for (const [clave, emoji] of EMOJI_MATERIA) {
    // El nombre puede traer la palabra completa ("Dermatología") o una
    // abreviación ("Derma") — se compara en ambos sentidos. La abreviación
    // exige mínimo 4 letras para no matchear con cualquier prefijo cortito.
    const coincide = clave.includes(' ')
      ? completo.includes(clave)
      : tokens.some((t) => t.startsWith(clave) || (t.length >= 4 && clave.startsWith(t)))
    if (coincide) return emoji
  }
  return EMOJI_MATERIA_DEFECTO
}

function rowToPregunta(r) {
  return {
    id: r.id,
    pregunta: r.pregunta,
    opciones: JSON.parse(r.opciones),
    respuestaCorrecta: r.respuesta_correcta,
    explicacion: r.explicacion,
    tipo: r.tipo,
    temaId: r.tema_id,
    temaNombre: r.tema_nombre,
    materiaNombre: r.materia_nombre,
    imagen: r.imagen || null,
  }
}

// Baraja (Fisher-Yates) las opciones y reubica el índice de la respuesta correcta.
function barajarOpciones(p) {
  const textoCorrecto = p.opciones[p.respuestaCorrecta]
  const opciones = [...p.opciones]
  for (let i = opciones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[opciones[i], opciones[j]] = [opciones[j], opciones[i]]
  }
  return { ...p, opciones, respuestaCorrecta: opciones.indexOf(textoCorrecto) }
}

function textoOpcional(v) {
  const s = v != null ? String(v).trim() : ''
  return s || null
}

function normalizarPregunta(p) {
  const tipo = p?.tipo === 'flashcard' ? 'flashcard' : 'opcion'
  const pregunta = String(p?.pregunta || '').trim()
  const opciones = Array.isArray(p?.opciones) ? p.opciones.map((o) => String(o)) : []
  const rc = Number.isInteger(p?.respuestaCorrecta) ? p.respuestaCorrecta : tipo === 'flashcard' ? -1 : 0
  const explicacion = p?.explicacion != null ? String(p.explicacion) : null
  // Metadatos de caso clínico / flashcard: opcionales para ambos tipos.
  const materiaCaso = textoOpcional(p?.materiaCaso)
  const temaCategoria = textoOpcional(p?.temaCategoria)
  const dificultad = textoOpcional(p?.dificultad)
  // Imagen opcional (radiografía, ECG, foto clínica...): el navegador ya la
  // redimensiona/comprime antes de mandarla (ver src/imagenes.js).
  const imagen = typeof p?.imagen === 'string' && p.imagen ? p.imagen : null
  return { tipo, pregunta, opciones, rc, explicacion, materiaCaso, temaCategoria, dificultad, imagen }
}

// Tope de seguridad del lado del servidor sobre el tamaño de la imagen ya
// codificada en base64 (el navegador la comprime antes de subir; esto es
// solo una segunda barrera, no el control principal de tamaño).
const IMAGEN_MAX_BYTES = 2_000_000

// Tope del archivo de apuntes que se sube por tema (antes de extraer texto).
const NOTAS_MAX_BYTES = 5_000_000

// Los apuntes solo aceptan Word/TXT: a diferencia del import de preguntas,
// aquí el PDF no aporta (no conserva formato) y complica la validación.
const NOTAS_FORMATOS_SOPORTADOS = ['.docx', '.txt']

// Tope de las notas que llegan ya como HTML dentro de un JSON de import
// (export propio, carpeta compartida o contenido de Comunidad) — generoso
// porque el HTML de mammoth pesa más que el .docx original, pero acotado
// para no aceptar cualquier cosa de un archivo editado a mano.
const NOTAS_HTML_MAX_BYTES = 8_000_000

function validarPregunta(d) {
  if (!d.pregunta) return 'Falta el enunciado'
  if (d.tipo === 'opcion' && d.opciones.filter((o) => o.trim()).length < 2)
    return 'Se necesitan al menos 2 opciones con texto'
  if (d.tipo === 'flashcard' && !d.explicacion) return 'Falta el reverso de la flashcard'
  if (d.imagen && !d.imagen.startsWith('data:image/')) return 'La imagen no es válida'
  if (d.imagen && d.imagen.length > IMAGEN_MAX_BYTES) return 'La imagen es demasiado pesada'
  return null
}

export { preguntaHash, barajarOpciones }

// ----- Contexto y permisos -----
// Resuelve el contexto (personal o grupo) desde ?grupo= / body.grupoId.
// Lanza 403 si el grupo existe pero el usuario no es miembro.
export async function resolverContexto(usuarioId, raw) {
  if (raw === undefined || raw === null || raw === '') return { grupoId: null }
  const pid = Number(raw)
  if (!Number.isInteger(pid) || !(await esMiembro(pid, usuarioId)))
    throw fallo(403, 'No tienes acceso a ese grupo')
  return { grupoId: pid }
}

// Lanza 403 si el contenido pertenece a un grupo sin permiso de edición.
async function exigirEdicion(grupoId, usuarioId) {
  if (grupoId && !(await puedeEditarGrupo(grupoId, usuarioId)))
    throw fallo(403, 'No tienes permiso para modificar este grupo')
}

// ----- Importación JSON (compartida) -----
function materiasDesde(body) {
  let materias = body?.materias ?? body
  if (!Array.isArray(materias)) materias = materias ? [materias] : []
  return materias.filter((m) => m && String(m.nombre || '').trim())
}

// Inserta materias (con temas y preguntas) en una carpeta, dentro de la
// transacción `tx`. Devuelve los conteos insertados.
async function insertarMaterias(carpeta, materias, usuarioId, tx) {
  const grupoId = carpeta.grupo_id
  let nMaterias = 0
  let nTemas = 0
  let nPreguntas = 0
  for (const m of materias) {
    const nombre = String(m.nombre).trim()
    const icono = String(m.icono || '').trim() || '📚'
    const pos = await contenidoRepo.maxPosMateria(grupoId, usuarioId, tx)
    const matId = await contenidoRepo.idUnico(slugify(nombre), 'materias', tx)
    await contenidoRepo.insertarMateria(matId, nombre, icono, pos, carpeta.id, usuarioId, grupoId, tx)
    nMaterias++
    const temas = Array.isArray(m.temas) ? m.temas : []
    let posTema = 0
    for (const t of temas) {
      const tNombre = String(t?.nombre || '').trim()
      if (!tNombre) continue
      const temaId = await contenidoRepo.idUnico(`${matId}-${slugify(tNombre)}`, 'temas', tx)
      await contenidoRepo.insertarTema(temaId, matId, tNombre, ++posTema, tx)
      nTemas++
      // Los apuntes solo viajan si quien exportó/publicó eligió incluirlos
      // (ver exportarMateria/exportarTemaPorId); se re-sanean igual que si
      // vinieran de un .docx propio, porque este JSON pudo ser editado a mano.
      if (typeof t.notasHtml === 'string' && t.notasHtml.trim() && t.notasHtml.length <= NOTAS_HTML_MAX_BYTES) {
        const notasNombre = String(t.notasNombre || 'Apuntes').trim().slice(0, 150) || 'Apuntes'
        await contenidoRepo.actualizarNotasTema(temaId, sanitizarNotasHtml(t.notasHtml), notasNombre, tx)
      }
      const preguntas = Array.isArray(t.preguntas) ? t.preguntas : []
      for (const p of preguntas) {
        const enun = String(p?.pregunta || '').trim()
        if (!enun) continue
        const opciones = Array.isArray(p.opciones) ? p.opciones.map(String) : []
        const tipo = opciones.length >= 2 ? 'opcion' : 'flashcard'
        const explicacion = p.explicacion != null ? String(p.explicacion) : null
        if (tipo === 'flashcard' && !explicacion) continue
        const rc = tipo === 'flashcard' ? -1 : Number.isInteger(p.respuestaCorrecta) ? p.respuestaCorrecta : 0
        const imagen =
          typeof p.imagen === 'string' && p.imagen.startsWith('data:image/') && p.imagen.length <= IMAGEN_MAX_BYTES
            ? p.imagen
            : null
        nPreguntas += await contenidoRepo.insertarPreguntaImport(
          temaId,
          enun,
          JSON.stringify(opciones),
          rc,
          explicacion,
          preguntaHash(temaId, enun),
          tipo,
          textoOpcional(p.materiaCaso),
          textoOpcional(p.temaCategoria),
          textoOpcional(p.dificultad),
          imagen,
          tx,
        )
      }
    }
  }
  return { materias: nMaterias, temas: nTemas, preguntas: nPreguntas }
}

// Forma de exportación de una materia (con temas y preguntas). Los apuntes
// de cada tema solo se incluyen si `incluirNotas` es true (el usuario lo
// eligió explícitamente al exportar/publicar; ver contenidoPublicoService y
// las rutas de export en contenido.routes.js).
async function exportarMateria(m, incluirNotas = false) {
  const temas = await contenidoRepo.temasDeMateriaSimple(m.id)
  return {
    id: m.id,
    nombre: m.nombre,
    icono: m.icono,
    temas: await Promise.all(
      temas.map(async (t) => ({
        id: t.id,
        nombre: t.nombre,
        ...(incluirNotas && t.notas_html
          ? { notasHtml: t.notas_html, notasNombre: t.notas_nombre }
          : {}),
        preguntas: (await contenidoRepo.preguntasParaExport(t.id)).map((p) => ({
          pregunta: p.pregunta,
          opciones: JSON.parse(p.opciones),
          respuestaCorrecta: p.respuesta_correcta,
          explicacion: p.explicacion,
          tipo: p.tipo,
          materiaCaso: p.materia_caso,
          temaCategoria: p.tema_categoria,
          dificultad: p.dificultad,
          imagen: p.imagen || null,
        })),
      })),
    ),
  }
}

export const contenidoService = {
  // ----- Carpetas -----
  async listarCarpetas(usuarioId, grupoId) {
    return grupoId
      ? contenidoRepo.carpetasGrupo(grupoId)
      : contenidoRepo.carpetasPersonal(usuarioId)
  },

  async crearCarpeta(usuarioId, grupoId, nombreRaw) {
    await exigirEdicion(grupoId, usuarioId)
    const nombre = String(nombreRaw || '').trim()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    const id = await contenidoRepo.idUnico('carpeta-' + slugify(nombre), 'carpetas')
    const pos = await contenidoRepo.maxPosCarpeta(grupoId, usuarioId)
    await contenidoRepo.insertarCarpeta(id, nombre, pos, usuarioId, grupoId)
    return { id, nombre, materias: 0 }
  },

  async renombrarCarpeta(usuarioId, id, nombreRaw) {
    const nombre = String(nombreRaw || '').trim()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    const row = await contenidoRepo.carpetaAccesible(id, usuarioId)
    if (!row) throw fallo(404, 'No existe')
    await exigirEdicion(row.grupo_id, usuarioId)
    await contenidoRepo.actualizarCarpetaNombre(id, nombre)
    return { id, nombre }
  },

  async eliminarCarpeta(usuarioId, id) {
    const row = await contenidoRepo.carpetaAccesible(id, usuarioId)
    if (!row) throw fallo(404, 'No existe')
    await exigirEdicion(row.grupo_id, usuarioId)
    await database.withTransaction(async (tx) => {
      await contenidoRepo.borrarMateriasDeCarpeta(id, tx)
      await contenidoRepo.borrarCarpeta(id, tx)
    })
  },

  async reordenarCarpetas(usuarioId, ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw fallo(400, 'ids vacíos')
    await database.withTransaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await contenidoRepo.reordenarCarpeta(i + 1, ids[i], usuarioId, tx)
    })
  },

  async exportarCarpeta(usuarioId, id, incluirNotas = false) {
    const carpeta = await contenidoRepo.carpetaAccesible(id, usuarioId)
    if (!carpeta) throw fallo(404, 'La carpeta no existe')
    const info = await contenidoRepo.carpetaInfo(id)
    const materias = await Promise.all(
      (await contenidoRepo.materiasDeCarpeta(id)).map((m) => exportarMateria(m, incluirNotas)),
    )
    return { carpeta: info.nombre, materias }
  },

  // Importar materias completas a una carpeta existente.
  async importarAcarpeta(usuarioId, carpetaId, body) {
    const carpeta = await contenidoRepo.carpetaParaImport(carpetaId, usuarioId)
    if (!carpeta) throw fallo(404, 'La carpeta no existe')
    await exigirEdicion(carpeta.grupo_id, usuarioId)
    const materias = materiasDesde(body)
    if (materias.length === 0) throw fallo(400, 'El archivo no contiene materias válidas')
    return database.withTransaction((tx) => insertarMaterias(carpeta, materias, usuarioId, tx))
  },

  // Importar una o varias carpetas NUEVAS (con sus materias).
  async importarCarpetas(usuarioId, grupoId, body) {
    await exigirEdicion(grupoId, usuarioId)
    const entradas = Array.isArray(body?.carpetas) ? body.carpetas : [body]
    let totM = 0
    let totT = 0
    let totP = 0
    const carpetasCreadas = []
    await database.withTransaction(async (tx) => {
      for (const ent of entradas) {
        const materias = materiasDesde(ent)
        const nombre = String(ent?.carpeta || ent?.nombre || '').trim() || 'Carpeta importada'
        const id = await contenidoRepo.idUnico('carpeta-' + slugify(nombre), 'carpetas', tx)
        const pos = await contenidoRepo.maxPosCarpeta(grupoId, usuarioId, tx)
        await contenidoRepo.insertarCarpeta(id, nombre, pos, usuarioId, grupoId, tx)
        const carpeta = { id, usuario_id: usuarioId, grupo_id: grupoId }
        const conteo = await insertarMaterias(carpeta, materias, usuarioId, tx)
        totM += conteo.materias
        totT += conteo.temas
        totP += conteo.preguntas
        carpetasCreadas.push({ id, nombre })
      }
    })
    return { carpetas: carpetasCreadas, materias: totM, temas: totT, preguntas: totP }
  },

  // ----- Materias -----
  // Catálogo: materias del contexto con sus temas y conteo de preguntas.
  async catalogo(usuarioId, grupoId) {
    const filas = grupoId
      ? await contenidoRepo.materiasGrupo(grupoId)
      : await contenidoRepo.materiasPersonal(usuarioId)
    if (filas.length === 0) return []
    // Todos los temas (con conteo) de estas materias en una sola consulta.
    const temasMap = new Map()
    for (const t of await contenidoRepo.temasDeMaterias(filas.map((m) => m.id))) {
      if (!temasMap.has(t.materia_id)) temasMap.set(t.materia_id, [])
      temasMap.get(t.materia_id).push({
        id: t.id,
        nombre: t.nombre,
        preguntas: t.total,
        tieneNotas: !!t.notas_nombre,
      })
    }
    return filas.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      icono: m.icono,
      carpetaId: m.carpeta_id,
      temas: temasMap.get(m.id) || [],
    }))
  },

  async crearMateria(usuarioId, grupoId, body) {
    await exigirEdicion(grupoId, usuarioId)
    const nombre = String(body?.nombre || '').trim()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    // Si no se eligió emoji, se infiere uno acorde al nombre (o 📚 por defecto).
    const icono = String(body?.icono || '').trim() || emojiParaMateria(nombre)
    const carpetaId = String(body?.carpetaId || '').trim() || null
    if (carpetaId && !(await contenidoRepo.carpetaEnContexto(carpetaId, grupoId, usuarioId)))
      throw fallo(404, 'La carpeta no existe')
    const id = await contenidoRepo.idUnico(slugify(nombre), 'materias')
    const pos = await contenidoRepo.maxPosMateria(grupoId, usuarioId)
    await contenidoRepo.insertarMateria(id, nombre, icono, pos, carpetaId, usuarioId, grupoId)
    return { id, nombre, icono, carpetaId, temas: [] }
  },

  async reordenarMaterias(usuarioId, ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw fallo(400, 'ids vacíos')
    await database.withTransaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await contenidoRepo.reordenarMateria(i + 1, ids[i], usuarioId, tx)
    })
  },

  async renombrarMateria(usuarioId, id, body) {
    const nombre = String(body?.nombre || '').trim()
    const icono = String(body?.icono || '').trim() || '📚'
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    const mat = await contenidoRepo.materiaAccesible(id, usuarioId)
    if (!mat) throw fallo(404, 'No existe')
    await exigirEdicion(mat.grupo_id, usuarioId)
    await contenidoRepo.actualizarMateria(id, nombre, icono)
    return { id, nombre, icono }
  },

  async eliminarMateria(usuarioId, id) {
    const mat = await contenidoRepo.materiaAccesible(id, usuarioId)
    if (!mat) throw fallo(404, 'No existe')
    await exigirEdicion(mat.grupo_id, usuarioId)
    await contenidoRepo.borrarMateria(id)
  },

  async exportarMateriaPorId(usuarioId, id, incluirNotas = false) {
    if (!(await contenidoRepo.materiaAccesible(id, usuarioId))) throw fallo(404, 'La materia no existe')
    const m = await contenidoRepo.materiaInfo(id)
    return { materias: [await exportarMateria(m, incluirNotas)] }
  },

  // Exporta un solo tema (con su materia como envoltorio) en el mismo
  // formato que una materia completa, para que el resto del código
  // (analizar facetas, importar) no tenga que distinguir el caso.
  async exportarTemaPorId(usuarioId, temaId, incluirNotas = false) {
    const tema = await contenidoRepo.temaAccesible(temaId, usuarioId)
    if (!tema) throw fallo(404, 'El tema no existe')
    const info = await contenidoRepo.temaInfo(temaId)
    const m = await contenidoRepo.materiaInfo(tema.materia_id)
    const notas = incluirNotas ? await contenidoRepo.notasDeTema(temaId) : null
    const preguntas = (await contenidoRepo.preguntasParaExport(temaId)).map((p) => ({
      pregunta: p.pregunta,
      opciones: JSON.parse(p.opciones),
      respuestaCorrecta: p.respuesta_correcta,
      explicacion: p.explicacion,
      tipo: p.tipo,
      materiaCaso: p.materia_caso,
      temaCategoria: p.tema_categoria,
      dificultad: p.dificultad,
      imagen: p.imagen || null,
    }))
    return {
      materias: [
        {
          id: m.id,
          nombre: m.nombre,
          icono: m.icono,
          temas: [
            {
              id: info.id,
              nombre: info.nombre,
              ...(notas?.notas_html
                ? { notasHtml: notas.notas_html, notasNombre: notas.notas_nombre }
                : {}),
              preguntas,
            },
          ],
        },
      ],
    }
  },

  // Exporta todo el banco personal del usuario como JSON de intercambio.
  async exportarBancoPersonal(usuarioId) {
    const materias = await contenidoRepo.materiasPersonal(usuarioId)
    return { materias: await Promise.all(materias.map((m) => exportarMateria(m, false))) }
  },

  // ----- Temas -----
  async crearTema(usuarioId, body) {
    const materiaId = String(body?.materiaId || '').trim()
    const nombre = String(body?.nombre || '').trim()
    if (!materiaId || !nombre) throw fallo(400, 'materiaId y nombre son obligatorios')
    const mat = await contenidoRepo.materiaAccesible(materiaId, usuarioId)
    if (!mat) throw fallo(404, 'La materia no existe')
    await exigirEdicion(mat.grupo_id, usuarioId)
    const id = await contenidoRepo.idUnico(`${materiaId}-${slugify(nombre)}`, 'temas')
    const pos = await contenidoRepo.maxPosTema(materiaId)
    await contenidoRepo.insertarTema(id, materiaId, nombre, pos)
    return { id, nombre, preguntas: 0 }
  },

  async reordenarTemas(usuarioId, materiaId, ids) {
    if (!materiaId) throw fallo(400, 'Falta materiaId')
    if (!Array.isArray(ids) || ids.length === 0) throw fallo(400, 'ids vacíos')
    const mat = await contenidoRepo.materiaAccesible(materiaId, usuarioId)
    if (!mat) throw fallo(404, 'La materia no existe')
    await exigirEdicion(mat.grupo_id, usuarioId)
    await database.withTransaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) await contenidoRepo.reordenarTema(i + 1, ids[i], materiaId, tx)
    })
  },

  async renombrarTema(usuarioId, id, body) {
    const nombre = String(body?.nombre || '').trim()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    const tema = await contenidoRepo.temaAccesible(id, usuarioId)
    if (!tema) throw fallo(404, 'No existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    await contenidoRepo.actualizarTema(id, nombre)
    return { id, nombre }
  },

  async eliminarTema(usuarioId, id) {
    const tema = await contenidoRepo.temaAccesible(id, usuarioId)
    if (!tema) throw fallo(404, 'No existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    await contenidoRepo.borrarTema(id)
  },

  // ----- Apuntes del tema (DOCX/TXT → HTML, para revisar antes del quiz) -----
  async subirNotas(usuarioId, temaId, buffer, extRaw, nombreArchivo) {
    const tema = await contenidoRepo.temaAccesible(temaId, usuarioId)
    if (!tema) throw fallo(404, 'El tema no existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    const ext = '.' + String(extRaw || '').toLowerCase().replace(/^\./, '')
    if (!NOTAS_FORMATOS_SOPORTADOS.includes(ext))
      throw fallo(400, `Formato no soportado. Usa: ${NOTAS_FORMATOS_SOPORTADOS.join(', ')}`)
    if (!buffer || !buffer.length) throw fallo(400, 'No se recibió el archivo')
    if (buffer.length > NOTAS_MAX_BYTES) throw fallo(400, 'El archivo supera los 5 MB')
    let html
    try {
      html = await extraerNotasHtml(buffer, ext)
    } catch (e) {
      console.error('[Cerebro] Error extrayendo apuntes:', e)
      throw fallo(400, 'No se pudo procesar el archivo')
    }
    if (!html || html.trim().length < 5)
      throw fallo(400, 'No se pudo extraer contenido del archivo (¿está vacío o escaneado?).')
    const nombre = String(nombreArchivo || '').trim().slice(0, 150) || 'Apuntes'
    await contenidoRepo.actualizarNotasTema(temaId, html, nombre)
    return { notasNombre: nombre }
  },

  async obtenerNotas(usuarioId, temaId) {
    if (!(await contenidoRepo.temaAccesible(temaId, usuarioId))) throw fallo(404, 'El tema no existe')
    const row = await contenidoRepo.notasDeTema(temaId)
    return { notasHtml: row?.notas_html || null, notasNombre: row?.notas_nombre || null }
  },

  async eliminarNotas(usuarioId, temaId) {
    const tema = await contenidoRepo.temaAccesible(temaId, usuarioId)
    if (!tema) throw fallo(404, 'El tema no existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    await contenidoRepo.actualizarNotasTema(temaId, null, null)
  },

  // ----- Preguntas -----
  async preguntasDeTema(usuarioId, temaId) {
    if (!(await contenidoRepo.temaAccesible(temaId, usuarioId))) throw fallo(404, 'El tema no existe')
    return (await contenidoRepo.preguntasDeTema(temaId)).map((r) => ({
      id: r.id,
      pregunta: r.pregunta,
      opciones: JSON.parse(r.opciones),
      respuestaCorrecta: r.respuesta_correcta,
      explicacion: r.explicacion,
      tipo: r.tipo,
      materiaCaso: r.materia_caso,
      temaCategoria: r.tema_categoria,
      dificultad: r.dificultad,
      imagen: r.imagen || null,
    }))
  },

  async crearPregunta(usuarioId, temaId, body) {
    const tema = await contenidoRepo.temaAccesible(temaId, usuarioId)
    if (!tema) throw fallo(404, 'El tema no existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    const d = normalizarPregunta(body || {})
    const err = validarPregunta(d)
    if (err) throw fallo(400, err)
    try {
      const info = await contenidoRepo.insertarPregunta(
        temaId,
        d.pregunta,
        JSON.stringify(d.opciones),
        d.rc,
        d.explicacion,
        preguntaHash(temaId, d.pregunta),
        d.tipo,
        d.materiaCaso,
        d.temaCategoria,
        d.dificultad,
        d.imagen,
      )
      const mision = await misionesService.progresar(usuarioId, 'primera_pregunta')
      return { id: Number(info.lastInsertRowid), totalTema: await contenidoRepo.contarTema(temaId), mision }
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw fallo(409, 'Ya existe una pregunta con ese enunciado')
      throw e
    }
  },

  async editarPregunta(usuarioId, id, body) {
    const row = await contenidoRepo.pregAccesible(id, usuarioId)
    if (!row) throw fallo(404, 'No existe')
    await exigirEdicion(row.grupo_id, usuarioId)
    const d = normalizarPregunta(body || {})
    const err = validarPregunta(d)
    if (err) throw fallo(400, err)
    try {
      await contenidoRepo.actualizarPregunta(
        id,
        d.pregunta,
        JSON.stringify(d.opciones),
        d.rc,
        d.explicacion,
        preguntaHash(row.tema_id, d.pregunta),
        d.tipo,
        d.materiaCaso,
        d.temaCategoria,
        d.dificultad,
        d.imagen,
      )
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw fallo(409, 'Ya existe otra pregunta con ese enunciado')
      throw e
    }
  },

  async eliminarPregunta(usuarioId, id) {
    const row = await contenidoRepo.pregAccesible(id, usuarioId)
    if (!row) throw fallo(404, 'No existe')
    await exigirEdicion(row.grupo_id, usuarioId)
    await contenidoRepo.borrarPregunta(id)
    return { ok: true, totalTema: await contenidoRepo.contarTema(row.tema_id) }
  },

  // Preguntas de varios temas (?temas=) en orden aleatorio y opciones barajadas.
  async preguntasParaQuiz(usuarioId, temasRaw) {
    const temas = String(temasRaw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (temas.length === 0) return []
    const rows = await contenidoRepo.preguntasDeTemas(temas, usuarioId)
    return rows.map(rowToPregunta).map(barajarOpciones)
  },

  async buscar(usuarioId, qRaw) {
    const q = String(qRaw || '').trim()
    if (!q) return []
    const rows = await contenidoRepo.buscar(usuarioId, `%${q}%`)
    return rows.map(rowToPregunta)
  },

  // ----- Importar preguntas desde archivo (PDF/DOCX/TXT) -----
  // Paso 1: analizar el archivo y devolver la vista previa (preguntas + errores).
  async analizarArchivo(usuarioId, temaId, buffer, extRaw) {
    const tema = await contenidoRepo.temaAccesible(temaId, usuarioId)
    if (!tema) throw fallo(404, 'El tema no existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    const ext = '.' + String(extRaw || '').toLowerCase().replace(/^\./, '')
    if (!FORMATOS_SOPORTADOS.includes(ext))
      throw fallo(400, `Formato no soportado. Usa: ${FORMATOS_SOPORTADOS.join(', ')}`)
    if (!buffer || !buffer.length) throw fallo(400, 'No se recibió el archivo')
    let texto
    try {
      texto = await extraerTexto(buffer, ext)
    } catch (e) {
      console.error('[Cerebro] Error analizando archivo:', e)
      throw e
    }
    if (!texto || texto.trim().length < 10)
      throw fallo(400, 'No se pudo extraer texto del archivo (¿está vacío o escaneado?).')
    return parsearPreguntas(texto)
  },

  // Paso 2: confirmar e insertar las preguntas revisadas (deduplicando por hash).
  async confirmarImportacion(usuarioId, temaId, body) {
    const tema = await contenidoRepo.temaAccesible(temaId, usuarioId)
    if (!tema) throw fallo(404, 'El tema no existe')
    await exigirEdicion(tema.grupo_id, usuarioId)
    const preguntas = Array.isArray(body?.preguntas) ? body.preguntas : []
    if (preguntas.length === 0) throw fallo(400, 'No hay preguntas para importar')

    let insertadas = 0
    await database.withTransaction(async (tx) => {
      for (const p of preguntas) {
        const opciones = Array.isArray(p.opciones) ? p.opciones : []
        const tipo = p.tipo === 'flashcard' ? 'flashcard' : 'opcion'
        if (!p.pregunta) continue
        if (tipo !== 'flashcard' && opciones.length < 2) continue
        if (tipo === 'flashcard' && !p.explicacion) continue
        insertadas += await contenidoRepo.insertarPreguntaImport(
          temaId,
          String(p.pregunta),
          JSON.stringify(opciones),
          Number.isInteger(p.respuestaCorrecta) ? p.respuestaCorrecta : -1,
          p.explicacion ?? null,
          preguntaHash(temaId, String(p.pregunta)),
          tipo,
          textoOpcional(p.materiaCaso),
          textoOpcional(p.temaCategoria),
          textoOpcional(p.dificultad),
          null, // este import viene de texto/IA: nunca trae imagen
          tx,
        )
      }
    })
    const totalTema = await contenidoRepo.contarTema(temaId)
    return { insertadas, omitidas: preguntas.length - insertadas, totalTema }
  },
}
