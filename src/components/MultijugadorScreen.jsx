import { useState, useEffect } from 'react'
import { fetchMaterias, fetchCarpetas, fetchProyectos, crearSala, unirseSala } from '../api.js'

const TIEMPOS = [
  { s: 10, label: '10s' },
  { s: 20, label: '20s' },
  { s: 30, label: '30s' },
  { s: 60, label: '1 min' },
]

export default function MultijugadorScreen({ onEntrarSala }) {
  const [carpetas, setCarpetas] = useState([]) // carpetas propias
  const [proyectoGrupos, setProyectoGrupos] = useState([]) // [{ proyecto, carpetas }]
  const [fuente, setFuente] = useState(null) // null | { id, nombre, proyectoId }
  const [materias, setMaterias] = useState([])
  const [materiaId, setMateriaId] = useState(null)
  const [temasSel, setTemasSel] = useState([])
  const [tiempo, setTiempo] = useState(20)
  const [hostJuega, setHostJuega] = useState(true)
  const [codigo, setCodigo] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [proyectos, propias] = await Promise.all([fetchProyectos(), fetchCarpetas()])
        setCarpetas(propias)
        // Carpetas de cada proyecto, agrupadas.
        const grupos = await Promise.all(
          proyectos.map((p) => fetchCarpetas(p.id).then((cc) => ({ proyecto: p, carpetas: cc }))),
        )
        setProyectoGrupos(grupos)
      } catch (e) {
        setError(e.message)
      }
    }
    cargar()
  }, [])

  // Al elegir una carpeta (propia o de un proyecto), carga sus materias.
  async function elegirFuente(f) {
    setError(null)
    setFuente(f)
    setMateriaId(null)
    setTemasSel([])
    setMaterias([])
    try {
      const ms = await fetchMaterias(f.proyectoId || null)
      setMaterias(ms.filter((m) => m.carpetaId === f.id))
    } catch (e) {
      setError(e.message)
    }
  }

  const materia = materias.find((m) => m.id === materiaId) || null

  function toggleTema(id) {
    setTemasSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const totalPreg = (materia?.temas ?? [])
    .filter((t) => temasSel.includes(t.id))
    .reduce((acc, t) => acc + t.preguntas, 0)

  async function crear() {
    setError(null)
    setCreando(true)
    try {
      const sala = await crearSala(temasSel, tiempo, hostJuega)
      onEntrarSala(sala)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreando(false)
    }
  }

  async function unirse(e) {
    e.preventDefault()
    setError(null)
    try {
      const sala = await unirseSala(codigo.trim())
      onEntrarSala(sala)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="screen multijugador">
      <header className="page-header">
        <h1>🎮 Multijugador</h1>
        <p className="subtitle">Juega quizzes con tus amigos en tiempo real</p>
      </header>

      {error && <div className="banner-error">⚠️ {error}</div>}

      {/* Unirse a una sala */}
      <section className="panel">
        <h2>Unirse a una sala</h2>
        <form className="agregar-form" onSubmit={unirse}>
          <input
            className="cuenta-input"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Código de 5 dígitos"
            inputMode="numeric"
          />
          <button className="btn-primary" type="submit" disabled={codigo.length !== 5}>
            Unirme
          </button>
        </form>
      </section>

      {/* Crear una sala */}
      <section className="panel">
        <h2>Crear una sala</h2>

        {/* Paso 1: fuente (proyectos primero, luego personal). Se resalta la elegida. */}
        <p className="mj-paso-label">1. Elige de dónde tomar las preguntas</p>

        {/* Carpetas propias */}
        <p className="mj-grupo-titulo">Carpetas propias</p>
        <div className="mj-materias">
          {carpetas.length === 0 ? (
            <p className="vacio">No tienes carpetas propias.</p>
          ) : (
            carpetas.map((c) => (
              <button
                key={`c-${c.id}`}
                className={`mj-materia ${
                  fuente && fuente.id === c.id && !fuente.proyectoId ? 'activo' : ''
                }`}
                onClick={() => elegirFuente({ id: c.id, nombre: c.nombre, proyectoId: null })}
              >
                📁 {c.nombre}
              </button>
            ))
          )}
        </div>

        {/* Carpetas de proyectos, agrupadas por proyecto */}
        {proyectoGrupos.length > 0 && (
          <>
            <p className="mj-grupo-titulo">Carpetas de proyectos</p>
            {proyectoGrupos.map((g) => (
              <div key={g.proyecto.id} className="mj-proyecto-grupo">
                <p className="mj-grupo-label">📂 {g.proyecto.nombre}</p>
                <div className="mj-materias">
                  {g.carpetas.length === 0 ? (
                    <p className="vacio">Sin carpetas.</p>
                  ) : (
                    g.carpetas.map((c) => (
                      <button
                        key={`pc-${c.id}`}
                        className={`mj-materia ${
                          fuente && fuente.id === c.id && fuente.proyectoId === g.proyecto.id
                            ? 'activo'
                            : ''
                        }`}
                        onClick={() =>
                          elegirFuente({ id: c.id, nombre: c.nombre, proyectoId: g.proyecto.id })
                        }
                      >
                        📁 {c.nombre}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Paso 2: materias de la fuente. Siguen visibles; se resalta la elegida. */}
        {fuente && (
          <>
            <p className="mj-paso-label">2. Elige una materia</p>
            <div className="mj-materias">
              {materias.length === 0 ? (
                <p className="vacio">Esta fuente no tiene materias con preguntas.</p>
              ) : (
                materias.map((m) => (
                  <button
                    key={m.id}
                    className={`mj-materia ${materiaId === m.id ? 'activo' : ''}`}
                    onClick={() => {
                      setMateriaId(m.id)
                      setTemasSel([])
                    }}
                  >
                    <span>{m.icono}</span> {m.nombre}
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* Paso 3: temas de la materia elegida */}
        {materia && (
          <>
            <p className="mj-paso-label">3. Marca los temas</p>
            <div className="mj-temas">
              {materia.temas.length === 0 ? (
                <p className="vacio">Esta materia no tiene temas.</p>
              ) : (
                materia.temas.map((t) => (
                  <label
                    key={t.id}
                    className={`amigo-check ${temasSel.includes(t.id) ? 'activo' : ''} ${
                      t.preguntas === 0 ? 'mj-tema-vacio' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={temasSel.includes(t.id)}
                      onChange={() => toggleTema(t.id)}
                      disabled={t.preguntas === 0}
                    />
                    <span>
                      {t.nombre} ({t.preguntas})
                    </span>
                  </label>
                ))
              )}
            </div>
          </>
        )}

        {/* Opciones de la sala */}
        <div className="mj-tiempo">
          <span className="proyecto-amigos-label">Tiempo por pregunta:</span>
          {TIEMPOS.map((t) => (
            <button
              key={t.s}
              className={`mj-tiempo-btn ${tiempo === t.s ? 'activo' : ''}`}
              onClick={() => setTiempo(t.s)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mj-tiempo">
          <span className="proyecto-amigos-label">Tu rol:</span>
          <button
            className={`mj-tiempo-btn ${hostJuega ? 'activo' : ''}`}
            onClick={() => setHostJuega(true)}
          >
            Participar
          </button>
          <button
            className={`mj-tiempo-btn ${!hostJuega ? 'activo' : ''}`}
            onClick={() => setHostJuega(false)}
          >
            Solo espectador
          </button>
        </div>

        <button
          className="btn-primary"
          onClick={crear}
          disabled={creando || temasSel.length === 0 || totalPreg === 0}
        >
          {creando ? 'Creando…' : `Crear sala (${totalPreg} preguntas)`}
        </button>
      </section>
    </div>
  )
}
