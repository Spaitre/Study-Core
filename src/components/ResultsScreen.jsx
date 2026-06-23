export default function ResultsScreen({ resultados, onReiniciar, onVerStats }) {
  const total = resultados.length
  const aciertos = resultados.filter((r) => r.correcta).length
  const porcentajeGlobal = total > 0 ? Math.round((aciertos / total) * 100) : 0

  // Agrupa los resultados por tema para calcular el porcentaje de cada uno.
  const porTema = {}
  resultados.forEach((r) => {
    if (!porTema[r.temaId]) {
      porTema[r.temaId] = { nombre: r.temaNombre, total: 0, aciertos: 0 }
    }
    porTema[r.temaId].total += 1
    if (r.correcta) porTema[r.temaId].aciertos += 1
  })
  const temas = Object.values(porTema)

  // Mensaje motivacional según el desempeño global.
  function mensaje(p) {
    if (p >= 90) return '¡Excelente dominio! 🏆'
    if (p >= 70) return '¡Muy bien! Vas por buen camino 💪'
    if (p >= 50) return 'Vas avanzando, sigue repasando 📖'
    return 'A reforzar estos temas 🔁'
  }

  function colorBarra(p) {
    if (p >= 70) return 'verde'
    if (p >= 50) return 'amarillo'
    return 'rojo'
  }

  return (
    <div className="screen results">
      <header className="results-header">
        <h1>Resultados</h1>
        <p className="results-mensaje">{mensaje(porcentajeGlobal)}</p>
      </header>

      <div className="puntaje-global">
        <div className="puntaje-circulo">
          <span className="puntaje-num">{porcentajeGlobal}%</span>
          <span className="puntaje-detalle">
            {aciertos} / {total} aciertos
          </span>
        </div>
      </div>

      <section className="panel">
        <h2>Desempeño por tema</h2>
        <div className="tema-resultados">
          {temas.map((t) => {
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

      <p className="guardado-nota">✓ Sesión guardada en tu historial</p>

      <footer className="results-footer">
        <button className="btn-ghost" onClick={onVerStats}>
          📊 Ver historial
        </button>
        <button className="btn-primary" onClick={onReiniciar}>
          🔁 Estudiar de nuevo
        </button>
      </footer>
    </div>
  )
}
