import { useState, useEffect } from 'react'
import { fetchModeracionContenido, ocultarContenido, descartarReportesContenido } from '../api.js'

// Cola de moderación del banco público: contenido (materias/carpetas)
// reportado, ordenado por más reportes primero. Solo para usuario.esAdmin.
export default function ModeracionModal({ onCerrar }) {
  const [contenido, setContenido] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [procesandoId, setProcesandoId] = useState(null)

  async function cargar() {
    setCargando(true)
    try {
      setContenido(await fetchModeracionContenido())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function ocultar(id) {
    setProcesandoId(id)
    try {
      await ocultarContenido(id)
      setContenido((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setProcesandoId(null)
    }
  }

  async function descartar(id) {
    setProcesandoId(id)
    try {
      await descartarReportesContenido(id)
      setContenido((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal modal-importar" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">🛡️ Moderación — reportes</h3>

        {error && <p className="form-error">⚠️ {error}</p>}
        {cargando ? (
          <p className="cuenta-ayuda">Cargando…</p>
        ) : contenido.length === 0 ? (
          <p className="cuenta-ayuda">No hay contenido reportado. Todo tranquilo.</p>
        ) : (
          contenido.map((c) => (
            <div key={c.id} className="previa-item">
              <strong>
                {c.tipo === 'carpeta' ? '📁' : c.tipo === 'tema' ? '📄' : '📚'} {c.nombre}
              </strong>
              <p className="cuenta-ayuda">
                por {c.autorNombre || 'anónimo'} · <strong>{c.totalReportes}</strong> reporte
                {c.totalReportes === 1 ? '' : 's'}
              </p>
              {c.motivos && <p className="cuenta-ayuda">Motivos: {c.motivos}</p>}
              <div className="modal-acciones">
                <button
                  className="btn-mini"
                  disabled={procesandoId === c.id}
                  onClick={() => descartar(c.id)}
                >
                  Descartar reportes
                </button>
                <button
                  className="btn-peligro"
                  disabled={procesandoId === c.id}
                  onClick={() => ocultar(c.id)}
                >
                  Ocultar contenido
                </button>
              </div>
            </div>
          ))
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
