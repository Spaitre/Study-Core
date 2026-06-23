import { createRequire } from 'node:module'
import mammoth from 'mammoth'

const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')

// Extractores de texto por extensión. Para soportar un formato nuevo en el
// futuro, basta con añadir una entrada aquí.
const EXTRACTORES = {
  '.txt': async (buffer) => buffer.toString('utf8'),
  '.pdf': async (buffer) => {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const { text } = await parser.getText()
    await parser.destroy?.()
    return text
  },
  '.docx': async (buffer) => {
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  },
}

// Extensiones soportadas (para validar y mostrar en la UI).
export const FORMATOS_SOPORTADOS = Object.keys(EXTRACTORES)

// Extrae el texto de un archivo según su extensión (p. ej. '.pdf').
export async function extraerTexto(buffer, ext) {
  const extractor = EXTRACTORES[String(ext).toLowerCase()]
  if (!extractor) {
    throw new Error(`Formato no soportado: ${ext}`)
  }
  return extractor(buffer)
}
