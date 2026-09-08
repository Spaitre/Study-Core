// Consultas de solo lectura para el panel de administrador: números
// generales de la app (cuentas, grupos, banco público, sesiones jugadas).
import { database } from '../db/index.js'

export const adminRepo = {
  async estadisticas() {
    const [usuarios, invitados, grupos, contenidoPublico, sesiones] = await Promise.all([
      database.get('SELECT COUNT(*) AS c FROM usuarios'),
      database.get('SELECT COUNT(*) AS c FROM usuarios WHERE invitado = 1'),
      database.get('SELECT COUNT(*) AS c FROM grupos'),
      database.get("SELECT COUNT(*) AS c FROM contenido_publico WHERE estado = 'visible'"),
      database.get('SELECT COUNT(*) AS c FROM sesiones'),
    ])
    return {
      cuentasTotal: usuarios.c,
      cuentasInvitado: invitados.c,
      cuentasRegistradas: usuarios.c - invitados.c,
      grupos: grupos.c,
      contenidoPublico: contenidoPublico.c,
      sesionesJugadas: sesiones.c,
    }
  },
}
