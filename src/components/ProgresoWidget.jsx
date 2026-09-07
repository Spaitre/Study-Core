import { useState } from 'react'
import CajasModal from './CajasModal.jsx'

// Bloque compacto de gamificación en el sidebar: racha, nivel + barra de XP y,
// si hay cajas de regalo sin abrir, un botón para abrirlas.
export default function ProgresoWidget({ progreso, onCambio }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  if (!progreso) return null

  const { rachaActual, nivel, cajas, cajasPendientes } = progreso
  const pct = Math.max(0, Math.min(100, Math.round((nivel?.progreso ?? 1) * 100)))

  return (
    <div className="progreso-widget">
      <div className="progreso-fila">
        <span className="progreso-racha" title={`Racha de ${rachaActual} día${rachaActual === 1 ? '' : 's'}`}>
          🔥 {rachaActual}
        </span>
        <span className="progreso-nivel">{nivel?.nombre}</span>
      </div>
      <div className="progreso-barra" title={`${pct}% al siguiente nivel`}>
        <div className="progreso-barra-relleno" style={{ width: `${pct}%` }} />
      </div>

      {cajasPendientes > 0 && (
        <button className="progreso-cajas-btn" onClick={() => setModalAbierto(true)}>
          🎁 {cajasPendientes} {cajasPendientes === 1 ? 'caja' : 'cajas'} por abrir
        </button>
      )}

      {modalAbierto && (
        <CajasModal cajas={cajas} onCerrar={() => setModalAbierto(false)} onCambio={onCambio} />
      )}
    </div>
  )
}
