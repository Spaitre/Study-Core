import { useState, useEffect, useRef } from 'react'
import Avatar from './Avatar.jsx'
import {
  fetchSala,
  iniciarSala,
  responderSala,
  siguienteSala,
  terminarSala,
  salirSala,
} from '../api.js'

const FORMAS = ['▲', '◆', '●', '■']

export default function SalaScreen({ codigo, salaInicial, onSalir }) {
  const [sala, setSala] = useState(salaInicial)
  const [seleccion, setSeleccion] = useState(null)
  const [ahora, setAhora] = useState(Date.now())
  const [cerrada, setCerrada] = useState(false)
  const idxRef = useRef(-1)

  // Sondeo del estado de la sala (~1 s).
  useEffect(() => {
    let vivo = true
    async function tick() {
      try {
        const s = await fetchSala(codigo)
        if (vivo) setSala(s)
      } catch {
        if (vivo) setCerrada(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [codigo])

  // Reloj local para el contador (suave).
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // Al cambiar de pregunta, limpia la selección.
  useEffect(() => {
    if (sala && sala.estado === 'pregunta' && sala.idx !== idxRef.current) {
      idxRef.current = sala.idx
      setSeleccion(null)
    }
  }, [sala])

  async function salir() {
    try {
      await salirSala(codigo)
    } catch {
      /* ignorar */
    }
    onSalir()
  }

  async function responder(i) {
    if (seleccion !== null) return
    setSeleccion(i)
    try {
      await responderSala(codigo, i)
    } catch {
      /* tiempo agotado u otro */
    }
  }

  if (cerrada) {
    return (
      <div className="screen sala">
        <div className="sala-fin">
          <h1>La sala se cerró</h1>
          <p className="subtitle">El anfitrión salió o la partida terminó.</p>
          <button className="btn-primary" onClick={onSalir}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  if (!sala) return <div className="estado-carga">🎮 Conectando…</div>

  // ---------- LOBBY ----------
  if (sala.estado === 'lobby') {
    return (
      <div className="screen sala lobby">
        <button className="btn-link sala-salir" onClick={salir}>
          ← Salir
        </button>
        <div className="lobby-codigo">
          <span className="lobby-codigo-label">Código de la sala</span>
          <span className="lobby-codigo-num">{sala.codigo}</span>
          <span className="lobby-codigo-hint">Compártelo para que se unan</span>
        </div>

        <div className="lobby-jugadores">
          {sala.jugadores.map((j) => (
            <div key={j.id} className="lobby-jugador">
              <Avatar foto={j.foto} size={56} />
              <span>{j.nombre}</span>
            </div>
          ))}
        </div>

        <div className="lobby-pie">
          <span className="lobby-cuenta">
            {sala.jugadores.length} {sala.jugadores.length === 1 ? 'jugador' : 'jugadores'}
          </span>
          {sala.esHost ? (
            <>
              {sala.espectador && <p className="guardado-nota">👁️ Entrarás como espectador</p>}
              <button
                className="btn-primary"
                onClick={() => iniciarSala(codigo).then(setSala)}
                disabled={sala.jugadores.length === 0}
              >
                Iniciar sesión de preguntas →
              </button>
              {sala.jugadores.length === 0 && (
                <p className="guardado-nota">Esperando jugadores para iniciar…</p>
              )}
            </>
          ) : (
            <p className="guardado-nota">Esperando a que el anfitrión inicie…</p>
          )}
        </div>
      </div>
    )
  }

  // ---------- FINAL ----------
  if (sala.estado === 'final') {
    const [oro, plata, bronce] = sala.tabla
    return (
      <div className="screen sala final">
        <h1 className="sala-fin-titulo">🏆 Resultados finales</h1>
        <div className="podio">
          {plata && (
            <div className="podio-puesto plata">
              <Avatar foto={plata.foto} size={56} />
              <span className="podio-nombre">{plata.nombre}</span>
              <span className="podio-barra">2</span>
              <span className="podio-pts">{plata.score}</span>
            </div>
          )}
          {oro && (
            <div className="podio-puesto oro">
              <span className="podio-corona">👑</span>
              <Avatar foto={oro.foto} size={72} />
              <span className="podio-nombre">{oro.nombre}</span>
              <span className="podio-barra">1</span>
              <span className="podio-pts">{oro.score}</span>
            </div>
          )}
          {bronce && (
            <div className="podio-puesto bronce">
              <Avatar foto={bronce.foto} size={56} />
              <span className="podio-nombre">{bronce.nombre}</span>
              <span className="podio-barra">3</span>
              <span className="podio-pts">{bronce.score}</span>
            </div>
          )}
        </div>

        <ol className="tabla-final">
          {sala.tabla.map((j, i) => (
            <li key={j.id} className="tabla-fila">
              <span className="tabla-pos">{i + 1}</span>
              <Avatar foto={j.foto} size={32} />
              <span className="tabla-nombre">{j.nombre}</span>
              <span className="tabla-pts">{j.score}</span>
            </li>
          ))}
        </ol>

        <button className="btn-primary" onClick={salir}>
          Salir
        </button>
      </div>
    )
  }

  // ---------- PREGUNTA / REVELAR ----------
  const esRevelar = sala.estado === 'revelar'
  const restante = Math.max(0, Math.ceil((sala.deadline - ahora) / 1000))
  const pct = sala.tiempo ? Math.max(0, ((sala.deadline - ahora) / (sala.tiempo * 1000)) * 100) : 0

  function claseOpcion(i) {
    if (!esRevelar) return seleccion === i ? 'elegida' : ''
    if (i === sala.correcta) return 'correcta'
    if (i === sala.tuOpcion) return 'incorrecta'
    return 'atenuada'
  }

  return (
    <div className="screen sala juego">
      <div className="sala-controles">
        <button className="btn-link" onClick={salir}>
          ← Salir
        </button>
        {sala.esHost && (
          <button className="btn-terminar" onClick={() => terminarSala(codigo).then(setSala)}>
            ⛔ Terminar partida
          </button>
        )}
      </div>

      <header className="sala-top">
        <span className="sala-progreso">
          Pregunta {sala.idx + 1} / {sala.total}
        </span>
        {!esRevelar && <span className="sala-reloj">{restante}s</span>}
        {!esRevelar && (
          <span className="sala-respondieron">
            {sala.numRespondieron}/{sala.numJugadores} respondieron
          </span>
        )}
      </header>

      {!esRevelar && (
        <div className="cronometro">
          <div className="cronometro-barra" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="pregunta-texto">{sala.pregunta.enunciado}</div>

      {esRevelar && (
        <div className={`feedback ${sala.espectador ? 'ok' : sala.tuCorrecta ? 'ok' : 'mal'}`}>
          <div className="feedback-titulo">
            {sala.espectador
              ? '✅ Respuesta correcta resaltada'
              : sala.tuOpcion === null
                ? '⏱️ Sin responder'
                : sala.tuCorrecta
                  ? `✅ ¡Correcto! +${sala.ganancia}`
                  : '❌ Incorrecto'}
          </div>
          {sala.explicacion && <p className="feedback-explicacion">{sala.explicacion}</p>}
        </div>
      )}

      <div className="opciones-grid">
        {sala.pregunta.opciones.map((op, i) => (
          <button
            key={i}
            className={`opcion color-${i} ${claseOpcion(i)}`}
            disabled={esRevelar || seleccion !== null || sala.espectador}
            onClick={() => responder(i)}
          >
            <span className="opcion-forma">{FORMAS[i]}</span>
            <span className="opcion-texto">{op}</span>
          </button>
        ))}
      </div>

      {!esRevelar && sala.espectador && (
        <p className="guardado-nota">👁️ Eres espectador · controlas la partida</p>
      )}
      {!esRevelar && !sala.espectador && seleccion !== null && (
        <p className="guardado-nota">Respuesta enviada ✓ Esperando a los demás…</p>
      )}

      {esRevelar && (
        <>
          <ol className="tabla-final compacta">
            {sala.tabla.slice(0, 5).map((j, i) => (
              <li key={j.id} className="tabla-fila">
                <span className="tabla-pos">{i + 1}</span>
                <Avatar foto={j.foto} size={28} />
                <span className="tabla-nombre">{j.nombre}</span>
                {j.lastGain > 0 && <span className="tabla-gain">+{j.lastGain}</span>}
                <span className="tabla-pts">{j.score}</span>
              </li>
            ))}
          </ol>
          {sala.esHost ? (
            <button className="btn-primary" onClick={() => siguienteSala(codigo).then(setSala)}>
              {sala.idx + 1 < sala.total ? 'Siguiente pregunta →' : 'Ver resultados finales →'}
            </button>
          ) : (
            <p className="guardado-nota">Esperando al anfitrión…</p>
          )}
        </>
      )}
    </div>
  )
}
