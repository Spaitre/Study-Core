import { useState, useEffect, useRef } from 'react'

// Colores estilo Kahoot para las opciones (hasta 4).
const FORMAS = ['▲', '◆', '●', '■']

// Opciones de repetición espaciada para flashcards (tecla → milisegundos).
const REPASO = [
  { tecla: '1', etiqueta: 'Repetir <1 min', ms: 45000 },
  { tecla: '2', etiqueta: 'Repetir 5 min', ms: 300000 },
  { tecla: '3', etiqueta: 'Repetir 10 min', ms: 600000 },
  { tecla: '4', etiqueta: 'No repetir', ms: null },
]

export default function QuizScreen({
  preguntas,
  tiempoPorPregunta,
  onTerminar,
  onSalir,
}) {
  // Cola de trabajo: nuevas (orden inicial) + repaso (con tiempo de vencimiento).
  const colaRef = useRef(null)
  if (colaRef.current === null) {
    colaRef.current = { nuevas: preguntas.slice(1), repaso: [] }
  }
  // Resultados: una entrada por pregunta de opción; las flashcards guardan su
  // disposición final (acierto = "No repetir").
  const mcqResultsRef = useRef([])
  const flashResultsRef = useRef(new Map())

  const [actual, setActual] = useState(preguntas[0] ?? null)
  const [mostradas, setMostradas] = useState(1)
  const [seleccion, setSeleccion] = useState(null)
  const [respondida, setRespondida] = useState(false)
  const [revelada, setRevelada] = useState(false)
  const [tiempoRestante, setTiempoRestante] = useState(tiempoPorPregunta)

  const esFlashcard = actual?.tipo === 'flashcard'
  const sinTiempo = tiempoPorPregunta == null
  const tiempoDesactivado = sinTiempo || esFlashcard
  const restantes =
    colaRef.current.nuevas.length + colaRef.current.repaso.length
  const esFin = restantes === 0

  // Cronómetro (solo opción múltiple con tiempo).
  useEffect(() => {
    if (respondida || tiempoDesactivado) return
    if (tiempoRestante <= 0) {
      registrar(null)
      return
    }
    const id = setTimeout(() => setTiempoRestante((t) => t - 1), 1000)
    return () => clearTimeout(id)
  }, [tiempoRestante, respondida, tiempoDesactivado])

  // Atajos de teclado para flashcards: Espacio revela; 1-4 califican.
  useEffect(() => {
    if (!esFlashcard) return
    function onKey(e) {
      if (!revelada) {
        if (e.code === 'Space') {
          e.preventDefault()
          setRevelada(true)
        }
        return
      }
      const op = REPASO.find((r) => r.tecla === e.key)
      if (op) {
        e.preventDefault()
        calificarFlash(op.ms)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esFlashcard, revelada, actual])

  function avanzar() {
    const ahora = Date.now()
    const { nuevas, repaso } = colaRef.current
    let pick = null

    // Tarjeta de repaso vencida (la más antigua).
    let dueIdx = -1
    let dueTime = Infinity
    repaso.forEach((r, i) => {
      if (r.dueAt <= ahora && r.dueAt < dueTime) {
        dueTime = r.dueAt
        dueIdx = i
      }
    })
    if (dueIdx >= 0) {
      pick = repaso.splice(dueIdx, 1)[0].pregunta
    } else if (nuevas.length) {
      pick = nuevas.shift()
    } else if (repaso.length) {
      // Nada vencido aún, pero ya no hay nuevas: muestra la más próxima.
      let idx = 0
      for (let i = 1; i < repaso.length; i++)
        if (repaso[i].dueAt < repaso[idx].dueAt) idx = i
      pick = repaso.splice(idx, 1)[0].pregunta
    }

    if (!pick) {
      onTerminar([...mcqResultsRef.current, ...flashResultsRef.current.values()])
      return
    }
    setActual(pick)
    setSeleccion(null)
    setRespondida(false)
    setRevelada(false)
    setTiempoRestante(tiempoPorPregunta)
    setMostradas((n) => n + 1)
  }

  // Opción múltiple: registra el resultado.
  function registrar(opcionElegida) {
    const correcta = opcionElegida === actual.respuestaCorrecta
    mcqResultsRef.current.push({
      preguntaId: actual.id,
      temaId: actual.temaId,
      temaNombre: actual.temaNombre,
      correcta,
      respondida: opcionElegida !== null,
    })
    setSeleccion(opcionElegida)
    setRespondida(true)
  }
  function responder(i) {
    if (respondida) return
    registrar(i)
  }

  // Flashcard: guarda disposición y reprograma según el intervalo.
  function calificarFlash(ms) {
    const a = actual
    flashResultsRef.current.set(a.id, {
      preguntaId: a.id,
      temaId: a.temaId,
      temaNombre: a.temaNombre,
      correcta: ms === null, // "No repetir" = dominada
      respondida: true,
    })
    if (ms != null) {
      colaRef.current.repaso.push({ pregunta: a, dueAt: Date.now() + ms })
    }
    avanzar()
  }

  function claseOpcion(i) {
    if (!respondida) return ''
    if (i === actual.respuestaCorrecta) return 'correcta'
    if (i === seleccion) return 'incorrecta'
    return 'atenuada'
  }

  const porcentajeTiempo = tiempoDesactivado
    ? 100
    : (tiempoRestante / tiempoPorPregunta) * 100
  const tiempoBajo = !tiempoDesactivado && tiempoRestante <= 5

  if (!actual) return null

  return (
    <div className="screen quiz">
      <header className="quiz-header">
        <button className="btn-link" onClick={onSalir}>
          ← Salir
        </button>
        <span className="quiz-progreso">
          Pregunta {mostradas}
          {restantes > 0 ? ` · ${restantes} en cola` : ''}
        </span>
        <span className="quiz-tema">{actual.temaNombre}</span>
      </header>

      <div className={`cronometro ${tiempoDesactivado ? 'sin-tiempo' : ''}`}>
        <div
          className={`cronometro-barra ${tiempoBajo ? 'bajo' : ''}`}
          style={{ width: `${porcentajeTiempo}%` }}
        />
        <span className="cronometro-num">
          {esFlashcard
            ? '🃏 flashcard'
            : respondida
              ? '✓'
              : sinTiempo
                ? '∞ sin tiempo'
                : tiempoRestante}
        </span>
      </div>

      <div className="pregunta-texto">{actual.pregunta}</div>

      {esFlashcard ? (
        <div className="flashcard-zona">
          {!revelada ? (
            <button className="btn-primary" onClick={() => setRevelada(true)}>
              Mostrar respuesta
            </button>
          ) : (
            <>
              <div className="flashcard-reverso">
                <p className="feedback-explicacion">{actual.explicacion}</p>
              </div>
              <div className="flashcard-srs">
                {REPASO.map((r) => (
                  <button
                    key={r.tecla}
                    className="srs-btn"
                    onClick={() => calificarFlash(r.ms)}
                  >
                    <span className="srs-tecla">{r.tecla}</span>
                    {r.etiqueta}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="opciones-grid">
          {actual.opciones.map((opcion, i) => (
            <button
              key={i}
              className={`opcion color-${i} ${claseOpcion(i)}`}
              onClick={() => responder(i)}
              disabled={respondida}
            >
              <span className="opcion-forma">{FORMAS[i]}</span>
              <span className="opcion-texto">{opcion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Retroalimentación de opción múltiple */}
      {!esFlashcard && respondida && (
        <div
          className={`feedback ${
            seleccion === actual.respuestaCorrecta
              ? 'ok'
              : seleccion === null
                ? 'timeout'
                : 'mal'
          }`}
        >
          <div className="feedback-titulo">
            {seleccion === actual.respuestaCorrecta
              ? '✅ ¡Correcto!'
              : seleccion === null
                ? '⏱️ Se acabó el tiempo'
                : '❌ Incorrecto'}
          </div>
          <p className="feedback-explicacion">{actual.explicacion}</p>
          <button className="btn-primary" onClick={avanzar}>
            {esFin ? 'Ver resultados →' : 'Siguiente pregunta →'}
          </button>
        </div>
      )}
    </div>
  )
}
