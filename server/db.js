// Compatibilidad: la capa de datos ahora vive en server/db/.
// Reexporta para no romper imports existentes (`import { db } from './db.js'`)
// mientras se completa la migración a la interfaz async (`database`).
// Ver server/db/index.js.
export { database, db, DATA_DIR, DB_PATH } from './db/index.js'
