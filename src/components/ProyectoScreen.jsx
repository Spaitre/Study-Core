import Avatar from './Avatar.jsx'
import HomeScreen from './HomeScreen.jsx'
import useContenido from '../useContenido.js'

// Pantalla de un proyecto: misma interfaz que el inicio, pero el contenido
// (carpetas/materias/temas/preguntas) es del proyecto y compartido con todo el
// grupo. Reutiliza HomeScreen pasándole el catálogo y handlers del proyecto.
export default function ProyectoScreen({ proyecto, onIniciar, onVolver }) {
  const contenido = useContenido(proyecto.id, true)
  const soloLectura = !proyecto.puedeEditar

  return (
    <div className="screen proyecto">
      <header className="proyecto-encabezado">
        <button className="btn-link" onClick={onVolver}>
          ← Proyectos
        </button>
        <h1>📂 {proyecto.nombre}</h1>
        <div className="proyecto-miembros-fila">
          {proyecto.miembros.map((m) => (
            <span key={m.id} className="mini-avatar" title={m.nombreUsuario}>
              <Avatar foto={m.foto} size={30} />
            </span>
          ))}
          <span className="proyecto-compartido">Contenido compartido con el grupo</span>
        </div>
      </header>

      {contenido.error && <div className="banner-error">⚠️ {contenido.error}</div>}
      {soloLectura && (
        <div className="banner-ok">
          👁️ Modo solo lectura: el propietario permite que solo él modifique este proyecto.
        </div>
      )}

      {contenido.cargando ? (
        <div className="estado-carga">🧠 Cargando el proyecto…</div>
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
