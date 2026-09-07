import { useState, useEffect } from 'react'
import { fetchCarpetas, fetchMaterias, publicarContenido } from '../api.js'

const TIPOS = [
  { value: 'materia', label: 'Una materia' },
  { value: 'tema', label: 'Un tema' },
  { value: 'carpeta', label: 'Una carpeta completa' },
]

// Modal para publicar una materia, un tema suelto o una carpeta propia
// (completa, con sus preguntas) al banco de contenido de Comunidad. Se
// auto-publica visible de inmediato (moderación es posterior, por reportes).
export default function PublicarContenidoModal({ onCerrar, onPublicado }) {
  const [tipo, setTipo] = useState('materia')
  const [carpetas, setCarpetas] = useState([])
  const [materias, setMaterias] = useState([])
  const [materiaId, setMateriaId] = useState('') // materia elegida (tipo materia, o para filtrar temas)
  const [temaId, setTemaId] = useState('') // tema elegido (tipo tema)
  const [carpetaId, setCarpetaId] = useState('') // carpeta elegida (tipo carpeta)
  const [descripcion, setDescripcion] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [publicando, setPublicando] = useState(false)

  useEffect(() => {
    Promise.all([fetchCarpetas(), fetchMaterias()])
      .then(([c, m]) => {
        setCarpetas(c)
        setMaterias(m)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  function cambiarTipo(t) {
    setTipo(t)
    setError(null)
    setMateriaId('')
    setTemaId('')
    setCarpetaId('')
  }

  const materiaElegida = materias.find((m) => m.id === materiaId)
  const temasConPreguntas = (materiaElegida?.temas || []).filter((t) => t.preguntas > 0)

  const origenId = tipo === 'materia' ? materiaId : tipo === 'tema' ? temaId : carpetaId

  async function publicar() {
    setError(null)
    if (!origenId) {
      return setError(
        tipo === 'tema' && materiaId ? 'Elige qué tema publicar' : `Elige qué ${tipo} publicar`,
      )
    }
    setPublicando(true)
    try {
      const publicado = await publicarContenido({ tipo, origenId, descripcion: descripcion.trim() || null })
      onPublicado(publicado)
    } catch (e) {
      setError(e.message)
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={publicando ? undefined : onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-titulo">📤 Publicar a Comunidad</h3>
        <p className="cuenta-ayuda">
          Se sube una copia con sus preguntas tal como están ahora. Cualquiera podrá verla, votarla,
          comentarla y agregarla a su cuenta.
        </p>

        {cargando ? (
          <p className="cuenta-ayuda">Cargando…</p>
        ) : (
          <>
            <div className="tipo-toggle">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  className={`prompt-tab ${tipo === t.value ? 'active' : ''}`}
                  onClick={() => cambiarTipo(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tipo === 'materia' &&
              (materias.length === 0 ? (
                <p className="cuenta-ayuda">No tienes materias todavía.</p>
              ) : (
                <select className="form-input" value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
                  <option value="">Elige una materia…</option>
                  {materias.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.icono || '📚'} {m.nombre}
                    </option>
                  ))}
                </select>
              ))}

            {tipo === 'tema' &&
              (materias.length === 0 ? (
                <p className="cuenta-ayuda">No tienes materias todavía.</p>
              ) : (
                <>
                  <select
                    className="form-input"
                    value={materiaId}
                    onChange={(e) => {
                      setMateriaId(e.target.value)
                      setTemaId('')
                    }}
                  >
                    <option value="">Elige una materia…</option>
                    {materias.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.icono || '📚'} {m.nombre}
                      </option>
                    ))}
                  </select>
                  {materiaId && (
                    <select className="form-input" value={temaId} onChange={(e) => setTemaId(e.target.value)}>
                      <option value="">Elige un tema…</option>
                      {temasConPreguntas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre} ({t.preguntas} preguntas)
                        </option>
                      ))}
                    </select>
                  )}
                  {materiaId && temasConPreguntas.length === 0 && (
                    <p className="cuenta-ayuda">Esta materia no tiene temas con preguntas.</p>
                  )}
                </>
              ))}

            {tipo === 'carpeta' &&
              (carpetas.length === 0 ? (
                <p className="cuenta-ayuda">No tienes carpetas todavía.</p>
              ) : (
                <select className="form-input" value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)}>
                  <option value="">Elige una carpeta…</option>
                  {carpetas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              ))}

            <textarea
              className="form-input"
              rows={2}
              value={descripcion}
              placeholder="Describe brevemente el contenido (opcional)"
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </>
        )}

        {error && <p className="form-error">⚠️ {error}</p>}

        <div className="modal-acciones">
          <button className="btn-mini" onClick={onCerrar} disabled={publicando}>
            Cancelar
          </button>
          <button className="btn-mini primary" onClick={publicar} disabled={publicando || cargando}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
