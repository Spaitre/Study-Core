import GruposScreen from './GruposScreen.jsx'
import BancoPublicoScreen from './BancoPublicoScreen.jsx'
import MultijugadorScreen from './MultijugadorScreen.jsx'

// Apartados de Comunidad, como pestañas (los rankings quedan para más
// adelante, ver TASKS.md; se agregarían aquí como una pestaña más). El
// apartado activo vive en App (no aquí) para poder volver al mismo al salir
// de una sala de multijugador (igual que con el grupo abierto).
const APARTADOS = [
  { id: 'grupos', icono: '👥', label: 'Grupos de estudio' },
  { id: 'banco', icono: '🗂️', label: 'Banco de preguntas' },
  { id: 'multijugador', icono: '🎮', label: 'Multijugador' },
]

export default function ComunidadScreen({
  usuario,
  apartado,
  onCambiarApartado,
  onAbrirGrupo,
  onEntrarSala,
}) {
  return (
    <div className="screen comunidad">
      <header className="page-header">
        <h1>🌐 Comunidad</h1>
        <p className="subtitle">Aprende junto a otros estudiantes: grupos de estudio, banco de preguntas compartido, multijugador y, próximamente, rankings</p>
      </header>

      <div className="comunidad-tabs">
        {APARTADOS.map((a) => (
          <button
            key={a.id}
            className={`comunidad-tab ${apartado === a.id ? 'activo' : ''}`}
            onClick={() => onCambiarApartado(a.id)}
          >
            {a.icono} {a.label}
          </button>
        ))}
      </div>

      {apartado === 'grupos' && <GruposScreen onAbrir={onAbrirGrupo} />}
      {apartado === 'banco' && <BancoPublicoScreen usuario={usuario} />}
      {apartado === 'multijugador' && <MultijugadorScreen onEntrarSala={onEntrarSala} />}
    </div>
  )
}
