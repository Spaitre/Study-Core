import { useState, useEffect } from 'react'
import {
  fetchPreguntasTema,
  crearPregunta,
  editarPregunta,
  eliminarPregunta,
} from '../api.js'

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

function borradorNuevo() {
  return {
    id: null,
    tipo: 'opcion',
    pregunta: '',
    opciones: ['', '', '', ''],
    respuestaCorrecta: 0,
    explicacion: '',
  }
}

export default function GestionPreguntasModal({
  tema,
  modoInicial = 'lista',
  onCerrar,
  onCambio,
}) {
  const [preguntas, setPreguntas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [borrador, setBorrador] = useState(
    modoInicial === 'nueva' ? borradorNuevo() : null,
  )
  const [guardando, setGuardando] = useState(false)
  const [borrarId, setBorrarId] = useState(null)

  async function cargar() {
    try {
      const lista = await fetchPreguntasTema(tema.id)
      setPreguntas(lista)
      return lista
    } catch (e) {
      setError(e.message)
      return []
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- Edición del borrador -----
  const set = (campo, valor) => setBorrador((b) => ({ ...b, [campo]: valor }))
  const setOpcion = (j, valor) =>
    setBorrador((b) => ({
      ...b,
      opciones: b.opciones.map((o, k) => (k === j ? valor : o)),
    }))
  const addOpcion = () =>
    setBorrador((b) =>
      b.opciones.length < 6 ? { ...b, opciones: [...b.opciones, ''] } : b,
    )
  const quitarOpcion = (j) =>
    setBorrador((b) => {
      if (b.opciones.length <= 2) return b
      const opciones = b.opciones.filter((_, k) => k !== j)
      let rc = b.respuestaCorrecta
      if (j === rc) rc = 0
      else if (j < rc) rc = rc - 1
      return { ...b, opciones, respuestaCorrecta: rc }
    })

  function editar(p) {
    setBorrador({
      id: p.id,
      tipo: p.tipo === 'flashcard' ? 'flashcard' : 'opcion',
      pregunta: p.pregunta,
      opciones: p.opciones.length ? p.opciones : ['', '', '', ''],
      respuestaCorrecta: p.respuestaCorrecta >= 0 ? p.respuestaCorrecta : 0,
      explicacion: p.explicacion || '',
    })
    setError(null)
  }

  async function guardar() {
    if (!borrador.pregunta.trim()) {
      setError(
        borrador.tipo === 'flashcard'
          ? 'Falta el frente de la flashcard'
          : 'Falta el enunciado',
      )
      return
    }
    setGuardando(true)
    setError(null)
    const payload =
      borrador.tipo === 'flashcard'
        ? {
            tipo: 'flashcard',
            pregunta: borrador.pregunta,
            opciones: [],
            respuestaCorrecta: -1,
            explicacion: borrador.explicacion,
          }
        : {
            tipo: 'opcion',
            pregunta: borrador.pregunta,
            opciones: borrador.opciones,
            respuestaCorrecta: borrador.respuestaCorrecta,
            explicacion: borrador.explicacion || null,
          }
    try {
      if (borrador.id) await editarPregunta(borrador.id, payload)
      else await crearPregunta(tema.id, payload)
      const lista = await cargar()
      onCambio(lista.length)
      setBorrador(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarBorrar(id) {
    setGuardando(true)
    try {
      await eliminarPregunta(id)
      const lista = await cargar()
      onCambio(lista.length)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
      setBorrarId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={guardando ? undefined : onCerrar}>
      <div
        className="modal modal-importar"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-titulo">📝 Preguntas — {tema.nombre}</h3>

        {borrador ? (
          /* ----- Editor de una pregunta (nueva o existente) ----- */
          <div className="previa-item editable">
            <div className="tipo-toggle">
              <button
                className={`prompt-tab ${borrador.tipo === 'opcion' ? 'active' : ''}`}
                onClick={() => set('tipo', 'opcion')}
              >
                Opción múltiple
              </button>
              <button
                className={`prompt-tab ${borrador.tipo === 'flashcard' ? 'active' : ''}`}
                onClick={() => set('tipo', 'flashcard')}
              >
                Flashcard
              </button>
            </div>

            <textarea
              className="form-input"
              rows={2}
              value={borrador.pregunta}
              placeholder={
                borrador.tipo === 'flashcard'
                  ? 'Frente de la flashcard'
                  : 'Enunciado de la pregunta'
              }
              onChange={(e) => set('pregunta', e.target.value)}
            />

            {borrador.tipo === 'opcion' && (
              <div className="edit-opciones">
                {borrador.opciones.map((o, j) => (
                  <div key={j} className="edit-opcion">
                    <input
                      type="radio"
                      name="correcta-gestion"
                      checked={j === borrador.respuestaCorrecta}
                      onChange={() => set('respuestaCorrecta', j)}
                      title="Marcar como correcta"
                    />
                    <span className="edit-letra">{LETRAS[j]}</span>
                    <input
                      className="form-input"
                      value={o}
                      placeholder={`Opción ${LETRAS[j]}`}
                      onChange={(e) => setOpcion(j, e.target.value)}
                    />
                    {borrador.opciones.length > 2 && (
                      <button
                        className="btn-quitar-op"
                        title="Quitar opción"
                        onClick={() => quitarOpcion(j)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {borrador.opciones.length < 6 && (
                  <button className="btn-mini" onClick={addOpcion}>
                    + Opción
                  </button>
                )}
              </div>
            )}

            <textarea
              className="form-input"
              rows={2}
              value={borrador.explicacion}
              placeholder={
                borrador.tipo === 'flashcard'
                  ? 'Reverso de la flashcard'
                  : 'Explicación (opcional)'
              }
              onChange={(e) => set('explicacion', e.target.value)}
            />

            {error && <p className="form-error">⚠️ {error}</p>}

            <div className="modal-acciones">
              <button
                className="btn-mini"
                onClick={() => {
                  setBorrador(null)
                  setError(null)
                }}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                className="btn-mini primary"
                onClick={guardar}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : borrador.id ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        ) : (
          /* ----- Lista de preguntas ----- */
          <>
            <div className="modal-acciones" style={{ justifyContent: 'flex-start' }}>
              <button
                className="btn-mini primary"
                onClick={() => setBorrador(borradorNuevo())}
              >
                ➕ Agregar pregunta
              </button>
            </div>

            {error && <p className="form-error">⚠️ {error}</p>}

            {cargando ? (
              <p className="modal-mensaje">Cargando…</p>
            ) : preguntas.length === 0 ? (
              <p className="modal-mensaje">
                Este tema aún no tiene preguntas. Agrega una con el botón de
                arriba.
              </p>
            ) : (
              <div className="import-lista">
                {preguntas.map((p) => (
                  <div key={p.id} className="gestion-item">
                    <div className="gestion-texto">
                      <span className="gestion-badge">
                        {p.tipo === 'flashcard' ? '🃏' : '🔘'}
                      </span>
                      {p.pregunta}
                    </div>
                    {borrarId === p.id ? (
                      <div className="gestion-acciones">
                        <span className="gestion-confirm">¿Eliminar?</span>
                        <button
                          className="btn-mini"
                          onClick={() => setBorrarId(null)}
                        >
                          No
                        </button>
                        <button
                          className="btn-peligro btn-peligro-sm"
                          onClick={() => confirmarBorrar(p.id)}
                          disabled={guardando}
                        >
                          Sí
                        </button>
                      </div>
                    ) : (
                      <div className="gestion-acciones">
                        <button className="btn-mini" onClick={() => editar(p)}>
                          ✏️ Editar
                        </button>
                        <button
                          className="btn-mini"
                          onClick={() => setBorrarId(p.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-acciones">
              <button className="btn-mini" onClick={onCerrar}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
