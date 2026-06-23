// Error de negocio con código HTTP asociado. Los servicios lo lanzan para
// señalar fallos esperables (validación, permiso, no encontrado) sin conocer
// Express; las rutas lo traducen a una respuesta { error } con su status.
export class ApiError extends Error {
  constructor(status, mensaje) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
  }
}

export const fallo = (status, mensaje) => new ApiError(status, mensaje)
