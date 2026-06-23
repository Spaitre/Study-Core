import { useState, useEffect } from 'react'
import Avatar from './Avatar.jsx'
import PermisoSelector from './PermisoSelector.jsx'
import {
  fetchProyectos,
  crearProyecto,
  unirseProyecto,
  editarProyecto,
  quitarMiembro,
  eliminarProyecto,
  salirProyecto,
  fetchAmigos,
} from '../api.js'

export default function ProyectosScreen({ onAbrir }) {
  const [proyectos, setProyectos] = useState([])
  const [amigos, setAmigos] = useState([])
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [permiso, setPermiso] = useState('todos')
  const [seleccion, setSeleccion] = useState([])
  const [codigo, setCodigo] = useState('')
  const [editando, setEditando] = useState(null)
  const [copiado, setCopiado] = useState(null)
  const [confirmar, setConfirmar] = useState(null) // { tipo, proyecto }
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  async function recargar() {
    try {
      const [p, a] = await Promise.all([fetchProyectos(), fetchAmigos()])
      setProyectos(p)
      setAmigos(a)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    recargar()
  }, [])

  async function crear(e) {
    e.preventDefault()
    setError(null)
    try {
      await crearProyecto(nombre.trim(), { permisoEdicion: permiso, acceso: seleccion })
      setNombre('')
      setPermiso('todos')
      setSeleccion([])
      setCreando(false)
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function unirse(e) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    try {
      const p = await unirseProyecto(codigo.trim())
      setCodigo('')
      setAviso(`Te uniste a "${p.nombre}" 🎉`)
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  function copiarCodigo(c) {
    navigator.clipboard?.writeText(c)
    setCopiado(c)
    setTimeout(() => setCopiado(null), 1500)
  }

  async function ejecutarConfirmacion() {
    const { tipo, proyecto } = confirmar
    setConfirmar(null)
    try {
      if (tipo === 'eliminar') await eliminarProyecto(proyecto.id)
      else await salirProyecto(proyecto.id)
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="screen proyectos">
      <header className="page-header">
        <h1>Proyectos</h1>
        <p className="subtitle">Carpetas compartidas con tus amigos</p>
      </header>

      {error && <div className="banner-error">⚠️ {error}</div>}
      {aviso && <div className="banner-ok">{aviso}</div>}

      {/* Unirse por código */}
      <section className="panel">
        <h2>Unirse a un proyecto</h2>
        <form className="agregar-form" onSubmit={unirse}>
          <input
            className="cuenta-input"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Código de 6 dígitos"
            inputMode="numeric"
          />
          <button className="btn-primary" type="submit" disabled={codigo.length !== 6}>
            Unirme
          </button>
        </form>
        <p className="cuenta-ayuda">Pide el código al creador del proyecto.</p>
      </section>

      {/* Tus proyectos */}
      <section className="panel">
        <div className="proyectos-top">
          <h2>Tus proyectos</h2>
          <button className="btn-primary" onClick={() => setCreando((v) => !v)}>
            {creando ? 'Cancelar' : '+ Nuevo proyecto'}
          </button>
        </div>

        {creando && (
          <form className="proyecto-form" onSubmit={crear}>
            <input
              className="cuenta-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del proyecto"
              maxLength={60}
              required
            />
            <PermisoSelector
              idBase="nuevo"
              permiso={permiso}
              setPermiso={setPermiso}
              seleccion={seleccion}
              setSeleccion={setSeleccion}
              personas={amigos}
            />
            <button className="btn-primary" type="submit" disabled={!nombre.trim()}>
              Crear proyecto
            </button>
          </form>
        )}

        {proyectos.length === 0 ? (
          <p className="vacio">No tienes proyectos todavía. Crea uno o únete con un código.</p>
        ) : (
          <ul className="proyecto-lista">
            {proyectos.map((p) => (
              <li key={p.id} className="proyecto-bloque">
                <div className="proyecto-item">
                  <button className="proyecto-abrir" onClick={() => onAbrir(p)}>
                    <span className="proyecto-icono">📂</span>
                    <span className="proyecto-info">
                      <span className="proyecto-nombre">{p.nombre}</span>
                      <span className="proyecto-meta">
                        {p.miembros.length} {p.miembros.length === 1 ? 'miembro' : 'miembros'}
                        {p.esPropietario ? ' · eres el propietario' : ''}
                        {p.permisoEdicion === 'solo_propietario' && !p.esPropietario
                          ? ' · solo lectura'
                          : ''}
                      </span>
                    </span>
                    <span className="proyecto-miembros-mini">
                      {p.miembros.slice(0, 4).map((m) => (
                        <span key={m.id} className="mini-avatar" title={m.nombreUsuario}>
                          <Avatar foto={m.foto} size={28} />
                        </span>
                      ))}
                    </span>
                  </button>

                  <button
                    className="btn-codigo"
                    title="Copiar código del proyecto"
                    onClick={() => copiarCodigo(p.codigo)}
                  >
                    🔑 {p.codigo} {copiado === p.codigo ? '✓' : '📋'}
                  </button>

                  {p.esPropietario ? (
                    <>
                      <button
                        className="btn-mini"
                        onClick={() => setEditando(editando === p.id ? null : p.id)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-mini-peligro"
                        onClick={() => setConfirmar({ tipo: 'eliminar', proyecto: p })}
                      >
                        Eliminar
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-mini-peligro"
                      onClick={() => setConfirmar({ tipo: 'salir', proyecto: p })}
                    >
                      Salir
                    </button>
                  )}
                </div>

                {editando === p.id && p.esPropietario && (
                  <EditarProyecto
                    proyecto={p}
                    amigos={amigos}
                    onGuardado={() => {
                      setEditando(null)
                      recargar()
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal de confirmación centrado */}
      {confirmar && (
        <div className="modal-overlay" onClick={() => setConfirmar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">
              {confirmar.tipo === 'eliminar' ? 'Eliminar proyecto' : 'Salir del proyecto'}
            </h3>
            <p className="modal-mensaje">
              {confirmar.tipo === 'eliminar'
                ? `¿Seguro que quieres eliminar "${confirmar.proyecto.nombre}"? Se borrará todo su contenido compartido para todos los miembros. Esta acción no se puede deshacer.`
                : `¿Seguro que quieres salir de "${confirmar.proyecto.nombre}"? Perderás el acceso hasta que vuelvas a unirte con el código.`}
            </p>
            <div className="modal-acciones">
              <button className="btn-mini" onClick={() => setConfirmar(null)}>
                Cancelar
              </button>
              <button className="btn-peligro" onClick={ejecutarConfirmacion}>
                {confirmar.tipo === 'eliminar' ? 'Sí, eliminar' : 'Sí, salir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Panel de edición de un proyecto (solo propietario): nombre, permiso (con lista
// selectiva) y miembros. Al guardar se cierra el panel.
function EditarProyecto({ proyecto, amigos, onGuardado }) {
  const [nombre, setNombre] = useState(proyecto.nombre)
  const [permiso, setPermiso] = useState(proyecto.permisoEdicion)
  const [seleccion, setSeleccion] = useState(proyecto.acceso || [])
  const [error, setError] = useState(null)

  // Personas elegibles: amigos + miembros que ya se unieron (sin el propietario).
  const porId = new Map()
  for (const a of amigos) porId.set(a.id, a)
  for (const m of proyecto.miembros) if (m.id !== proyecto.propietarioId) porId.set(m.id, m)
  const personas = [...porId.values()]

  async function guardar() {
    setError(null)
    try {
      await editarProyecto(proyecto.id, {
        nombre: nombre.trim(),
        permisoEdicion: permiso,
        acceso: seleccion,
      })
      onGuardado()
    } catch (e) {
      setError(e.message)
    }
  }

  async function quitar(uid) {
    await quitarMiembro(proyecto.id, uid)
    onGuardado()
  }

  return (
    <div className="proyecto-editar">
      {error && <div className="banner-error">⚠️ {error}</div>}

      <label className="cuenta-ayuda">Nombre del proyecto</label>
      <input className="cuenta-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />

      <PermisoSelector
        idBase={`edit-${proyecto.id}`}
        permiso={permiso}
        setPermiso={setPermiso}
        seleccion={seleccion}
        setSeleccion={setSeleccion}
        personas={personas}
      />

      <label className="cuenta-ayuda">Miembros</label>
      <ul className="amigo-lista">
        {proyecto.miembros.map((m) => (
          <li key={m.id} className="amigo-item">
            <Avatar foto={m.foto} size={36} />
            <div className="amigo-info">
              <span className="amigo-nombre">{m.nombreUsuario}</span>
              <span className="amigo-email">{m.email}</span>
            </div>
            <div className="amigo-acciones">
              {m.id === proyecto.propietarioId ? (
                <span className="estado-pendiente">Propietario</span>
              ) : (
                <button className="btn-mini-peligro" onClick={() => quitar(m.id)}>
                  Quitar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button className="btn-primary" onClick={guardar}>
        Guardar cambios
      </button>
    </div>
  )
}
