import Avatar from './Avatar.jsx'

// Menú lateral izquierdo de la pantalla principal: foto + nombre arriba y las
// opciones de navegación (Inicio, Cuenta, Amigos) y cerrar sesión.
export default function Sidebar({ usuario, screen, solicitudes = 0, onNavigate, onLogout }) {
  const items = [
    { id: 'home', icono: '🏠', label: 'Inicio' },
    { id: 'proyectos', icono: '📂', label: 'Proyectos' },
    { id: 'multijugador', icono: '🎮', label: 'Multijugador' },
    { id: 'amigos', icono: '🫂', label: 'Amigos', badge: solicitudes },
    { id: 'cuenta', icono: '👤', label: 'Cuenta' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-perfil">
        <Avatar foto={usuario?.foto} size={84} />
        <div className="sidebar-nombre">{usuario?.nombreUsuario || 'Usuario'}</div>
        <div className="sidebar-email">{usuario?.invitado ? '👤 Invitado' : usuario?.email}</div>
      </div>

      <nav className="sidebar-nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={`sidebar-item ${screen === it.id ? 'activo' : ''}`}
            onClick={() => onNavigate(it.id)}
          >
            <span className="sidebar-item-icono">{it.icono}</span>
            {it.label}
            {it.badge > 0 && <span className="sidebar-badge">{it.badge}</span>}
          </button>
        ))}
      </nav>

      <button className="sidebar-item sidebar-logout" onClick={onLogout}>
        <span className="sidebar-item-icono">🚪</span>
        Cerrar sesión
      </button>
    </aside>
  )
}
