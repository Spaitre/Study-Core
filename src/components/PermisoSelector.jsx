import Avatar from './Avatar.jsx'

// Selector del permiso del proyecto (3 opciones). Si se elige 'selectivo',
// muestra una lista de personas para marcar quiénes pueden acceder/ver/modificar.
// Si no se marca a nadie, cualquiera con el código tiene acceso.
export default function PermisoSelector({ idBase, permiso, setPermiso, seleccion, setSeleccion, personas }) {
  function toggle(id) {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="permiso-bloque">
      <div className="proyecto-amigos-label">¿Quién puede modificar el proyecto?</div>
      <div className="permiso-opciones">
        <label className={`permiso-opcion ${permiso === 'todos' ? 'activo' : ''}`}>
          <input
            type="radio"
            name={`permiso-${idBase}`}
            checked={permiso === 'todos'}
            onChange={() => setPermiso('todos')}
          />
          Cualquier miembro (con el código)
        </label>
        <label className={`permiso-opcion ${permiso === 'solo_propietario' ? 'activo' : ''}`}>
          <input
            type="radio"
            name={`permiso-${idBase}`}
            checked={permiso === 'solo_propietario'}
            onChange={() => setPermiso('solo_propietario')}
          />
          Solo yo (los demás solo ven)
        </label>
        <label className={`permiso-opcion ${permiso === 'selectivo' ? 'activo' : ''}`}>
          <input
            type="radio"
            name={`permiso-${idBase}`}
            checked={permiso === 'selectivo'}
            onChange={() => setPermiso('selectivo')}
          />
          Selectivo (elijo quién puede acceder)
        </label>
      </div>

      {permiso === 'selectivo' && (
        <div className="selectivo-lista">
          {personas.length === 0 ? (
            <p className="cuenta-ayuda">
              No tienes amigos para elegir. Si no marcas a nadie, cualquiera con el código podrá
              acceder.
            </p>
          ) : (
            <>
              <div className="proyecto-amigos">
                {personas.map((a) => (
                  <label
                    key={a.id}
                    className={`amigo-check ${seleccion.includes(a.id) ? 'activo' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={seleccion.includes(a.id)}
                      onChange={() => toggle(a.id)}
                    />
                    <Avatar foto={a.foto} size={32} />
                    <span>{a.nombreUsuario}</span>
                  </label>
                ))}
              </div>
              <p className="cuenta-ayuda">
                Solo las personas marcadas (con el código) podrán acceder. Si no marcas a nadie,
                cualquiera con el código tendrá acceso.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
