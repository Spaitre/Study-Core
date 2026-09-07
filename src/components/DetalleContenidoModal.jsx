import { useState, useEffect } from 'react'
import {
  fetchDetalleContenido,
  votarContenido,
  comentarContenido,
  reportarContenido,
  importarContenido,
  fetchCarpetas,
} from '../api.js'

// Detalle de una materia/carpeta publicada: contenido, voto, comentarios,
// importar a la cuenta propia y reportar.
export default function DetalleContenidoModal({ id, onCerrar, onCambio }) {
  const [detalle, setDetalle] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [comentario, setComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [votando, setVotando] = useState(false)
  const [reportando, setReportando] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [carpetas, setCarpetas] = useState([])
  const [carpetaDestino, setCarpetaDestino] = useState('')
  const [importando, setImportando] = useState(false)

  async function cargar() {
    try {
      setDetalle(await fetchDetalleContenido(id))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Una materia o un tema se agregan DENTRO de una carpeta propia; una
  // carpeta se importa completa, así que no necesita destino.
  const necesitaCarpeta = detalle && detalle.tipo !== 'carpeta'

  useEffect(() => {
    if (necesitaCarpeta) fetchCarpetas().then(setCarpetas).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesitaCarpeta])

  async function votar() {
    setVotando(true)
    setError(null)
    try {
      await votarContenido(id)
      await cargar()
      onCambio?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setVotando(false)
    }
  }

  async function enviarComentario() {
    const texto = comentario.trim()
    if (!texto) return
    setEnviandoComentario(true)
    setError(null)
    try {
      const comentarios = await comentarContenido(id, texto)
      setDetalle((d) => ({ ...d, comentarios }))
      setComentario('')
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviandoComentario(false)
    }
  }

  async function confirmarReporte() {
    try {
      await reportarContenido(id, motivoReporte.trim() || null)
      setAviso('Gracias, reportamos el contenido a moderación.')
      setReportando(false)
    } catch (e) {
      setError(e.message)
    }
  }

  async function importar() {
    setError(null)
    if (necesitaCarpeta && !carpetaDestino) {
      setError('Elige a qué carpeta agregarla')
      return
    }
    setImportando(true)
    try {
      await importarContenido(id, necesitaCarpeta ? { carpetaDestinoId: carpetaDestino } : {})
      setAviso('¡Agregado a tu cuenta!')
    } catch (e) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  if (!detalle) {
    return (
      <div className="modal-overlay" onClick={onCerrar}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          {error ? <p className="form-error">⚠️ {error}</p> : <p className="cuenta-ayuda">Cargando…</p>}
          <div className="modal-acciones">
            <button className="btn-mini" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-importar" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">
          {detalle.tipo === 'carpeta' ? '📁' : detalle.tipo === 'tema' ? '📄' : detalle.icono || '📚'}{' '}
          {detalle.nombre}
        </h3>
        <p className="cuenta-ayuda">
          Por {detalle.autorNombre || 'anónimo'} · {detalle.totalTemas} temas · {detalle.totalPreguntas}{' '}
          preguntas
        </p>
        {detalle.descripcion && <p className="modal-mensaje">{detalle.descripcion}</p>}

        <div className="detalle-contenido-acciones">
          <button
            className={`btn-mini ${detalle.haVotado ? 'primary' : ''}`}
            onClick={votar}
            disabled={votando}
          >
            👍 {detalle.votos}
          </button>
          {necesitaCarpeta && (
            <select
              className="form-input"
              value={carpetaDestino}
              onChange={(e) => setCarpetaDestino(e.target.value)}
            >
              <option value="">Agregar a…</option>
              {carpetas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
          <button className="btn-mini primary" onClick={importar} disabled={importando}>
            {importando ? 'Agregando…' : '+ Agregar a mi cuenta'}
          </button>
          <button className="btn-quitar-op" title="Reportar contenido" onClick={() => setReportando(true)}>
            🚩
          </button>
        </div>

        {aviso && <div className="banner-ok">{aviso}</div>}
        {error && <p className="form-error">⚠️ {error}</p>}

        <div className="detalle-contenido-materias">
          {detalle.datos.materias.map((m) => (
            <div key={m.id} className="previa-item">
              <strong>
                {m.icono} {m.nombre}
              </strong>
              <p className="cuenta-ayuda">{m.temas.map((t) => t.nombre).join(', ') || 'Sin temas'}</p>
            </div>
          ))}
        </div>

        <h4>💬 Comentarios</h4>
        <div className="comentarios-lista">
          {detalle.comentarios.length === 0 && <p className="cuenta-ayuda">Sé el primero en opinar.</p>}
          {detalle.comentarios.map((c) => (
            <div key={c.id} className="comentario-item">
              <strong>{c.autorNombre}:</strong> {c.texto}
            </div>
          ))}
        </div>
        <div className="comentario-nuevo">
          <input
            className="form-input"
            value={comentario}
            placeholder="Escribe un comentario…"
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviarComentario()}
          />
          <button className="btn-mini primary" onClick={enviarComentario} disabled={enviandoComentario}>
            Enviar
          </button>
        </div>

        {reportando && (
          <div className="modal-overlay" onClick={() => setReportando(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-titulo">🚩 Reportar contenido</h3>
              <textarea
                className="form-input"
                rows={3}
                value={motivoReporte}
                placeholder="¿Qué está mal? (opcional)"
                onChange={(e) => setMotivoReporte(e.target.value)}
              />
              <div className="modal-acciones">
                <button className="btn-mini" onClick={() => setReportando(false)}>
                  Cancelar
                </button>
                <button className="btn-peligro" onClick={confirmarReporte}>
                  Reportar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="modal-acciones">
          <button className="btn-mini" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
