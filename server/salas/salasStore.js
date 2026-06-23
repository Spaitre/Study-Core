// Multijugador en tiempo real (estilo Kahoot). Las salas viven EN MEMORIA (no
// en SQLite); el estado se sincroniza por sondeo. Este módulo concentra todo el
// estado y la lógica de juego, sin tocar HTTP ni la base de datos: los datos que
// necesita (preguntas, perfiles) se le pasan ya resueltos desde el servicio.
//
// Nota: por estar en memoria implica una sola instancia del backend; un reinicio
// pierde las salas activas. La fase 3 (futura) desacoplará esto del transporte
// para mover a WebSockets sin tocar la lógica de aquí.
import { fallo } from '../services/ApiError.js'

const salas = new Map() // codigo -> sala
const TIEMPO_SALA_INACTIVA = 3 * 60 * 60 * 1000 // 3 h

function generarCodigo() {
  let c
  do {
    c = String(Math.floor(10000 + Math.random() * 90000))
  } while (salas.has(c))
  return c
}

function mezclar(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Toma filas de preguntas (opción múltiple) y arma un snapshot con opciones
// barajadas e índice de la correcta recalculado.
function snapshotPreguntas(rows, max = 20) {
  return rows.slice(0, max).map((r) => {
    const ops = JSON.parse(r.opciones)
    const correcta = ops[r.respuesta_correcta]
    const barajadas = mezclar(ops)
    return {
      enunciado: r.pregunta,
      opciones: barajadas,
      correcta: barajadas.indexOf(correcta),
      explicacion: r.explicacion,
    }
  })
}

function limpiarInactivas() {
  const ahora = Date.now()
  for (const [cod, s] of salas) {
    if (ahora - s.actividad > TIEMPO_SALA_INACTIVA) salas.delete(cod)
  }
}

function jugadorDesde(perfil) {
  return { id: perfil.id, nombre: perfil.nombreUsuario, foto: perfil.foto, score: 0, lastGain: 0 }
}

// Aplica los puntos de la pregunta actual (una sola vez) estilo Kahoot: acertar
// más rápido da más puntos (máx 1000, mín 500 si aciertas).
function aplicarPuntos(sala) {
  const q = sala.preguntas[sala.idx]
  const limite = sala.tiempo * 1000
  for (const [uid, jug] of sala.jugadores) {
    const r = sala.respuestas.get(uid)
    let gain = 0
    if (r && r.opcion === q.correcta) {
      gain = Math.round(1000 * (1 - (Math.min(r.tiempo, limite) / limite) * 0.5))
    }
    jug.lastGain = gain
    jug.score += gain
  }
}

// Si el tiempo se agotó o ya respondieron todos, revela la pregunta.
function quizaRevelar(sala) {
  if (sala.estado !== 'pregunta') return
  const deadline = sala.preguntaInicio + sala.tiempo * 1000
  const todos = sala.respuestas.size >= sala.jugadores.size
  if (Date.now() >= deadline || todos) {
    aplicarPuntos(sala)
    sala.estado = 'revelar'
  }
}

function tablaPosiciones(sala) {
  return [...sala.jugadores.values()]
    .sort((a, b) => b.score - a.score)
    .map((j) => ({ id: j.id, nombre: j.nombre, foto: j.foto, score: j.score, lastGain: j.lastGain }))
}

// Vista de la sala según su estado, para el usuario `uid`.
function vista(sala, uid) {
  const esHost = sala.hostId === uid
  const espectador = esHost && !sala.hostJuega
  const base = { codigo: sala.codigo, estado: sala.estado, esHost, espectador, total: sala.preguntas.length }
  if (sala.estado === 'lobby') {
    return {
      ...base,
      jugadores: [...sala.jugadores.values()].map((j) => ({ id: j.id, nombre: j.nombre, foto: j.foto })),
    }
  }
  if (sala.estado === 'pregunta') {
    const q = sala.preguntas[sala.idx]
    return {
      ...base,
      idx: sala.idx,
      pregunta: { enunciado: q.enunciado, opciones: q.opciones },
      deadline: sala.preguntaInicio + sala.tiempo * 1000,
      tiempo: sala.tiempo,
      tuRespondida: sala.respuestas.has(uid),
      numRespondieron: sala.respuestas.size,
      numJugadores: sala.jugadores.size,
    }
  }
  if (sala.estado === 'revelar') {
    const q = sala.preguntas[sala.idx]
    const r = sala.respuestas.get(uid)
    const jug = sala.jugadores.get(uid)
    return {
      ...base,
      idx: sala.idx,
      pregunta: { enunciado: q.enunciado, opciones: q.opciones },
      correcta: q.correcta,
      explicacion: q.explicacion,
      tuOpcion: r ? r.opcion : null,
      tuCorrecta: r ? r.opcion === q.correcta : false,
      ganancia: jug ? jug.lastGain : 0,
      tabla: tablaPosiciones(sala),
    }
  }
  return { ...base, tabla: tablaPosiciones(sala) } // final
}

function obtenerOFalla(codigo) {
  const sala = salas.get(codigo)
  if (!sala) throw fallo(404, 'La sala ya no existe')
  return sala
}

export const salasStore = {
  // Crea una sala con un snapshot de las preguntas dadas. `temasRows` son filas
  // de preguntas de opción múltiple ya validadas por acceso del usuario.
  crear({ hostId, hostPerfil, temasRows, tiempo, hostJuega }) {
    limpiarInactivas()
    const preguntas = snapshotPreguntas(temasRows)
    if (preguntas.length === 0) throw fallo(400, 'No hay preguntas de opción múltiple en esos temas')
    const codigo = generarCodigo()
    const jugadores = new Map()
    if (hostJuega) jugadores.set(hostId, jugadorDesde(hostPerfil))
    const sala = {
      codigo,
      hostId,
      hostJuega,
      estado: 'lobby',
      tiempo,
      preguntas,
      idx: -1,
      preguntaInicio: 0,
      respuestas: new Map(),
      jugadores,
      actividad: Date.now(),
    }
    salas.set(codigo, sala)
    return vista(sala, hostId)
  },

  // Unirse por código (solo en lobby, salvo que ya seas jugador). `perfil` es el
  // del usuario que se une (para registrarlo si aún no está).
  unirse(codigo, uid, perfil) {
    const sala = salas.get(codigo)
    if (!sala) throw fallo(404, 'No existe una sala con ese código')
    if (sala.estado !== 'lobby' && !sala.jugadores.has(uid)) throw fallo(400, 'La partida ya comenzó')
    if (!sala.jugadores.has(uid)) sala.jugadores.set(uid, jugadorDesde(perfil))
    sala.actividad = Date.now()
    return vista(sala, uid)
  },

  // Estado actual (sondeo): revela si corresponde.
  estado(codigo, uid) {
    const sala = obtenerOFalla(codigo)
    if (!sala.jugadores.has(uid) && sala.hostId !== uid) throw fallo(403, 'No estás en esta sala')
    quizaRevelar(sala)
    sala.actividad = Date.now()
    return vista(sala, uid)
  },

  iniciar(codigo, uid) {
    const sala = obtenerOFalla(codigo)
    if (sala.hostId !== uid) throw fallo(403, 'Solo el anfitrión puede iniciar')
    if (sala.estado !== 'lobby') throw fallo(400, 'Ya inició')
    sala.idx = 0
    sala.estado = 'pregunta'
    sala.respuestas = new Map()
    sala.preguntaInicio = Date.now()
    for (const j of sala.jugadores.values()) j.lastGain = 0
    sala.actividad = Date.now()
    return vista(sala, uid)
  },

  responder(codigo, uid, opcionRaw) {
    const sala = obtenerOFalla(codigo)
    if (!sala.jugadores.has(uid)) throw fallo(403, 'No estás en esta sala')
    if (sala.estado !== 'pregunta') throw fallo(400, 'No es momento de responder')
    const deadline = sala.preguntaInicio + sala.tiempo * 1000
    if (Date.now() > deadline) throw fallo(400, 'Se acabó el tiempo')
    if (!sala.respuestas.has(uid)) {
      const opcion = Number(opcionRaw)
      sala.respuestas.set(uid, {
        opcion: Number.isInteger(opcion) ? opcion : -1,
        tiempo: Date.now() - sala.preguntaInicio,
      })
    }
    quizaRevelar(sala)
    sala.actividad = Date.now()
    return { ok: true }
  },

  siguiente(codigo, uid) {
    const sala = obtenerOFalla(codigo)
    if (sala.hostId !== uid) throw fallo(403, 'Solo el anfitrión puede avanzar')
    if (sala.estado === 'pregunta') {
      aplicarPuntos(sala)
      sala.estado = 'revelar'
    }
    if (sala.idx + 1 < sala.preguntas.length) {
      sala.idx += 1
      sala.estado = 'pregunta'
      sala.respuestas = new Map()
      sala.preguntaInicio = Date.now()
      for (const j of sala.jugadores.values()) j.lastGain = 0
    } else {
      sala.estado = 'final'
    }
    sala.actividad = Date.now()
    return vista(sala, uid)
  },

  terminar(codigo, uid) {
    const sala = obtenerOFalla(codigo)
    if (sala.hostId !== uid) throw fallo(403, 'Solo el anfitrión puede terminar')
    if (sala.estado === 'pregunta') aplicarPuntos(sala)
    sala.estado = 'final'
    sala.actividad = Date.now()
    return vista(sala, uid)
  },

  // Salir. Si sale el host (o queda vacía), la sala se cierra.
  salir(codigo, uid) {
    const sala = salas.get(codigo)
    if (!sala) return { ok: true }
    sala.jugadores.delete(uid)
    if (sala.hostId === uid || sala.jugadores.size === 0) salas.delete(codigo)
    return { ok: true }
  },
}
