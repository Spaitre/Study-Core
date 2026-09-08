// Panel de administrador: solo lectura, solo para cuentas con es_admin.
import { adminRepo } from '../repositories/adminRepo.js'
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { fallo } from './ApiError.js'

async function exigirAdmin(usuarioId) {
  if (!(await usuariosRepo.esAdmin(usuarioId))) throw fallo(403, 'No tienes permiso de administrador')
}

export const adminService = {
  async estadisticas(usuarioId) {
    await exigirAdmin(usuarioId)
    return adminRepo.estadisticas()
  },
}
