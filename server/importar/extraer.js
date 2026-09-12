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

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Convierte texto plano (.txt/.pdf) a HTML preservando solo los párrafos
// (separados por línea en blanco); sin negritas/títulos porque esos formatos
// no los conservan.
function textoAHtml(texto) {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// El HTML que devuelve mammoth viene de convertir XML de Word, nunca de HTML
// del usuario, así que no hay riesgo de <script>. El único vector real son
// los href de hipervínculos del documento: se limitan a http(s)/mailto.
function sanitizarHtml(html) {
  return html.replace(
    /href="(?!https?:|mailto:)[^"]*"/gi,
    'href="#"',
  )
}

// Extrae las notas de un tema como HTML listo para mostrar. Para .docx usa
// mammoth.convertToHtml (conserva títulos, negritas, listas y tablas); para
// .txt solo hay texto plano, así que se preservan los párrafos. (El PDF no
// se ofrece para apuntes: contenidoService valida el formato antes de
// llegar aquí.)
export async function extraerNotasHtml(buffer, ext) {
  const e = String(ext).toLowerCase()
  if (e === '.docx') {
    const { value } = await mammoth.convertToHtml({ buffer })
    return sanitizarHtml(value)
  }
  const texto = await extraerTexto(buffer, e)
  return textoAHtml(texto)
}
