import { useState, useEffect } from 'react'
import { fetchFacetasPublicas, fetchContenidoPublico } from '../api.js'
import PublicarContenidoModal from './PublicarContenidoModal.jsx'
import DetalleContenidoModal from './DetalleContenidoModal.jsx'
import ModeracionModal from './ModeracionModal.jsx'

const TIPOS = [
  { value: 'materia', label: 'Materias' },
  { value: 'tema', label: 'Temas' },
  { value: 'carpeta', label: 'Carpetas' },
]

// Ícono del tipo de contenido en las tarjetas y en el detalle.
function iconoTipo(it) {
  if (it.tipo === 'carpeta') return '📁'
  if (it.tipo === 'tema') return '📄'
  return it.icono || '📚'
}

function filtrosVacios() {
  return { tipo: [], materia: [], tema: [], dificultad: [], categoria: [], buscar: '' }
}

// Lista de checkboxes para una faceta de selección múltiple (no se muestra
// si no hay valores posibles todavía).
function FiltroCheckbox({ etiqueta, opciones, valores, onToggle }) {
  if (opciones.length === 0) return null
  return (
    <div className="filtro-grupo">
      <h4>{etiqueta}</h4>
      <div className="filtro-checks">
        {opciones.map((o) => (
          <label key={o.value} className="filtro-check">
            <input type="checkbox" checked={valores.includes(o.value)} onChange={() => onToggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  )
}

// Convierte una lista plana de valores de faceta (strings) al shape
// {value, label} que espera FiltroCheckbox.
function comoOpciones(valores) {
  return valores.map((v) => ({ value: v, label: v }))
}

// Banco de contenido público: barra lateral de filtros de selección múltiple
// (tipo, materia, tema, dificultad, categoría de caso clínico) + cuadrícula
// de lo publicado.
export default function BancoPublicoScreen({ usuario, onIniciarQuiz }) {
  const [facetas, setFacetas] = useState({ materias: [], temas: [], dificultades: [], categorias: [] })
  const [filtros, setFiltros] = useState(filtrosVacios())
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [modalPublicar, setModalPublicar] = useState(false)
  const [modalModeracion, setModalModeracion] = useState(false)
  const [detalleId, setDetalleId] = useState(null)

  function cargarFacetas() {
    fetchFacetasPublicas().then(setFacetas).catch(() => {})
  }

  useEffect(() => {
    cargarFacetas()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      setItems(await fetchContenidoPublico(filtros))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros])

  function set(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  // Agrega/quita un valor de una faceta de selección múltiple.
  function toggle(campo, valor) {
    setFiltros((f) => {
      const actuales = f[campo]
      const nuevos = actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor]
      return { ...f, [campo]: nuevos }
    })
  }

  function alPublicar() {
    setModalPublicar(false)
    setAviso('¡Publicado! Ya es visible para todos.')
    cargarFacetas()
    cargar()
  }

  const hayFiltrosActivos = Object.values(filtros).some((v) => (Array.isArray(v) ? v.length > 0 : v))

  return (
    <section className="panel banco-publico">
      <div className="banco-publico-header">
        <h2>🗂️ Banco de preguntas</h2>
        <div className="banco-publico-acciones">
          {!!usuario?.esAdmin && (
            <button className="btn-mini" onClick={() => setModalModeracion(true)}>
              🛡️ Moderación
            </button>
          )}
          <button className="btn-mini primary" onClick={() => setModalPublicar(true)}>
            + Publicar
          </button>
        </div>
      </div>
      <p className="cuenta-ayuda">
        Materias y carpetas completas publicadas por otros estudiantes. Vótalas, coméntalas o
        agrégalas a tu cuenta.
      </p>

      {error && <div className="banner-error">⚠️ {error}</div>}
      {aviso && <div className="banner-ok">{aviso}</div>}

      <div className="banco-publico-layout">
        <aside className="banco-publico-filtros">
          <input
            className="form-input"
            value={filtros.buscar}
            placeholder="🔎 Buscar…"
            onChange={(e) => set('buscar', e.target.value)}
          />

          <FiltroCheckbox
            etiqueta="Tipo"
            opciones={TIPOS}
            valores={filtros.tipo}
            onToggle={(v) => toggle('tipo', v)}
          />
          <FiltroCheckbox
            etiqueta="Materia"
            opciones={comoOpciones(facetas.materias)}
            valores={filtros.materia}
            onToggle={(v) => toggle('materia', v)}
          />
          <FiltroCheckbox
            etiqueta="Tema"
            opciones={comoOpciones(facetas.temas)}
            valores={filtros.tema}
            onToggle={(v) => toggle('tema', v)}
          />
          <FiltroCheckbox
            etiqueta="Dificultad"
            opciones={comoOpciones(facetas.dificultades)}
            valores={filtros.dificultad}
            onToggle={(v) => toggle('dificultad', v)}
          />
          <FiltroCheckbox
            etiqueta="Categoría"
            opciones={comoOpciones(facetas.categorias)}
            valores={filtros.categoria}
            onToggle={(v) => toggle('categoria', v)}
          />

          {hayFiltrosActivos && (
            <button className="btn-mini" onClick={() => setFiltros(filtrosVacios())}>
              Limpiar filtros
            </button>
          )}
        </aside>

        <div className="banco-publico-resultados">
          {cargando ? (
            <p className="cuenta-ayuda">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="cuenta-ayuda">
              {hayFiltrosActivos
                ? 'Nada coincide con esos filtros.'
                : 'Todavía no hay nada publicado. ¡Sé el primero!'}
            </p>
          ) : (
            <div className="contenido-grid">
              {items.map((it) => (
                <button key={it.id} className="contenido-card" onClick={() => setDetalleId(it.id)}>
                  <div className="contenido-card-icono">{iconoTipo(it)}</div>
                  <div className="contenido-card-nombre">{it.nombre}</div>
                  <div className="cuenta-ayuda">por {it.autorNombre || 'anónimo'}</div>
                  <div className="contenido-card-meta">
                    <span>{it.totalTemas} temas</span>
                    <span>{it.totalPreguntas} preguntas</span>
                    <span className={it.haVotado ? 'contenido-card-votado' : ''}>👍 {it.votos}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalPublicar && (
        <PublicarContenidoModal onCerrar={() => setModalPublicar(false)} onPublicado={alPublicar} />
      )}
      {modalModeracion && <ModeracionModal onCerrar={() => setModalModeracion(false)} />}
      {detalleId != null && (
        <DetalleContenidoModal
          id={detalleId}
          onCerrar={() => setDetalleId(null)}
          onCambio={cargar}
          onIniciarQuiz={onIniciarQuiz}
        />
      )}
    </section>
  )
}
