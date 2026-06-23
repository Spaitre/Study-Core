// Envuelve un handler async para que cualquier rechazo llegue al middleware de
// errores (Express 4 no captura promesas rechazadas por sí mismo).
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
