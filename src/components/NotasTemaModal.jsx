import { useState, useEffect } from 'react'
import { fetchNotasTema, subirNotasTema, eliminarNotasTema } from '../api.js'

const FORMATOS = '.docx,.txt'

// Apuntes de un tema: sube un archivo (PDF/DOCX/TXT), el servidor lo
// convierte a HTML (con formato conservado si es .docx) y aquí se muestra
// para revisar antes de hacer el quiz.
export default function NotasTemaModal({ tema, onCerrar, onCambio }) {
  const [notasHtml, setNotasHtml] = useState(null)
  const [notasNombre, setNotasNombre] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const [sobre, setSobre] = useState(false)

  useEffect(() => {
    let activo = true
    setCargando(true)
    fetchNotasTema(tema.id)
      .then((d) => {
        if (!activo) return
        setNotasHtml(d.notasHtml)
        setNotasNombre(d.notasNombre)
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema.id])

  async function subir(file) {
    if (!file) return
    setError(null)
    setSubiendo(true)
    try {
      const d = await subirNotasTema(tema.id, file)
      const { notasHtml: html } = await fetchNotasTema(tema.id)
      setNotasHtml(html)
      setNotasNombre(d.notasNombre)
      onCambio?.(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function quitar() {
    setError(null)
    try {
      await eliminarNotasTema(tema.id)
      setNotasHtml(null)
      setNotasNombre(null)
      onCambio?.(false)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-notas" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">📄 Apuntes</h3>
        <p className="modal-mensaje">
          Tema: <strong>{tema.nombre}</strong>
        </p>

        {cargando ? (
          <p className="modal-mensaje">Cargando…</p>
        ) : notasHtml ? (
          <>
            <div className="notas-barra">
              <span className="notas-archivo">📎 {notasNombre}</span>
              <label className="btn-mini">
                {subiendo ? 'Subiendo…' : '🔄 Reemplazar'}
                <input
                  type="file"
                  accept={FORMATOS}
                  hidden
                  disabled={subiendo}
                  onChange={(e) => subir(e.target.files?.[0])}
                />
              </label>
              <button className="btn-mini" onClick={quitar} disabled={subiendo}>
                🗑️ Quitar
              </button>
            </div>
            <div className="notas-contenido" dangerouslySetInnerHTML={{ __html: notasHtml }} />
          </>
        ) : (
          <label
            className={`dropzone ${sobre ? 'sobre' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setSobre(true)
            }}
            onDragLeave={() => setSobre(false)}
            onDrop={(e) => {
              e.preventDefault()
              setSobre(false)
              subir(e.dataTransfer.files?.[0])
            }}
          >
            <input
              type="file"
              accept={FORMATOS}
              hidden
              disabled={subiendo}
              onChange={(e) => subir(e.target.files?.[0])}
            />
            <span className="dropzone-texto">
              {subiendo
                ? 'Procesando…'
                : 'Arrastra tu archivo de apuntes aquí o haz clic para elegirlo (Word o TXT, máx. 5 MB)'}
            </span>
          </label>
        )}

        {error && <p className="form-error">⚠️ {error}</p>}

        <div className="modal-acciones">
          <button className="btn-mini primary" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
