// Cliente de la API. Todo el contenido y el historial provienen de SQLite
// a través del backend (server/index.js). El frontend ya no lee JSON.

// Todas las peticiones envían la cookie de sesión (necesario si el frontend y
// el backend están en orígenes distintos al hostear).
const CRED = { credentials: 'include' }

async function getJSON(url) {
  const res = await fetch(url, CRED)
  if (!res.ok) throw new Error(`Error ${res.status} en ${url}`)
  return res.json()
}

// ----- Autenticación -----
export async function registro(email, password) {
  return postJSON('/api/auth/registro', { email, password }).then((d) => d.usuario)
}
export async function login(email, password) {
  return postJSON('/api/auth/login', { email, password }).then((d) => d.usuario)
}
export async function loginGoogle(idToken) {
  return postJSON('/api/auth/google', { idToken }).then((d) => d.usuario)
}
export async function logout() {
  return postJSON('/api/auth/logout', {})
}
export async function entrarInvitado() {
  return postJSON('/api/auth/invitado', {}).then((d) => d.usuario)
}
export async function fetchYo() {
  const res = await fetch('/api/auth/yo', CRED)
  if (!res.ok) return null
  return res.json().then((d) => d.usuario)
}

// ----- Perfil -----
export function fetchPerfil() {
  return getJSON('/api/perfil').then((d) => d.perfil)
}
export function actualizarPerfil(cambios) {
  return patchJSON('/api/perfil', cambios).then((d) => d.perfil)
}
export function nombreDisponible(nombre) {
  return getJSON(`/api/perfil/disponible?nombre=${encodeURIComponent(nombre)}`)
}

// ----- Amigos -----
export function fetchAmigos() {
  return getJSON('/api/amigos').then((d) => d.amigos)
}
export function fetchSolicitudes() {
  return getJSON('/api/amigos/solicitudes').then((d) => d.solicitudes)
}
export function fetchEnviadas() {
  return getJSON('/api/amigos/enviadas').then((d) => d.enviadas)
}
export function solicitarAmigo(identificador) {
  return postJSON('/api/amigos/solicitar', { identificador })
}
export function aceptarAmigo(amistadId) {
  return postJSON(`/api/amigos/${amistadId}/aceptar`, {})
}
export function eliminarAmistad(amistadId) {
  return delJSON(`/api/amigos/${encodeURIComponent(amistadId)}`)
}

// Sufijo ?grupo= para operar en el contexto de un grupo (o personal si null).
function ctxQuery(grupoId) {
  return grupoId ? `?grupo=${encodeURIComponent(grupoId)}` : ''
}

export function fetchMaterias(grupoId = null) {
  return getJSON(`/api/materias${ctxQuery(grupoId)}`).then((d) => d.materias)
}

export function fetchCarpetas(grupoId = null) {
  return getJSON(`/api/carpetas${ctxQuery(grupoId)}`).then((d) => d.carpetas)
}

// ----- Grupos -----
export function fetchGrupos() {
  return getJSON('/api/grupos').then((d) => d.grupos)
}
export function fetchGrupo(id) {
  return getJSON(`/api/grupos/${encodeURIComponent(id)}`).then((d) => d.grupo)
}
export function crearGrupo(nombre, { permisoEdicion = 'todos', acceso = [] } = {}) {
  return postJSON('/api/grupos', { nombre, permisoEdicion, acceso }).then((d) => d.grupo)
}
export function unirseGrupo(codigo) {
  return postJSON('/api/grupos/unirse', { codigo }).then((d) => d.grupo)
}
export function editarGrupo(id, cambios) {
  return patchJSON(`/api/grupos/${encodeURIComponent(id)}`, cambios).then((d) => d.grupo)
}
export function quitarMiembro(grupoId, usuarioId) {
  return delJSON(
    `/api/grupos/${encodeURIComponent(grupoId)}/miembros/${encodeURIComponent(usuarioId)}`,
  )
}
export function eliminarGrupo(id) {
  return delJSON(`/api/grupos/${encodeURIComponent(id)}`)
}
export function salirGrupo(id) {
  return postJSON(`/api/grupos/${encodeURIComponent(id)}/salir`, {})
}
export function estadisticasGrupo(id) {
  return getJSON(`/api/grupos/${encodeURIComponent(id)}/estadisticas`)
}
export function fetchObjetivos(grupoId) {
  return getJSON(`/api/grupos/${encodeURIComponent(grupoId)}/objetivos`).then((d) => d.objetivos)
}
export function crearObjetivo(grupoId, objetivo) {
  return postJSON(`/api/grupos/${encodeURIComponent(grupoId)}/objetivos`, objetivo)
}
export function eliminarObjetivo(grupoId, id) {
  return delJSON(`/api/grupos/${encodeURIComponent(grupoId)}/objetivos/${encodeURIComponent(id)}`)
}

// ----- Multijugador (salas en tiempo real) -----
export function crearSala(temas, tiempo, hostJuega = true) {
  return postJSON('/api/salas', { temas, tiempo, hostJuega }).then((d) => d.sala)
}
export function unirseSala(codigo) {
  return postJSON('/api/salas/unirse', { codigo }).then((d) => d.sala)
}
export function fetchSala(codigo) {
  return getJSON(`/api/salas/${encodeURIComponent(codigo)}`).then((d) => d.sala)
}
export function iniciarSala(codigo) {
  return postJSON(`/api/salas/${encodeURIComponent(codigo)}/iniciar`, {}).then((d) => d.sala)
}
export function responderSala(codigo, opcion) {
  return postJSON(`/api/salas/${encodeURIComponent(codigo)}/responder`, { opcion })
}
export function siguienteSala(codigo) {
  return postJSON(`/api/salas/${encodeURIComponent(codigo)}/siguiente`, {}).then((d) => d.sala)
}
export function terminarSala(codigo) {
  return postJSON(`/api/salas/${encodeURIComponent(codigo)}/terminar`, {}).then((d) => d.sala)
}
export function salirSala(codigo) {
  return postJSON(`/api/salas/${encodeURIComponent(codigo)}/salir`, {})
}

export function fetchPreguntasTema(temaId) {
  return getJSON(`/api/temas/${encodeURIComponent(temaId)}/preguntas`).then(
    (d) => d.preguntas,
  )
}

export function fetchPreguntas(temaIds) {
  const temas = encodeURIComponent(temaIds.join(','))
  return getJSON(`/api/preguntas?temas=${temas}`).then((d) => d.preguntas)
}

export function buscar(q) {
  return getJSON(`/api/search?q=${encodeURIComponent(q)}`).then((d) => d.resultados)
}

export function fetchStats() {
  return getJSON('/api/stats')
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...CRED,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export function crearMateria(nombre, icono, carpetaId, grupoId = null) {
  return postJSON('/api/materias', { nombre, icono, carpetaId, grupoId }).then((d) => d.materia)
}

export function crearTema(materiaId, nombre) {
  return postJSON('/api/temas', { materiaId, nombre }).then((d) => d.tema)
}

// Paso 1: analiza un archivo (PDF/DOCX/TXT) y devuelve { preguntas, errores }.
export async function analizarArchivo(temaId, file) {
  const ext = file.name.split('.').pop().toLowerCase()
  const buf = await file.arrayBuffer()
  const res = await fetch(
    `/api/temas/${encodeURIComponent(temaId)}/importar/analizar?ext=${ext}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buf,
      ...CRED,
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

// Paso 1 (alternativo): analiza texto pegado directamente, sin pasar por un
// archivo. Reutiliza el mismo endpoint que analizarArchivo (ext=txt).
export async function analizarTexto(temaId, texto) {
  const res = await fetch(
    `/api/temas/${encodeURIComponent(temaId)}/importar/analizar?ext=txt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: texto,
      ...CRED,
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

// Paso 2: confirma e inserta las preguntas revisadas.
export async function confirmarImportacion(temaId, preguntas) {
  const res = await fetch(
    `/api/temas/${encodeURIComponent(temaId)}/importar/confirmar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preguntas }),
      ...CRED,
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

async function patchJSON(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...CRED,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export function editarMateria(id, nombre, icono) {
  return patchJSON(`/api/materias/${encodeURIComponent(id)}`, {
    nombre,
    icono,
  }).then((d) => d.materia)
}

export function editarTema(id, nombre) {
  return patchJSON(`/api/temas/${encodeURIComponent(id)}`, { nombre }).then(
    (d) => d.tema,
  )
}

async function delJSON(url) {
  const res = await fetch(url, { method: 'DELETE', ...CRED })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

// ----- Carpetas -----
export function crearCarpeta(nombre, grupoId = null) {
  return postJSON('/api/carpetas', { nombre, grupoId }).then((d) => d.carpeta)
}
export function editarCarpeta(id, nombre) {
  return patchJSON(`/api/carpetas/${encodeURIComponent(id)}`, { nombre }).then(
    (d) => d.carpeta,
  )
}
export function eliminarCarpeta(id) {
  return delJSON(`/api/carpetas/${encodeURIComponent(id)}`)
}
// Importar materias completas (formato de exportación) a una carpeta existente.
export function importarMateriasACarpeta(carpetaId, datos) {
  return postJSON(`/api/carpetas/${encodeURIComponent(carpetaId)}/importar`, datos)
}
// Importar una carpeta nueva (con sus materias) en el contexto actual.
export function importarCarpeta(datos, grupoId = null) {
  return postJSON('/api/carpetas/importar', { ...datos, grupoId })
}
// Exportaciones (devuelven el JSON para descargar).
export function exportarMateria(materiaId) {
  return getJSON(`/api/materias/${encodeURIComponent(materiaId)}/export`)
}
export function exportarCarpeta(carpetaId) {
  return getJSON(`/api/carpetas/${encodeURIComponent(carpetaId)}/export`)
}
export async function reordenarCarpetas(ids) {
  const res = await fetch('/api/carpetas/orden', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    ...CRED,
  })
  if (!res.ok) throw new Error(`No se pudo guardar el orden (${res.status})`)
  return res.json()
}

// ----- Preguntas (gestión) -----
export function crearPregunta(temaId, pregunta) {
  return postJSON(`/api/temas/${encodeURIComponent(temaId)}/preguntas`, pregunta)
}
export function editarPregunta(id, pregunta) {
  return patchJSON(`/api/preguntas/${encodeURIComponent(id)}`, pregunta)
}
export function eliminarPregunta(id) {
  return delJSON(`/api/preguntas/${encodeURIComponent(id)}`)
}

export function eliminarMateria(id) {
  return delJSON(`/api/materias/${encodeURIComponent(id)}`)
}

export function eliminarTema(id) {
  return delJSON(`/api/temas/${encodeURIComponent(id)}`)
}

export async function reordenarMaterias(ids) {
  const res = await fetch('/api/materias/orden', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    ...CRED,
  })
  if (!res.ok) throw new Error(`No se pudo guardar el orden (${res.status})`)
  return res.json()
}

// ----- Progreso (racha, XP, monedas, cajas de regalo) -----
export function fetchProgreso() {
  return getJSON('/api/progreso')
}
export function abrirCaja(id) {
  return postJSON(`/api/cajas/${encodeURIComponent(id)}/abrir`, {})
}

// ----- Misiones de bienvenida -----
export function fetchMisiones() {
  return getJSON('/api/misiones')
}

// ----- Banco de contenido público (Comunidad): materias/carpetas publicadas -----
export function fetchFacetasPublicas() {
  return getJSON('/api/comunidad/facetas')
}
// Los filtros de faceta (tipo/materia/tema/dificultad/categoría) son de
// selección múltiple: cada uno viaja como un solo query param con sus
// valores separados por coma.
export function fetchContenidoPublico(filtros = {}) {
  const params = new URLSearchParams()
  for (const [campo, valor] of Object.entries(filtros)) {
    if (Array.isArray(valor)) {
      if (valor.length > 0) params.set(campo, valor.join(','))
    } else if (valor) {
      params.set(campo, valor)
    }
  }
  const q = params.toString()
  return getJSON(`/api/comunidad/contenido${q ? `?${q}` : ''}`).then((d) => d.contenido)
}
export function fetchDetalleContenido(id) {
  return getJSON(`/api/comunidad/contenido/${encodeURIComponent(id)}`)
}
export function fetchPreguntasPublicas(id) {
  return getJSON(`/api/comunidad/contenido/${encodeURIComponent(id)}/preguntas`).then((d) => d.preguntas)
}
export function fetchEstadisticasAdmin() {
  return getJSON('/api/admin/estadisticas')
}
export function publicarContenido(datos) {
  return postJSON('/api/comunidad/contenido', datos)
}
export function votarContenido(id) {
  return postJSON(`/api/comunidad/contenido/${encodeURIComponent(id)}/votar`, {})
}
export function comentarContenido(id, texto) {
  return postJSON(`/api/comunidad/contenido/${encodeURIComponent(id)}/comentar`, { texto }).then(
    (d) => d.comentarios,
  )
}
export function reportarContenido(id, motivo) {
  return postJSON(`/api/comunidad/contenido/${encodeURIComponent(id)}/reportar`, { motivo })
}
export function importarContenido(id, opciones = {}) {
  return postJSON(`/api/comunidad/contenido/${encodeURIComponent(id)}/importar`, opciones)
}
export function fetchModeracionContenido() {
  return getJSON('/api/comunidad/moderacion').then((d) => d.contenido)
}
export function ocultarContenido(id) {
  return postJSON(`/api/comunidad/moderacion/${encodeURIComponent(id)}/ocultar`, {})
}
export function descartarReportesContenido(id) {
  return postJSON(`/api/comunidad/moderacion/${encodeURIComponent(id)}/descartar`, {})
}

export async function guardarSesion(sesion) {
  const res = await fetch('/api/sesiones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sesion),
    ...CRED,
  })
  if (!res.ok) throw new Error(`No se pudo guardar la sesión (${res.status})`)
  return res.json()
}
