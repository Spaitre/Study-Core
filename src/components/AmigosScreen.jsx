import { useState, useEffect } from 'react'
import Avatar from './Avatar.jsx'
import {
  fetchAmigos,
  fetchSolicitudes,
  fetchEnviadas,
  solicitarAmigo,
  aceptarAmigo,
  eliminarAmistad,
} from '../api.js'

export default function AmigosScreen() {
  const [tab, setTab] = useState('amigos') // 'amigos' | 'agregar' | 'solicitudes'
  const [amigos, setAmigos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [enviadas, setEnviadas] = useState([])
  const [identificador, setIdentificador] = useState('')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  async function recargar() {
    try {
      const [a, s, e] = await Promise.all([
        fetchAmigos(),
        fetchSolicitudes(),
        fetchEnviadas(),
      ])
      setAmigos(a)
      setSolicitudes(s)
      setEnviadas(e)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    recargar()
  }, [])

  async function enviarSolicitud(e) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    try {
      const r = await solicitarAmigo(identificador.trim())
      setIdentificador('')
      setAviso(r.estado === 'aceptada' ? '¡Ahora son amigos! 🎉' : 'Solicitud enviada ✓')
      recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function aceptar(id) {
    await aceptarAmigo(id)
    recargar()
  }
  async function quitar(id) {
    await eliminarAmistad(id)
    recargar()
  }

  function PersonaRow({ p, children }) {
    return (
      <li className="amigo-item">
        <Avatar foto={p.foto} size={44} />
        <div className="amigo-info">
          <span className="amigo-nombre">{p.nombreUsuario}</span>
          <span className="amigo-email">{p.email}</span>
        </div>
        <div className="amigo-acciones">{children}</div>
      </li>
    )
  }

  const tabs = [
    { id: 'amigos', label: `Amigos (${amigos.length})` },
    { id: 'agregar', label: 'Agregar amigos' },
    { id: 'solicitudes', label: `Solicitudes${solicitudes.length ? ` (${solicitudes.length})` : ''}` },
  ]

  return (
    <div className="screen amigos">
      <header className="page-header">
        <h1>Amigos</h1>
        <p className="subtitle">Conecta con otros usuarios</p>
      </header>

      <div className="amigos-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`amigos-tab ${tab === t.id ? 'activo' : ''}`}
            onClick={() => {
              setTab(t.id)
              setError(null)
              setAviso(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="banner-error">⚠️ {error}</div>}
      {aviso && <div className="banner-ok">{aviso}</div>}

      {tab === 'amigos' && (
        <section className="panel">
          {amigos.length === 0 ? (
            <p className="vacio">Aún no tienes amigos. Agrega a alguien desde "Agregar amigos".</p>
          ) : (
            <ul className="amigo-lista">
              {amigos.map((p) => (
                <PersonaRow key={p.amistadId} p={p}>
                  <button className="btn-mini-peligro" onClick={() => quitar(p.amistadId)}>
                    Eliminar
                  </button>
                </PersonaRow>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'agregar' && (
        <section className="panel">
          <h2>Agregar un amigo</h2>
          <form className="agregar-form" onSubmit={enviarSolicitud}>
            <input
              className="cuenta-input"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Correo o nombre de usuario"
            />
            <button className="btn-primary" type="submit" disabled={!identificador.trim()}>
              Enviar solicitud
            </button>
          </form>
          <p className="cuenta-ayuda">
            Le llegará una solicitud de amistad. Aparecerá como “pendiente” hasta que la
            acepte.
          </p>

          {enviadas.length > 0 && (
            <>
              <h2 className="amigos-subtitulo">Solicitudes enviadas</h2>
              <ul className="amigo-lista">
                {enviadas.map((p) => (
                  <PersonaRow key={p.amistadId} p={p}>
                    <span className="estado-pendiente">Pendiente</span>
                    <button className="btn-mini" onClick={() => quitar(p.amistadId)}>
                      Cancelar
                    </button>
                  </PersonaRow>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'solicitudes' && (
        <section className="panel">
          {solicitudes.length === 0 ? (
            <p className="vacio">No tienes solicitudes de amistad pendientes.</p>
          ) : (
            <ul className="amigo-lista">
              {solicitudes.map((p) => (
                <PersonaRow key={p.amistadId} p={p}>
                  <button className="btn-mini-ok" onClick={() => aceptar(p.amistadId)}>
                    Aceptar
                  </button>
                  <button className="btn-mini-peligro" onClick={() => quitar(p.amistadId)}>
                    Rechazar
                  </button>
                </PersonaRow>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
