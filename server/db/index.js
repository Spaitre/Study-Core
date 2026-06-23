// Punto único de acceso a datos.
//
// `database` es la interfaz async estable que usan repositorios y servicios.
// Para cambiar de motor (p. ej. a Postgres) se reemplaza el backend AQUÍ, sin
// tocar el resto de la app:
//
//   import { database } from './postgres.js'   // <- el día de la migración
//
// `db`, `DATA_DIR` y `DB_PATH` se reexportan solo por compatibilidad con el
// código aún no migrado (acceso síncrono crudo a SQLite); deben desaparecer al
// terminar la Fase 1.
export { database } from './sqlite.js'
export { db, DATA_DIR, DB_PATH, closeDatabase } from './schema.js'
