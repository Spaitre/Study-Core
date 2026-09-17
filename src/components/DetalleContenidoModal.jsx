import { useState, useEffect, useRef } from 'react'
import {
  fetchDetalleContenido,
  votarContenido,
  comentarContenido,
  reportarContenido,
  importarContenido,
  eliminarContenidoPublico,
  fetchCarpetas,
} from '../api.js'

const OPCIONES_TIEMPO = [
  { valor: 30, etiqueta: '30 segundos', icono: '⏱️' },
  { valor: 60, etiqueta: '1 minuto', icono: '🕐' },
  { valor: null, etiqueta: 'Sin tiempo', icono: '∞' },
]

// Detalle de una materia/carpeta publicada: contenido, voto, comentarios,
// importar a la cuenta propia, jugarla directo y reportar.
export default function DetalleContenidoModal({ id, usuario, onCerrar, onCambio, onIniciarQuiz }) {
  const [detalle, setDetalle] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [tiempo, setTiempo] = useState(30)
  const [comentario, setComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [votando, setVotando] = useState(false)
  const [votoPulso, setVotoPulso] = useState(false)
  const [reportando, setReportando] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [carpetas, setCarpetas] = useState([])
  const [carpetaDestino, setCarpetaDestino] = useState('')
  const [importando, setImportando] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [temasSel, setTemasSel] = useState([])
  const [verApuntes, setVerApuntes] = useState(null) // temaId | null

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
  const esDueno = !!(usuario && detalle && usuario.id === detalle.autorId)

  // Todos los temas de lo publicado (una materia/carpeta puede traer
  // varios), para poder elegir con cuáles jugar al hacerlo directo sin
  // importar antes a la cuenta propia.
  const todosTemas = (detalle?.datos?.materias ?? []).flatMap((m) => m.temas ?? [])
  const temaApuntes = todosTemas.find((t) => t.id === verApuntes) ?? null

  useEffect(() => {
    if (necesitaCarpeta) fetchCarpetas().then(setCarpetas).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesitaCarpeta])

  // Al cargar el detalle (una sola vez por id), selecciona todos los temas
  // por defecto. No se repite en recargas posteriores (votar, comentar…)
  // para no pisar una selección que el usuario ya haya ajustado a mano.
  const temasInicializados = useRef(null)
  useEffect(() => {
    if (detalle && temasInicializados.current !== id) {
      temasInicializados.current = id
      setTemasSel(todosTemas.map((t) => t.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle, id])

  function toggleTemaSel(temaId) {
    setTemasSel((prev) =>
      prev.includes(temaId) ? prev.filter((id) => id !== temaId) : [...prev, temaId],
    )
  }

  async function votar() {
    setVotando(true)
    setError(null)
    try {
      await votarContenido(id)
      await cargar()
      setVotoPulso(true)
      setTimeout(() => setVotoPulso(false), 350)
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

  function comenzarQuiz() {
    // Si hay más de un tema, se manda la selección para filtrar; con uno
    // solo no hace falta (siempre son todas sus preguntas).
    const temaIds = todosTemas.length > 1 ? temasSel : null
    onIniciarQuiz?.(id, detalle.nombre, tiempo, temaIds)
    onCerrar()
  }

  async function eliminarPropio() {
    setEliminando(true)
    setError(null)
    try {
      await eliminarContenidoPublico(id)
      onCambio?.()
      onCerrar()
    } catch (e) {
      setError(e.message)
      setEliminando(false)
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

        {onIniciarQuiz && detalle.totalPreguntas > 0 && (
          <div className="detalle-jugar">
            {todosTemas.length > 1 && (
              <div className="filtro-grupo">
                <h4>Elige los temas</h4>
                <div className="filtro-checks">
                  {todosTemas.map((t) => (
                    <label key={t.id} className="checkbox-linea">
                      <input
                        type="checkbox"
                        checked={temasSel.includes(t.id)}
                        onChange={() => toggleTemaSel(t.id)}
                      />
                      {t.nombre} ({(t.preguntas ?? []).length} preguntas)
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="tiempo-grid tiempo-grid-compacto">
              {OPCIONES_TIEMPO.map((op) => (
                <button
                  key={op.etiqueta}
                  className={`tiempo-card ${tiempo === op.valor ? 'active' : ''}`}
                  onClick={() => setTiempo(op.valor)}
                >
                  <span className="tiempo-icono">{op.icono}</span>
                  <span className="tiempo-etiqueta">{op.etiqueta}</span>
                </button>
              ))}
            </div>
            <button
              className="btn-primary"
              onClick={comenzarQuiz}
              disabled={todosTemas.length > 1 && temasSel.length === 0}
            >
              ▶ Comenzar quiz →
            </button>
          </div>
        )}

        <div className="detalle-contenido-acciones">
          <button
            className={`btn-mini ${detalle.haVotado ? 'primary' : ''} ${votoPulso ? 'voto-pulso' : ''}`}
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
          {esDueno ? (
            <button
              className="btn-quitar-op"
              title="Quitar de Comunidad"
              onClick={() => setConfirmandoEliminar(true)}
            >
              🗑️
            </button>
          ) : (
            <button className="btn-quitar-op" title="Reportar contenido" onClick={() => setReportando(true)}>
              🚩
            </button>
          )}
        </div>

        {aviso && <div className="banner-ok">{aviso}</div>}
        {error && <p className="form-error">⚠️ {error}</p>}

        <div className="detalle-contenido-materias">
          {detalle.datos.materias.map((m) => (
            <div key={m.id} className="previa-item">
              <strong>
                {m.icono} {m.nombre}
              </strong>
              {(m.temas ?? []).length === 0 ? (
                <p className="cuenta-ayuda">Sin temas</p>
              ) : (
                <ul className="detalle-temas-lista">
                  {m.temas.map((t) => (
                    <li key={t.id}>
                      {t.nombre}
                      {t.notasHtml && (
                        <button
                          className="btn-mini detalle-ver-apuntes"
                          onClick={() => setVerApuntes(t.id)}
                        >
                          📄 Apuntes
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
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

        {temaApuntes && (
          <div className="modal-overlay" onClick={() => setVerApuntes(null)}>
            <div className="modal modal-notas" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-titulo">📄 Apuntes</h3>
              <p className="cuenta-ayuda">
                Tema: <strong>{temaApuntes.nombre}</strong>
              </p>
              <div className="notas-contenido" dangerouslySetInnerHTML={{ __html: temaApuntes.notasHtml }} />
              <div className="modal-acciones">
                <button className="btn-mini primary" onClick={() => setVerApuntes(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

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

        {confirmandoEliminar && (
          <div className="modal-overlay" onClick={() => setConfirmandoEliminar(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-titulo">🗑️ Quitar de Comunidad</h3>
              <p className="modal-mensaje">
                ¿Seguro que quieres quitar "{detalle.nombre}" del banco de preguntas? Ya no será
                visible para nadie más (quien ya la haya agregado a su cuenta conserva su copia).
              </p>
              <div className="modal-acciones">
                <button
                  className="btn-mini"
                  onClick={() => setConfirmandoEliminar(false)}
                  disabled={eliminando}
                >
                  Cancelar
                </button>
                <button className="btn-peligro" onClick={eliminarPropio} disabled={eliminando}>
                  {eliminando ? 'Quitando…' : 'Sí, quitar'}
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
