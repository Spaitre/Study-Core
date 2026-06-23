// Repositorio de usuarios: TODO el acceso a la tabla `usuarios`.
// Sin lógica de negocio ni Express; solo SQL a través de la interfaz async.
import { database } from '../db/index.js'

// Proyección pública/propia de un usuario (sin datos sensibles). Es la forma de
// "perfil" que consumen amigos, proyectos, salas, etc.
const PERFIL_COLS =
  'id, email, nombre_usuario AS nombreUsuario, foto_perfil AS foto, invitado'

export const usuariosRepo = {
  // Fila completa (incluye hash/salt) para verificar credenciales.
  porEmail(email) {
    return database.get('SELECT * FROM usuarios WHERE email = ?', [email])
  },

  // Perfil público de un usuario por id.
  perfil(id) {
    return database.get(`SELECT ${PERFIL_COLS} FROM usuarios WHERE id = ?`, [id])
  },

  // ¿Existe ya este nombre de usuario? (case-insensitive). `exceptId` permite
  // excluir al propio usuario al renombrarse.
  async nombreTomado(nombre, exceptId = null) {
    const row =
      exceptId == null
        ? await database.get(
            'SELECT 1 FROM usuarios WHERE nombre_usuario = ? COLLATE NOCASE',
            [nombre],
          )
        : await database.get(
            'SELECT 1 FROM usuarios WHERE nombre_usuario = ? COLLATE NOCASE AND id != ?',
            [nombre, exceptId],
          )
    return !!row
  },

  // Crea una cuenta (registrada o invitada) y devuelve su perfil.
  async crear({ email, hash, salt, nombre, foto, invitado = 0 }) {
    const info = await database.run(
      `INSERT INTO usuarios (email, password_hash, password_salt, creado_en, nombre_usuario, foto_perfil, invitado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hash, salt, new Date().toISOString(), nombre, foto, invitado],
    )
    return this.perfil(Number(info.lastInsertRowid))
  },

  actualizarNombre(id, nombre) {
    return database.run('UPDATE usuarios SET nombre_usuario = ? WHERE id = ?', [nombre, id])
  },

  actualizarFoto(id, foto) {
    return database.run('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [foto, id])
  },

  // Busca un usuario por correo exacto o por nombre de usuario (case-insensitive).
  buscarPorIdentificador(emailLower, nombre) {
    return database.get(
      'SELECT id FROM usuarios WHERE email = ? OR nombre_usuario = ? COLLATE NOCASE',
      [emailLower, nombre],
    )
  },

  async contar() {
    const { c } = await database.get('SELECT COUNT(*) AS c FROM usuarios')
    return c
  },

  // Invitados de más de `limiteISO` cuya sesión ya expiró (sin token vigente).
  invitadosInactivos(limiteISO, ahoraISO) {
    return database.all(
      `SELECT id FROM usuarios
       WHERE invitado = 1 AND creado_en < ?
         AND NOT EXISTS (SELECT 1 FROM tokens t WHERE t.usuario_id = usuarios.id AND t.expira_en > ?)`,
      [limiteISO, ahoraISO],
    )
  },

  // Elimina por completo una cuenta de invitado y su contenido personal, en una
  // transacción. Se conservan sus aportes a proyectos de otros (cuelgan del
  // proyecto, no del usuario); al borrar el usuario, su membresía y proyectos
  // propios caen por cascada.
  eliminarConContenido(id) {
    return database.withTransaction(async (tx) => {
      // Contenido de los proyectos que posee el invitado.
      const propios = await tx.all('SELECT id FROM proyectos WHERE propietario_id = ?', [id])
      for (const p of propios) {
        await tx.run('DELETE FROM materias WHERE proyecto_id = ?', [p.id])
        await tx.run('DELETE FROM carpetas WHERE proyecto_id = ?', [p.id])
      }
      // Contenido e historial personales del invitado.
      await tx.run('DELETE FROM materias WHERE usuario_id = ? AND proyecto_id IS NULL', [id])
      await tx.run('DELETE FROM carpetas WHERE usuario_id = ? AND proyecto_id IS NULL', [id])
      await tx.run('DELETE FROM sesiones WHERE usuario_id = ?', [id])
      // Borra el usuario (cascada: tokens, proyectos propios, membresías, amistades).
      await tx.run('DELETE FROM usuarios WHERE id = ?', [id])
    })
  },
}
