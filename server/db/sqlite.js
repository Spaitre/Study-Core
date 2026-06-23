// Adaptador de datos sobre node:sqlite.
//
// node:sqlite es SÍNCRONO, pero exponemos una interfaz ASYNC (todos los métodos
// devuelven Promise) idéntica a la que tendrá un backend Postgres (pg). Así, al
// migrar, solo se reescribe esta carpeta: repos, servicios y rutas no cambian.
//
// La interfaz es deliberadamente mínima y agnóstica del motor:
//   get(sql, params)  -> fila | undefined
//   all(sql, params)  -> filas[]
//   run(sql, params)  -> { changes, lastInsertRowid }
//   exec(sql)         -> ejecuta DDL / múltiples sentencias
//   withTransaction(fn) -> ejecuta fn(tx) dentro de una transacción
//
// Los placeholders son posicionales con '?' (compatibles con SQLite). Si algún
// día se migra a pg habrá que traducirlos a $1,$2,…; ese mapeo vive aquí, no en
// los repositorios.
import { db } from './schema.js'

// Caché de sentencias preparadas por texto SQL: reusar evita recompilar la
// misma consulta en cada llamada (antes se guardaban como constantes sueltas).
const cacheSentencias = new Map()
function preparar(sql) {
  let stmt = cacheSentencias.get(sql)
  if (!stmt) {
    stmt = db.prepare(sql)
    cacheSentencias.set(sql, stmt)
  }
  return stmt
}

// Ejecutor: la unidad que sabe correr SQL. Es el mismo objeto dentro y fuera de
// transacción porque SQLite usa una sola conexión. (En pg, withTransaction
// crearía un ejecutor ligado a un cliente del pool.)
const ejecutor = {
  async get(sql, params = []) {
    return preparar(sql).get(...params)
  },
  async all(sql, params = []) {
    return preparar(sql).all(...params)
  },
  async run(sql, params = []) {
    const r = preparar(sql).run(...params)
    return { changes: r.changes, lastInsertRowid: r.lastInsertRowid }
  },
  async exec(sql) {
    db.exec(sql)
  },
}

// Serialización de transacciones. Con una sola conexión SQLite no pueden
// solaparse dos BEGIN; encadenamos para que cada transacción espere a la
// anterior. Además, como la interfaz es async, esto evita que el cuerpo de una
// transacción se intercale con otra si en el futuro hiciera I/O real entre
// operaciones. (En Postgres cada transacción tomaría su propio cliente del pool
// y este encadenamiento se vuelve innecesario.)
let cadenaTx = Promise.resolve()

async function withTransaction(fn) {
  const corrida = cadenaTx.then(async () => {
    db.exec('BEGIN')
    try {
      const resultado = await fn(ejecutor)
      db.exec('COMMIT')
      return resultado
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  })
  // El siguiente en la cola espera al actual sin propagar su posible error.
  cadenaTx = corrida.then(
    () => {},
    () => {},
  )
  return corrida
}

export const database = { ...ejecutor, withTransaction }
