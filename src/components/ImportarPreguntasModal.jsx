import { useState } from 'react'
import { analizarArchivo, confirmarImportacion } from '../api.js'

const FORMATOS = '.pdf,.docx,.txt'
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

// Prompts listos para copiar y pedirle a una IA que genere las preguntas/
// flashcards en el formato exacto que esta app sabe importar.
const PROMPTS = {
  enarm: {
    etiqueta: 'ENARM',
    texto: `Eres un médico experto en la preparación para el ENARM. Genera [NÚMERO] preguntas tipo ENARM sobre el tema "[TEMA]".

Cada pregunta debe tener una viñeta clínica realista y 4 opciones (A a D) con una sola respuesta correcta. Devuélvelas EXACTAMENTE en este formato de texto plano (sin markdown, sin negritas, sin numerar y sin ningún texto adicional):

Enunciado del caso clínico y la pregunta
A) Primera opción
B) Segunda opción
C) Tercera opción
D) Cuarta opción
Respuesta: (la letra correcta)
Explicación: (por qué esa es correcta y por qué las demás no)

Separa cada pregunta de la siguiente con UN renglón en blanco. No agregues títulos, introducciones ni comentarios fuera de ese formato.`,
  },
  caso: {
    etiqueta: 'Solo caso clínico',
    texto: `Eres un médico educador. Genera [NÚMERO] preguntas de caso clínico sobre el tema "[TEMA]".

Cada pregunta presenta un caso clínico breve seguido de una pregunta directa, con 4 opciones (A a D) y una sola respuesta correcta. Devuélvelas EXACTAMENTE en este formato de texto plano (sin markdown, sin negritas, sin numerar y sin ningún texto adicional):

Caso clínico breve y la pregunta
A) Primera opción
B) Segunda opción
C) Tercera opción
D) Cuarta opción
Respuesta: (la letra correcta)
Explicación: (justificación breve)

Separa cada pregunta de la siguiente con UN renglón en blanco. No agregues títulos ni texto adicional.`,
  },
  flashcard: {
    etiqueta: 'Flashcards',
    texto: `Eres un médico educador. Genera [NÚMERO] flashcards de estudio sobre el tema "[TEMA]".

Cada flashcard tiene un frente (un concepto, dato clave o pregunta breve) y un reverso (la respuesta o explicación). Devuélvelas EXACTAMENTE en este formato de texto plano (sin markdown, sin negritas, sin numerar y sin ningún texto adicional):

Frente de la flashcard
Reverso: respuesta o explicación del frente

Separa cada flashcard de la siguiente con UN renglón en blanco. No agregues títulos ni texto adicional.`,
  },
}

export default function ImportarPreguntasModal({ tema, onCerrar, onImportado }) {
  // Pasos: 'subir' | 'previa' | 'fin'
  const [paso, setPaso] = useState('subir')
  const [archivo, setArchivo] = useState(null)
  const [sobre, setSobre] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [errores, setErrores] = useState([])
  const [resultado, setResultado] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [tipoPrompt, setTipoPrompt] = useState('enarm')

  function copiarPrompt() {
    navigator.clipboard
      ?.writeText(PROMPTS[tipoPrompt].texto)
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
      })
      .catch(() => {})
  }

  function tomarArchivo(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      setError('Formato no soportado. Usa PDF, Word (.docx) o texto (.txt).')
      return
    }
    setError(null)
    setArchivo(f)
  }

  async function analizar() {
    if (!archivo || cargando) return
    setCargando(true)
    setError(null)
    try {
      const r = await analizarArchivo(tema.id, archivo)
      setPreguntas(r.preguntas || [])
      setErrores(r.errores || [])
      setPaso('previa')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  async function confirmar() {
    if (preguntas.length === 0 || cargando) return
    setCargando(true)
    setError(null)
    try {
      const r = await confirmarImportacion(tema.id, preguntas)
      setResultado(r)
      onImportado(r.totalTema)
      setPaso('fin')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  // ----- Edición de la vista previa -----
  function editarPregunta(i, campo, valor) {
    setPreguntas((prev) =>
      prev.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)),
    )
  }
  function editarOpcion(i, j, valor) {
    setPreguntas((prev) =>
      prev.map((p, k) =>
        k === i
          ? { ...p, opciones: p.opciones.map((o, l) => (l === j ? valor : o)) }
          : p,
      ),
    )
  }
  function marcarCorrecta(i, j) {
    setPreguntas((prev) =>
      prev.map((p, k) => (k === i ? { ...p, respuestaCorrecta: j } : p)),
    )
  }
  function agregarOpcion(i) {
    setPreguntas((prev) =>
      prev.map((p, k) =>
        k === i && p.opciones.length < 6
          ? { ...p, opciones: [...p.opciones, ''] }
          : p,
      ),
    )
  }
  function quitarOpcion(i, j) {
    setPreguntas((prev) =>
      prev.map((p, k) => {
        if (k !== i || p.opciones.length <= 2) return p
        const opciones = p.opciones.filter((_, l) => l !== j)
        let rc = p.respuestaCorrecta
        if (j === rc) rc = 0
        else if (j < rc) rc = rc - 1
        return { ...p, opciones, respuestaCorrecta: rc }
      }),
    )
  }
  function eliminarPregunta(i) {
    setPreguntas((prev) => prev.filter((_, k) => k !== i))
  }

  return (
    <div className="modal-overlay" onClick={cargando ? undefined : onCerrar}>
      <div
        className="modal modal-importar"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-titulo">📥 Importar preguntas</h3>
        <p className="modal-mensaje">
          Tema: <strong>{tema.nombre}</strong>
        </p>

        {paso === 'subir' && (
          <>
            {/* Instrucciones ARRIBA del recuadro de arrastre */}
            <div className="formato-ayuda">
              <strong>¿Cómo formular las preguntas?</strong>
              <p className="formato-sub">
                Copia este prompt y pídele a una IA (ChatGPT, Gemini, Claude…)
                que genere las preguntas. Reemplaza <code>[NÚMERO]</code> y{' '}
                <code>[TEMA]</code>, pega el resultado en un archivo .txt o Word
                y arrástralo aquí.
              </p>
              <div className="prompt-tabs">
                {Object.entries(PROMPTS).map(([id, p]) => (
                  <button
                    key={id}
                    className={`prompt-tab ${tipoPrompt === id ? 'active' : ''}`}
                    onClick={() => {
                      setTipoPrompt(id)
                      setCopiado(false)
                    }}
                  >
                    {p.etiqueta}
                  </button>
                ))}
              </div>
              <pre className="formato-ejemplo">{PROMPTS[tipoPrompt].texto}</pre>
              <button className="btn-mini" onClick={copiarPrompt}>
                {copiado ? '✓ Copiado' : '📋 Copiar prompt'}
              </button>
            </div>

            <label
              className={`dropzone ${sobre ? 'sobre' : ''} ${archivo ? 'con-archivo' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(true)
              }}
              onDragLeave={() => setSobre(false)}
              onDrop={(e) => {
                e.preventDefault()
                setSobre(false)
                tomarArchivo(e.dataTransfer.files?.[0])
              }}
            >
              <input
                type="file"
                accept={FORMATOS}
                hidden
                onChange={(e) => tomarArchivo(e.target.files?.[0])}
              />
              {archivo ? (
                <span className="dropzone-archivo">📎 {archivo.name}</span>
              ) : (
                <span className="dropzone-texto">
                  Arrastra tu archivo aquí o haz clic para elegirlo
                </span>
              )}
            </label>

            {error && <p className="form-error">⚠️ {error}</p>}

            <div className="modal-acciones">
              <button className="btn-mini" onClick={onCerrar} disabled={cargando}>
                Cancelar
              </button>
              <button
                className="btn-mini primary"
                onClick={analizar}
                disabled={!archivo || cargando}
              >
                {cargando ? 'Analizando…' : 'Analizar archivo'}
              </button>
            </div>
          </>
        )}

        {paso === 'previa' && (
          <>
            <div className="import-resumen">
              ✅ <strong>{preguntas.length}</strong> pregunta(s) detectada(s)
              {errores.length > 0 && (
                <>
                  {' '}
                  · ⚠️ <strong>{errores.length}</strong> con error
                </>
              )}
              <span className="import-nota">
                {' '}
                — puedes editarlas antes de importar.
              </span>
            </div>

            {/* Vista previa editable de las preguntas válidas */}
            {preguntas.length > 0 && (
              <div className="import-lista">
                {preguntas.map((p, i) => (
                  <div key={i} className="previa-item editable">
                    <div className="previa-cab">
                      <span className="previa-num">
                        {p.tipo === 'flashcard'
                          ? `🃏 Flashcard ${i + 1}`
                          : `Pregunta ${i + 1}`}
                      </span>
                      <button
                        className="btn-quitar-preg"
                        title="Quitar de la importación"
                        onClick={() => eliminarPregunta(i)}
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={p.pregunta}
                      placeholder={
                        p.tipo === 'flashcard'
                          ? 'Frente de la flashcard'
                          : 'Enunciado de la pregunta'
                      }
                      onChange={(e) => editarPregunta(i, 'pregunta', e.target.value)}
                    />
                    {p.tipo !== 'flashcard' && (
                      <div className="edit-opciones">
                        {p.opciones.map((o, j) => (
                          <div key={j} className="edit-opcion">
                            <input
                              type="radio"
                              name={`correcta-${i}`}
                              checked={j === p.respuestaCorrecta}
                              onChange={() => marcarCorrecta(i, j)}
                              title="Marcar como respuesta correcta"
                            />
                            <span className="edit-letra">{LETRAS[j]}</span>
                            <input
                              className="form-input"
                              value={o}
                              placeholder={`Opción ${LETRAS[j]}`}
                              onChange={(e) => editarOpcion(i, j, e.target.value)}
                            />
                            {p.opciones.length > 2 && (
                              <button
                                className="btn-quitar-op"
                                title="Quitar opción"
                                onClick={() => quitarOpcion(i, j)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {p.opciones.length < 6 && (
                          <button className="btn-mini" onClick={() => agregarOpcion(i)}>
                            + Opción
                          </button>
                        )}
                      </div>
                    )}
                    <textarea
                      className="form-input"
                      rows={2}
                      value={p.explicacion || ''}
                      placeholder={
                        p.tipo === 'flashcard'
                          ? 'Reverso de la flashcard'
                          : 'Explicación (opcional)'
                      }
                      onChange={(e) => editarPregunta(i, 'explicacion', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Lista de errores para corregir manualmente */}
            {errores.length > 0 && (
              <details className="import-errores" open={preguntas.length === 0}>
                <summary>
                  ⚠️ {errores.length} bloque(s) no se pudieron interpretar
                  (corrígelos en tu archivo y vuelve a importar)
                </summary>
                {errores.map((er, i) => (
                  <div key={i} className="error-item">
                    <div className="error-motivo">Motivo: {er.motivo}</div>
                    <pre className="error-texto">{er.texto}</pre>
                  </div>
                ))}
              </details>
            )}

            {error && <p className="form-error">⚠️ {error}</p>}

            <div className="modal-acciones">
              <button
                className="btn-mini"
                onClick={() => setPaso('subir')}
                disabled={cargando}
              >
                ← Volver
              </button>
              <button
                className="btn-mini primary"
                onClick={confirmar}
                disabled={preguntas.length === 0 || cargando}
              >
                {cargando
                  ? 'Importando…'
                  : `Importar ${preguntas.length} pregunta(s)`}
              </button>
            </div>
          </>
        )}

        {paso === 'fin' && resultado && (
          <div className="import-exito">
            <p>
              ✅ Se importaron <strong>{resultado.insertadas}</strong> pregunta(s)
              nueva(s)
              {resultado.omitidas > 0 &&
                ` (${resultado.omitidas} omitidas por estar duplicadas)`}
              . El tema ahora tiene <strong>{resultado.totalTema}</strong>.
            </p>
            <div className="modal-acciones">
              <button className="btn-mini primary" onClick={onCerrar}>
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
