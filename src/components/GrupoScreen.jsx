import { useState, useEffect } from 'react'
import Avatar from './Avatar.jsx'
import HomeScreen from './HomeScreen.jsx'
import useContenido from '../useContenido.js'
import { estadisticasGrupo, fetchObjetivos, crearObjetivo, eliminarObjetivo } from '../api.js'

// Pantalla de un grupo de estudio: misma interfaz que el inicio, pero el
// contenido (carpetas/materias/temas/preguntas) es del grupo y compartido con
// todos sus miembros. Reutiliza HomeScreen pasándole el catálogo y handlers
// del grupo, y agrega estadísticas colectivas + objetivos grupales.
export default function GrupoScreen({ grupo, onIniciar, onVolver }) {
  const contenido = useContenido(grupo.id, true)
  const soloLectura = !grupo.puedeEditar

  return (
    <div className="screen grupo">
      <header className="grupo-encabezado">
        <button className="btn-link" onClick={onVolver}>
          ← Comunidad
        </button>
        <h1>👥 {grupo.nombre}</h1>
        <div className="grupo-miembros-fila">
          {grupo.miembros.map((m) => (
            <span key={m.id} className="mini-avatar" title={m.nombreUsuario}>
              <Avatar foto={m.foto} size={30} />
            </span>
          ))}
          <span className="grupo-compartido">Contenido compartido con el grupo</span>
        </div>
      </header>

      {contenido.error && <div className="banner-error">⚠️ {contenido.error}</div>}
      {soloLectura && (
        <div className="banner-ok">
          👁️ Modo solo lectura: el propietario permite que solo él modifique este grupo.
        </div>
      )}

      <EstadisticasGrupo grupoId={grupo.id} totalMiembros={grupo.miembros.length} />
      <ObjetivosGrupo grupo={grupo} materias={contenido.materias} />

      {contenido.cargando ? (
        <div className="estado-carga">🧠 Cargando el grupo…</div>
      ) : (
        <div className={soloLectura ? 'solo-lectura' : ''}>
          <HomeScreen
            materias={contenido.materias}
            carpetas={contenido.carpetas}
            onIniciar={onIniciar}
            onVerStats={() => {}}
            ocultarEncabezado
            {...contenido.handlers}
          />
        </div>
      )}
    </div>
  )
}

// Preguntas respondidas y precisión promedio del grupo (sobre su contenido
// compartido). Se calcula en el servidor a partir del historial real.
function EstadisticasGrupo({ grupoId, totalMiembros }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    estadisticasGrupo(grupoId)
      .then(setStats)
      .catch(() => {})
  }, [grupoId])

  return (
    <section className="panel grupo-stats">
      <div className="grupo-stat">
        <span className="grupo-stat-valor">{totalMiembros}</span>
        <span className="grupo-stat-label">{totalMiembros === 1 ? 'miembro' : 'miembros'}</span>
      </div>
      <div className="grupo-stat">
        <span className="grupo-stat-valor">{stats ? stats.preguntasRespondidas : '—'}</span>
        <span className="grupo-stat-label">preguntas respondidas</span>
      </div>
      <div className="grupo-stat">
        <span className="grupo-stat-valor">{stats ? `${stats.precisionPromedio}%` : '—'}</span>
        <span className="grupo-stat-label">precisión promedio</span>
      </div>
    </section>
  )
}

// Retos colectivos: "completar N preguntas (de una materia, o de todo el
// grupo) desde que se creó el objetivo". El progreso lo calcula el servidor.
function ObjetivosGrupo({ grupo, materias }) {
  const [objetivos, setObjetivos] = useState([])
  const [formAbierto, setFormAbierto] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [materiaId, setMateriaId] = useState('')
  const [meta, setMeta] = useState(100)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    fetchObjetivos(grupo.id)
      .then(setObjetivos)
      .catch((e) => setError(e.message))
  }
  useEffect(cargar, [grupo.id])

  async function crear(e) {
    e.preventDefault()
    if (!descripcion.trim() || !meta) return
    setGuardando(true)
    setError(null)
    try {
      await crearObjetivo(grupo.id, {
        descripcion: descripcion.trim(),
        materiaId: materiaId || null,
        meta: Number(meta),
      })
      setDescripcion('')
      setMateriaId('')
      setMeta(100)
      setFormAbierto(false)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(id) {
    try {
      await eliminarObjetivo(grupo.id, id)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="panel">
      <div className="grupos-top">
        <h2>🎯 Objetivos del grupo</h2>
        <button className="btn-mini" onClick={() => setFormAbierto((v) => !v)}>
          {formAbierto ? 'Cancelar' : '+ Nuevo objetivo'}
        </button>
      </div>

      {error && <div className="banner-error">⚠️ {error}</div>}

      {formAbierto && (
        <form className="grupo-form" onSubmit={crear}>
          <input
            className="cuenta-input"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder='Ej. "Completar 500 preguntas de cardiología esta semana"'
            maxLength={140}
            required
          />
          <div className="grupo-objetivo-campos">
            <select
              className="form-input"
              value={materiaId}
              onChange={(e) => setMateriaId(e.target.value)}
            >
              <option value="">Todo el contenido del grupo</option>
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icono} {m.nombre}
                </option>
              ))}
            </select>
            <input
              className="cuenta-input"
              type="number"
              min="1"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Meta (preguntas)"
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear objetivo'}
          </button>
        </form>
      )}

      {objetivos.length === 0 ? (
        <p className="vacio">
          Sin objetivos activos. Crea uno para que el grupo avance junto hacia una meta.
        </p>
      ) : (
        <ul className="grupo-objetivo-lista">
          {objetivos.map((o) => {
            const pct = Math.min(100, Math.round((o.avance / o.meta) * 100))
            const materia = materias.find((m) => m.id === o.materiaId)
            return (
              <li key={o.id} className="grupo-objetivo-item">
                <div className="grupo-objetivo-cab">
                  <span className="grupo-objetivo-desc">
                    {o.descripcion}
                    {materia && <span className="grupo-objetivo-materia"> · {materia.nombre}</span>}
                  </span>
                  {grupo.esPropietario && (
                    <button
                      className="btn-quitar-preg"
                      title="Eliminar objetivo"
                      onClick={() => borrar(o.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="grupo-objetivo-barra">
                  <div className="grupo-objetivo-progreso" style={{ width: `${pct}%` }} />
                </div>
                <span className="grupo-objetivo-cifras">
                  {o.avance} / {o.meta} ({pct}%)
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
