// Repositorio del banco de contenido público (Comunidad): materias/carpetas
// publicadas como instantánea, sus votos, comentarios y reportes.
import { database } from '../db/index.js'

const RESUMEN_COLS = `
  cp.id, cp.autor_id AS autorId, u.nombre_usuario AS autorNombre, cp.tipo, cp.nombre, cp.icono,
  cp.descripcion, cp.materias_json AS materiasJson, cp.temas_json AS temasJson,
  cp.dificultades_json AS dificultadesJson, cp.categorias_json AS categoriasJson,
  cp.total_temas AS totalTemas, cp.total_preguntas AS totalPreguntas, cp.creado_en AS creadoEn
`

export const contenidoPublicoRepo = {
  // Lista completa de contenido visible (con conteo de votos). El filtrado
  // por faceta (materia/tema/dificultad/categoría) se hace en el servicio,
  // en JS, sobre los *_json — el catálogo es chico y así se evita depender
  // de funciones JSON1 de SQLite.
  async listarVisibles(usuarioId) {
    return database.all(
      `SELECT ${RESUMEN_COLS},
              (SELECT COUNT(*) FROM contenido_publico_votos v WHERE v.contenido_id = cp.id) AS votos,
              EXISTS(SELECT 1 FROM contenido_publico_votos v WHERE v.contenido_id = cp.id AND v.usuario_id = ?) AS haVotado
       FROM contenido_publico cp JOIN usuarios u ON u.id = cp.autor_id
       WHERE cp.estado = 'visible'
       ORDER BY cp.id DESC`,
      [usuarioId],
    )
  },

  obtener(id) {
    return database.get('SELECT * FROM contenido_publico WHERE id = ?', [id])
  },

  async obtenerConVotos(id, usuarioId) {
    return database.get(
      `SELECT ${RESUMEN_COLS}, cp.datos_json AS datosJson,
              (SELECT COUNT(*) FROM contenido_publico_votos v WHERE v.contenido_id = cp.id) AS votos,
              EXISTS(SELECT 1 FROM contenido_publico_votos v WHERE v.contenido_id = cp.id AND v.usuario_id = ?) AS haVotado
       FROM contenido_publico cp JOIN usuarios u ON u.id = cp.autor_id
       WHERE cp.id = ? AND cp.estado = 'visible'`,
      [usuarioId, id],
    )
  },

  async crear(autorId, d) {
    const info = await database.run(
      `INSERT INTO contenido_publico
         (autor_id, tipo, nombre, icono, descripcion, datos_json, materias_json, temas_json,
          dificultades_json, categorias_json, total_temas, total_preguntas, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        autorId,
        d.tipo,
        d.nombre,
        d.icono,
        d.descripcion,
        JSON.stringify(d.datos),
        JSON.stringify(d.materias),
        JSON.stringify(d.temas),
        JSON.stringify(d.dificultades),
        JSON.stringify(d.categorias),
        d.totalTemas,
        d.totalPreguntas,
        new Date().toISOString(),
      ],
    )
    return Number(info.lastInsertRowid)
  },

  votoExiste(contenidoId, usuarioId) {
    return database.get(
      'SELECT 1 FROM contenido_publico_votos WHERE contenido_id = ? AND usuario_id = ?',
      [contenidoId, usuarioId],
    )
  },
  votar(contenidoId, usuarioId) {
    return database.run(
      'INSERT INTO contenido_publico_votos (contenido_id, usuario_id, creado_en) VALUES (?, ?, ?)',
      [contenidoId, usuarioId, new Date().toISOString()],
    )
  },
  quitarVoto(contenidoId, usuarioId) {
    return database.run(
      'DELETE FROM contenido_publico_votos WHERE contenido_id = ? AND usuario_id = ?',
      [contenidoId, usuarioId],
    )
  },

  comentarios(contenidoId) {
    return database.all(
      `SELECT c.id, c.texto, c.creado_en AS creadoEn, c.usuario_id AS usuarioId, u.nombre_usuario AS autorNombre
       FROM contenido_publico_comentarios c JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.contenido_id = ? ORDER BY c.id ASC`,
      [contenidoId],
    )
  },
  comentar(contenidoId, usuarioId, texto) {
    return database.run(
      'INSERT INTO contenido_publico_comentarios (contenido_id, usuario_id, texto, creado_en) VALUES (?, ?, ?, ?)',
      [contenidoId, usuarioId, texto, new Date().toISOString()],
    )
  },

  reportar(contenidoId, usuarioId, motivo) {
    return database.run(
      `INSERT INTO contenido_publico_reportes (contenido_id, usuario_id, motivo, creado_en)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(contenido_id, usuario_id) DO NOTHING`,
      [contenidoId, usuarioId, motivo, new Date().toISOString()],
    )
  },

  reportados() {
    return database.all(
      `SELECT cp.id, cp.tipo, cp.nombre, u.nombre_usuario AS autorNombre,
              COUNT(r.id) AS totalReportes, GROUP_CONCAT(r.motivo, ' | ') AS motivos
       FROM contenido_publico cp
       JOIN contenido_publico_reportes r ON r.contenido_id = cp.id
       JOIN usuarios u ON u.id = cp.autor_id
       WHERE cp.estado = 'visible'
       GROUP BY cp.id
       ORDER BY totalReportes DESC, cp.id DESC`,
    )
  },

  ocultar(id) {
    return database.run("UPDATE contenido_publico SET estado = 'oculta' WHERE id = ?", [id])
  },
  descartarReportes(id) {
    return database.run('DELETE FROM contenido_publico_reportes WHERE contenido_id = ?', [id])
  },
}
