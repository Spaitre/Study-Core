import { useMemo } from 'react'

const COLORES = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']

// Confeti simple en CSS puro (sin canvas ni librerías): un puñado de divs que
// caen y giran. Pensado para un momento único al montar (buen puntaje).
export default function Confeti({ cantidad = 40 }) {
  const piezas = useMemo(
    () =>
      Array.from({ length: cantidad }, (_, i) => ({
        id: i,
        izquierda: Math.random() * 100,
        color: COLORES[i % COLORES.length],
        retraso: Math.random() * 0.4,
        duracion: 2 + Math.random() * 1.2,
        giro: Math.round(Math.random() * 360),
      })),
    [cantidad],
  )

  return (
    <div className="confeti-zona" aria-hidden="true">
      {piezas.map((p) => (
        <span
          key={p.id}
          className="confeti-pieza"
          style={{
            left: `${p.izquierda}%`,
            background: p.color,
            animationDelay: `${p.retraso}s`,
            animationDuration: `${p.duracion}s`,
            transform: `rotate(${p.giro}deg)`,
          }}
        />
      ))}
    </div>
  )
}
