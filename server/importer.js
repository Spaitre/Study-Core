import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { db, DATA_DIR } from './db.js'

const JSON_DIR = path.join(DATA_DIR, 'json')

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

// Identidad de una pregunta para deduplicar: tema + texto normalizado.
// Así, reimportar un JSON (o uno solapado) no crea duplicados.
function preguntaHash(temaId, pregunta) {
  const normal = pregunta.trim().replace(/\s+/g, ' ').toLowerCase()
  return sha256(`${temaId}::${normal}`)
}

const upsertMateria = db.prepare(`
  INSERT INTO materias (id, nombre, icono) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, icono = excluded.icono
`)
const upsertTema = db.prepare(`
  INSERT INTO temas (id, materia_id, nombre) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, materia_id = excluded.materia_id
`)
const insertPregunta = db.prepare(`
  INSERT OR IGNORE INTO preguntas
    (tema_id, pregunta, opciones, respuesta_correcta, explicacion, hash)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const getFile = db.prepare('SELECT content_hash FROM imported_files WHERE filename = ?')
const upsertFile = db.prepare(`
  INSERT INTO imported_files (filename, content_hash, imported_at, inserted)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(filename) DO UPDATE SET
    content_hash = excluded.content_hash,
    imported_at  = excluded.imported_at,
    inserted     = imported_files.inserted + excluded.inserted
`)

// Importa una estructura { materias: [...] } y devuelve cuántas preguntas
// NUEVAS se insertaron (las duplicadas se ignoran).
function importData(data) {
  let inserted = 0
  const run = db.prepare('SELECT changes() AS c')
  for (const materia of data.materias ?? []) {
    upsertMateria.run(materia.id, materia.nombre, materia.icono ?? null)
    for (const tema of materia.temas ?? []) {
      upsertTema.run(tema.id, materia.id, tema.nombre)
      for (const p of tema.preguntas ?? []) {
        const hash = preguntaHash(tema.id, p.pregunta)
        insertPregunta.run(
          tema.id,
          p.pregunta,
          JSON.stringify(p.opciones),
          p.respuestaCorrecta,
          p.explicacion ?? null,
          hash,
        )
        inserted += run.get().c // changes() = 1 si insertó, 0 si se ignoró
      }
    }
  }
  return inserted
}

// Escanea data/json e importa cualquier archivo nuevo o modificado.
// Devuelve un resumen para el log de arranque.
export function importNewJsonFiles() {
  fs.mkdirSync(JSON_DIR, { recursive: true })
  const files = fs
    .readdirSync(JSON_DIR)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort()

  const summary = []

  for (const filename of files) {
    const full = path.join(JSON_DIR, filename)
    const raw = fs.readFileSync(full, 'utf8')
    const contentHash = sha256(raw)
    const prev = getFile.get(filename)

    if (prev && prev.content_hash === contentHash) {
      summary.push({ filename, status: 'sin cambios', inserted: 0 })
      continue
    }

    let data
    try {
      data = JSON.parse(raw)
    } catch (err) {
      summary.push({ filename, status: `error JSON: ${err.message}`, inserted: 0 })
      continue
    }

    db.exec('BEGIN')
    try {
      const inserted = importData(data)
      upsertFile.run(filename, contentHash, new Date().toISOString(), inserted)
      db.exec('COMMIT')
      summary.push({
        filename,
        status: prev ? 'actualizado' : 'importado',
        inserted,
      })
    } catch (err) {
      db.exec('ROLLBACK')
      summary.push({ filename, status: `error: ${err.message}`, inserted: 0 })
    }
  }
  return summary
}

export { JSON_DIR }
