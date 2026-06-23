import { useState, useEffect } from 'react'
import { fetchStats } from '../api.js'

export default function StatsScreen({ onVolver }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [])

  function colorBarra(p) {
    if (p >= 70) return 'verde'
    if (p >= 50) return 'amarillo'
    return 'rojo'
  }

  function fmtFecha(iso) {
    const d = new Date(iso)
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (error) {
    return (
      <div className="screen stats">
        <div className="banner-error">⚠️ {error}</div>
        <button className="btn-primary" onClick={onVolver}>
          ← Volver
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="screen stats">
        <div className="estado-carga">Cargando historial…</div>
      </div>
    )
  }

  const { global, porTema, recientes } = stats
  const pGlobal =
    global.total > 0 ? Math.round((global.aciertos / global.total) * 100) : 0

  const sinDatos = global.sesiones === 0

  return (
    <div className="screen stats">
      <header className="results-header">
        <h1>📊 Mi historial</h1>
        <p className="results-mensaje">Estadísticas acumuladas (SQLite)</p>
      </header>

      {sinDatos ? (
        <section className="panel">
          <p>
            Aún no has terminado ninguna sesión de estudio. ¡Completa un quiz y
            tus resultados aparecerán aquí!
          </p>
        </section>
      ) : (
        <>
          <div className="stats-resumen">
            <div className="stat-card">
              <span className="stat-num">{global.sesiones}</span>
              <span className="stat-label">sesiones</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{global.total}</span>
              <span className="stat-label">preguntas</span>
            </div>
            <div className="stat-card">
              <span className="stat-num">{pGlobal}%</span>
              <span className="stat-label">aciertos</span>
            </div>
          </div>

          <section className="panel">
            <h2>Aciertos por tema (acumulado)</h2>
            <div className="tema-resultados">
              {porTema.map((t) => {
                const p = Math.round((t.aciertos / t.total) * 100)
                return (
                  <div key={t.nombre} className="tema-resultado">
                    <div className="tema-resultado-info">
                      <span className="tema-resultado-nombre">{t.nombre}</span>
                      <span className="tema-resultado-num">
                        {t.aciertos}/{t.total} · {p}%
                      </span>
                    </div>
                    <div className="tema-resultado-barra-fondo">
                      <div
                        className={`tema-resultado-barra ${colorBarra(p)}`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel">
            <h2>Sesiones recientes</h2>
            <ul className="sesiones-lista">
              {recientes.map((s) => {
                const p = s.total > 0 ? Math.round((s.aciertos / s.total) * 100) : 0
                return (
                  <li key={s.id} className="sesion-item">
                    <span className="sesion-fecha">{fmtFecha(s.fecha)}</span>
                    <span className="sesion-materia">{s.materia ?? 'Mixto'}</span>
                    <span className="sesion-score">
                      {s.aciertos}/{s.total} · {p}%
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      <footer className="results-footer">
        <button className="btn-primary" onClick={onVolver}>
          ← Volver al inicio
        </button>
      </footer>
    </div>
  )
}
