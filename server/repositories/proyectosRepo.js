// Repositorio de proyectos colaborativos: proyectos, miembros y lista blanca.
//
// Los métodos aceptan un `exec` opcional (la conexión global por defecto, o un
// `tx` dentro de withTransaction) para que el servicio componga operaciones
// multi-sentencia de forma atómica sin escribir SQL.
import { database } from '../db/index.js'

export const proyectosRepo = {
  // Proyectos en los que participa el usuario (con datos para la vista).
  listarDeUsuario(usuarioId, exec = database) {
    return exec.all(
      `SELECT p.id, p.nombre, p.codigo, p.permiso_edicion, p.propietario_id
       FROM proyectos p JOIN proyecto_miembros pm ON pm.proyecto_id = p.id
       WHERE pm.usuario_id = ? ORDER BY p.id DESC`,
      [usuarioId],
    )
  },

  porId(pid, exec = database) {
    return exec.get('SELECT * FROM proyectos WHERE id = ?', [pid])
  },

  porCodigo(codigo, exec = database) {
    return exec.get('SELECT * FROM proyectos WHERE codigo = ?', [codigo])
  },

  cabecera(pid, exec = database) {
    return exec.get('SELECT propietario_id, permiso_edicion FROM proyectos WHERE id = ?', [pid])
  },

  async permisoEdicion(pid, exec = database) {
    const row = await exec.get('SELECT permiso_edicion FROM proyectos WHERE id = ?', [pid])
    return row?.permiso_edicion
  },

  async codigoExiste(codigo, exec = database) {
    return !!(await exec.get('SELECT 1 FROM proyectos WHERE codigo = ?', [codigo]))
  },

  async insertar(nombre, propietarioId, codigo, permiso, exec = database) {
    const info = await exec.run(
      'INSERT INTO proyectos (nombre, propietario_id, creado_en, codigo, permiso_edicion) VALUES (?, ?, ?, ?, ?)',
      [nombre, propietarioId, new Date().toISOString(), codigo, permiso],
    )
    return Number(info.lastInsertRowid)
  },

  actualizarNombre(pid, nombre, exec = database) {
    return exec.run('UPDATE proyectos SET nombre = ? WHERE id = ?', [nombre, pid])
  },

  actualizarPermiso(pid, permiso, exec = database) {
    return exec.run('UPDATE proyectos SET permiso_edicion = ? WHERE id = ?', [permiso, pid])
  },

  borrarProyecto(pid, exec = database) {
    return exec.run('DELETE FROM proyectos WHERE id = ?', [pid])
  },

  // ----- Miembros -----
  agregarMiembro(pid, uid, exec = database) {
    return exec.run('INSERT OR IGNORE INTO proyecto_miembros (proyecto_id, usuario_id) VALUES (?, ?)', [
      pid,
      uid,
    ])
  },

  quitarMiembro(pid, uid, exec = database) {
    return exec.run('DELETE FROM proyecto_miembros WHERE proyecto_id = ? AND usuario_id = ?', [pid, uid])
  },

  async esMiembro(pid, uid, exec = database) {
    return !!(await exec.get(
      'SELECT 1 FROM proyecto_miembros WHERE proyecto_id = ? AND usuario_id = ?',
      [pid, uid],
    ))
  },

  miembros(pid, exec = database) {
    return exec.all(
      `SELECT u.id, u.nombre_usuario AS nombreUsuario, u.email, u.foto_perfil AS foto
       FROM proyecto_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.proyecto_id = ?`,
      [pid],
    )
  },

  // Miembros de varios proyectos en una sola consulta (incluye proyecto_id para
  // agrupar). Evita el N+1 al listar proyectos.
  miembrosDeProyectos(pids, exec = database) {
    const ph = pids.map(() => '?').join(',')
    return exec.all(
      `SELECT pm.proyecto_id, u.id, u.nombre_usuario AS nombreUsuario, u.email, u.foto_perfil AS foto
       FROM proyecto_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.proyecto_id IN (${ph})`,
      [...pids],
    )
  },

  // Lista blanca de varios proyectos en una sola consulta.
  accesoDeProyectos(pids, exec = database) {
    const ph = pids.map(() => '?').join(',')
    return exec.all(
      `SELECT proyecto_id, usuario_id FROM proyecto_acceso WHERE proyecto_id IN (${ph})`,
      [...pids],
    )
  },

  // Expulsa a los miembros que no estén en la lista de permitidos (ni sean el dueño).
  expulsarNoPermitidos(pid, propietarioId, permitidos, exec = database) {
    const ph = permitidos.map(() => '?').join(',')
    return exec.run(
      `DELETE FROM proyecto_miembros
       WHERE proyecto_id = ? AND usuario_id != ? AND usuario_id NOT IN (${ph})`,
      [pid, propietarioId, ...permitidos],
    )
  },

  // ----- Lista blanca (acceso 'selectivo') -----
  async accesoIds(pid, exec = database) {
    const filas = await exec.all('SELECT usuario_id FROM proyecto_acceso WHERE proyecto_id = ?', [pid])
    return filas.map((r) => r.usuario_id)
  },

  limpiarAcceso(pid, exec = database) {
    return exec.run('DELETE FROM proyecto_acceso WHERE proyecto_id = ?', [pid])
  },

  agregarAcceso(pid, uid, exec = database) {
    return exec.run('INSERT OR IGNORE INTO proyecto_acceso (proyecto_id, usuario_id) VALUES (?, ?)', [
      pid,
      uid,
    ])
  },

  // ----- Borrado de contenido del proyecto (al eliminarlo) -----
  borrarMateriasDeProyecto(pid, exec = database) {
    return exec.run('DELETE FROM materias WHERE proyecto_id = ?', [pid])
  },

  borrarCarpetasDeProyecto(pid, exec = database) {
    return exec.run('DELETE FROM carpetas WHERE proyecto_id = ?', [pid])
  },
}
