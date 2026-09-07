// Repositorio de grupos colaborativos: grupos, miembros y lista blanca.
//
// Los métodos aceptan un `exec` opcional (la conexión global por defecto, o un
// `tx` dentro de withTransaction) para que el servicio componga operaciones
// multi-sentencia de forma atómica sin escribir SQL.
import { database } from '../db/index.js'

export const gruposRepo = {
  // Grupos en los que participa el usuario (con datos para la vista).
  listarDeUsuario(usuarioId, exec = database) {
    return exec.all(
      `SELECT p.id, p.nombre, p.codigo, p.permiso_edicion, p.propietario_id
       FROM grupos p JOIN grupo_miembros pm ON pm.grupo_id = p.id
       WHERE pm.usuario_id = ? ORDER BY p.id DESC`,
      [usuarioId],
    )
  },

  porId(pid, exec = database) {
    return exec.get('SELECT * FROM grupos WHERE id = ?', [pid])
  },

  porCodigo(codigo, exec = database) {
    return exec.get('SELECT * FROM grupos WHERE codigo = ?', [codigo])
  },

  cabecera(pid, exec = database) {
    return exec.get('SELECT propietario_id, permiso_edicion FROM grupos WHERE id = ?', [pid])
  },

  async permisoEdicion(pid, exec = database) {
    const row = await exec.get('SELECT permiso_edicion FROM grupos WHERE id = ?', [pid])
    return row?.permiso_edicion
  },

  async codigoExiste(codigo, exec = database) {
    return !!(await exec.get('SELECT 1 FROM grupos WHERE codigo = ?', [codigo]))
  },

  async insertar(nombre, propietarioId, codigo, permiso, exec = database) {
    const info = await exec.run(
      'INSERT INTO grupos (nombre, propietario_id, creado_en, codigo, permiso_edicion) VALUES (?, ?, ?, ?, ?)',
      [nombre, propietarioId, new Date().toISOString(), codigo, permiso],
    )
    return Number(info.lastInsertRowid)
  },

  actualizarNombre(pid, nombre, exec = database) {
    return exec.run('UPDATE grupos SET nombre = ? WHERE id = ?', [nombre, pid])
  },

  actualizarPermiso(pid, permiso, exec = database) {
    return exec.run('UPDATE grupos SET permiso_edicion = ? WHERE id = ?', [permiso, pid])
  },

  borrarGrupo(pid, exec = database) {
    return exec.run('DELETE FROM grupos WHERE id = ?', [pid])
  },

  // ----- Miembros -----
  agregarMiembro(pid, uid, exec = database) {
    return exec.run('INSERT OR IGNORE INTO grupo_miembros (grupo_id, usuario_id) VALUES (?, ?)', [
      pid,
      uid,
    ])
  },

  quitarMiembro(pid, uid, exec = database) {
    return exec.run('DELETE FROM grupo_miembros WHERE grupo_id = ? AND usuario_id = ?', [pid, uid])
  },

  async esMiembro(pid, uid, exec = database) {
    return !!(await exec.get(
      'SELECT 1 FROM grupo_miembros WHERE grupo_id = ? AND usuario_id = ?',
      [pid, uid],
    ))
  },

  miembros(pid, exec = database) {
    return exec.all(
      `SELECT u.id, u.nombre_usuario AS nombreUsuario, u.email, u.foto_perfil AS foto
       FROM grupo_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.grupo_id = ?`,
      [pid],
    )
  },

  // Miembros de varios grupos en una sola consulta (incluye grupo_id para
  // agrupar). Evita el N+1 al listar grupos.
  miembrosDeGrupos(pids, exec = database) {
    const ph = pids.map(() => '?').join(',')
    return exec.all(
      `SELECT pm.grupo_id, u.id, u.nombre_usuario AS nombreUsuario, u.email, u.foto_perfil AS foto
       FROM grupo_miembros pm JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.grupo_id IN (${ph})`,
      [...pids],
    )
  },

  // Lista blanca de varios grupos en una sola consulta.
  accesoDeGrupos(pids, exec = database) {
    const ph = pids.map(() => '?').join(',')
    return exec.all(
      `SELECT grupo_id, usuario_id FROM grupo_acceso WHERE grupo_id IN (${ph})`,
      [...pids],
    )
  },

  // Expulsa a los miembros que no estén en la lista de permitidos (ni sean el dueño).
  expulsarNoPermitidos(pid, propietarioId, permitidos, exec = database) {
    const ph = permitidos.map(() => '?').join(',')
    return exec.run(
      `DELETE FROM grupo_miembros
       WHERE grupo_id = ? AND usuario_id != ? AND usuario_id NOT IN (${ph})`,
      [pid, propietarioId, ...permitidos],
    )
  },

  // ----- Lista blanca (acceso 'selectivo') -----
  async accesoIds(pid, exec = database) {
    const filas = await exec.all('SELECT usuario_id FROM grupo_acceso WHERE grupo_id = ?', [pid])
    return filas.map((r) => r.usuario_id)
  },

  limpiarAcceso(pid, exec = database) {
    return exec.run('DELETE FROM grupo_acceso WHERE grupo_id = ?', [pid])
  },

  agregarAcceso(pid, uid, exec = database) {
    return exec.run('INSERT OR IGNORE INTO grupo_acceso (grupo_id, usuario_id) VALUES (?, ?)', [
      pid,
      uid,
    ])
  },

  // ----- Borrado de contenido del grupo (al eliminarlo) -----
  borrarMateriasDeGrupo(pid, exec = database) {
    return exec.run('DELETE FROM materias WHERE grupo_id = ?', [pid])
  },

  borrarCarpetasDeGrupo(pid, exec = database) {
    return exec.run('DELETE FROM carpetas WHERE grupo_id = ?', [pid])
  },

  // ----- Estadísticas colectivas (sobre el contenido compartido del grupo) -----
  // Preguntas respondidas y correctas por CUALQUIER miembro actual, solo en
  // temas de materias que pertenecen a este grupo.
  async estadisticas(gid, exec = database) {
    const row = await exec.get(
      `SELECT COUNT(*) AS respondidas, COALESCE(SUM(sr.correcta), 0) AS correctas
       FROM sesion_respuestas sr
       JOIN sesiones s ON s.id = sr.sesion_id
       JOIN temas t ON t.id = sr.tema_id
       JOIN materias m ON m.id = t.materia_id
       WHERE m.grupo_id = ? AND sr.respondida = 1
         AND s.usuario_id IN (SELECT usuario_id FROM grupo_miembros WHERE grupo_id = ?)`,
      [gid, gid],
    )
    return { respondidas: row?.respondidas || 0, correctas: row?.correctas || 0 }
  },

  // ----- Objetivos grupales (retos colectivos con progreso) -----
  crearObjetivo(gid, descripcion, materiaId, meta, creadorId, exec = database) {
    const ahora = new Date().toISOString()
    return exec.run(
      `INSERT INTO objetivos_grupales
        (grupo_id, descripcion, materia_id, meta, fecha_inicio, creado_por, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gid, descripcion, materiaId, meta, ahora, creadorId, ahora],
    )
  },

  objetivosDeGrupo(gid, exec = database) {
    return exec.all('SELECT * FROM objetivos_grupales WHERE grupo_id = ? ORDER BY id DESC', [gid])
  },

  objetivo(id, exec = database) {
    return exec.get('SELECT * FROM objetivos_grupales WHERE id = ?', [id])
  },

  borrarObjetivo(id, gid, exec = database) {
    return exec.run('DELETE FROM objetivos_grupales WHERE id = ? AND grupo_id = ?', [id, gid])
  },

  // Preguntas respondidas por miembros del grupo desde que se creó el
  // objetivo, opcionalmente acotadas a una materia.
  async progresoObjetivo(objetivo, exec = database) {
    const params = [objetivo.grupo_id, objetivo.grupo_id, objetivo.fecha_inicio]
    let filtroMateria = ''
    if (objetivo.materia_id) {
      filtroMateria = 'AND m.id = ?'
      params.push(objetivo.materia_id)
    }
    const row = await exec.get(
      `SELECT COUNT(*) AS avance
       FROM sesion_respuestas sr
       JOIN sesiones s ON s.id = sr.sesion_id
       JOIN temas t ON t.id = sr.tema_id
       JOIN materias m ON m.id = t.materia_id
       WHERE m.grupo_id = ?
         AND s.usuario_id IN (SELECT usuario_id FROM grupo_miembros WHERE grupo_id = ?)
         AND sr.respondida = 1 AND s.fecha >= ?
         ${filtroMateria}`,
      params,
    )
    return row?.avance || 0
  },
}
