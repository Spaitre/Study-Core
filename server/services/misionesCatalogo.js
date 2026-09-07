// Misiones de bienvenida: se completan una sola vez por usuario y otorgan
// XP; completar las 3 desbloquea el avatar de regalo (ver avataresCatalogo.js
// y misionesService.js). Se disparan desde contenidoService.crearPregunta,
// sesionesService.guardar y amigosService (solicitar/aceptar).
export const MISIONES = [
  {
    clave: 'primera_pregunta',
    nombre: 'Crea tu primera pregunta',
    descripcion: 'Escríbela tú o genera varias de golpe con IA desde tus apuntes (botón 📥 Importar en cualquier tema).',
    xp: 30,
  },
  {
    clave: 'primera_sesion',
    nombre: 'Haz tu primera sesión de estudio',
    descripcion: 'Termina un quiz de práctica.',
    xp: 30,
  },
  {
    clave: 'primer_amigo',
    nombre: 'Ten un amigo',
    descripcion: 'Agrega a un compañero de estudio.',
    xp: 30,
  },
]

// Avatar que se otorga al completar las 3 misiones.
export const RECOMPENSA_FINAL_AVATAR = 'zorro'
