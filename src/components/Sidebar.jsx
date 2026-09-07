import { useState, useEffect } from 'react'
import MarcoAvatar from './MarcoAvatar.jsx'
import ProgresoWidget from './ProgresoWidget.jsx'

// Link de donación (Stripe Payment Link). Abre la página de pago alojada por
// Stripe; no requiere backend ni datos sensibles en el cliente.
const DONAR_URL = 'https://donate.stripe.com/bJedRa9JA3YRgkK3X58g000'

// Menú lateral de la pantalla principal: foto + nombre arriba y las opciones de
// navegación + cerrar sesión. En escritorio es una columna fija; en móvil se
// convierte en un drawer que se abre con el botón ☰ (ver index.css).
export default function Sidebar({
  usuario,
  screen,
  solicitudes = 0,
  progreso,
  onProgresoCambio,
  onNavigate,
  onLogout,
}) {
  const [abierto, setAbierto] = useState(false)
  const items = [
    { id: 'home', icono: '🏠', label: 'Inicio' },
    { id: 'comunidad', icono: '🌐', label: 'Comunidad' },
    { id: 'amigos', icono: '🫂', label: 'Amigos', badge: solicitudes },
    { id: 'cuenta', icono: '👤', label: 'Cuenta' },
  ]

  // Mientras el drawer está abierto: bloquea el scroll del fondo y permite
  // cerrar con la tecla Escape.
  useEffect(() => {
    if (!abierto) return
    const alTecla = (e) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.body.classList.add('menu-abierto-body')
    window.addEventListener('keydown', alTecla)
    return () => {
      document.body.classList.remove('menu-abierto-body')
      window.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  const navegar = (id) => {
    onNavigate(id)
    setAbierto(false)
  }
  const salir = () => {
    setAbierto(false)
    onLogout()
  }

  return (
    <>
      <button
        className="menu-hamburguesa"
        aria-label="Abrir menú"
        aria-expanded={abierto}
        onClick={() => setAbierto(true)}
      >
        ☰
      </button>
      {abierto && <div className="menu-backdrop" onClick={() => setAbierto(false)} />}

      <aside className={`sidebar ${abierto ? 'abierto' : ''}`}>
        <div className="sidebar-perfil">
          <MarcoAvatar foto={usuario?.foto} marco={usuario?.marco} size={84} />
          <div className="sidebar-nombre">{usuario?.nombreUsuario || 'Usuario'}</div>
          <div className="sidebar-email">{usuario?.invitado ? '👤 Invitado' : usuario?.email}</div>
          <ProgresoWidget progreso={progreso} onCambio={onProgresoCambio} />
        </div>

        <nav className="sidebar-nav">
          {items.map((it) => (
            <button
              key={it.id}
              className={`sidebar-item ${screen === it.id ? 'activo' : ''}`}
              onClick={() => navegar(it.id)}
            >
              <span className="sidebar-item-icono">{it.icono}</span>
              {it.label}
              {it.badge > 0 && <span className="sidebar-badge">{it.badge}</span>}
            </button>
          ))}
        </nav>

        <a
          className="sidebar-item sidebar-donar"
          href={DONAR_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAbierto(false)}
        >
          <span className="sidebar-item-icono">💜</span>
          Apoyar Study Core
        </a>

        <button className="sidebar-item sidebar-logout" onClick={salir}>
          <span className="sidebar-item-icono">🚪</span>
          Cerrar sesión
        </button>
      </aside>
    </>
  )
}
