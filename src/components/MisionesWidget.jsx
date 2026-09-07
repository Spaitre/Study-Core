import { useState, useEffect } from 'react'
import { fetchMisiones } from '../api.js'

// Resumen compacto de misiones de bienvenida en Inicio: barra de progreso +
// nombres cortos, sin descripciones (el detalle completo vive en Cuenta).
// Se muestra solo mientras falte alguna por completar.
export default function MisionesWidget() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    fetchMisiones().then(setDatos).catch(() => {})
  }, [])

  if (!datos || datos.misiones.every((m) => m.completada)) return null

  const total = datos.misiones.length
  const completadas = datos.misiones.filter((m) => m.completada).length
  const pct = Math.round((completadas / total) * 100)

  return (
    <section className="panel misiones-widget">
      <div className="misiones-widget-cab">
        <h2>🎯 Misiones</h2>
        <span className="misiones-widget-contador">
          {completadas}/{total}
        </span>
      </div>
      <div className="misiones-widget-barra">
        <div className="misiones-widget-barra-relleno" style={{ width: `${pct}%` }} />
      </div>
      <ul className="misiones-widget-chips">
        {datos.misiones.map((m) => (
          <li key={m.clave} className={m.completada ? 'hecha' : ''}>
            {m.completada ? '✅' : '⬜'} {m.nombre}
          </li>
        ))}
      </ul>
      <p className="cuenta-ayuda">Recompensa: avatar 🦊 zorro · detalle en Cuenta</p>
    </section>
  )
}
