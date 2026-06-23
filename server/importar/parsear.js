// Detección de preguntas a partir de texto plano, mediante patrones comunes.
// No usa IA: es un parser determinista. Es modular para poder ampliar patrones.
//
// Formato esperado (se documenta también en la app):
//   Enunciado de la pregunta
//   A) Opción     (o "A.")
//   B) Opción
//   C) Opción
//   D) Opción
//   Respuesta: B   (o "Respuesta correcta: B")
//   Explicación (opcional)
//   <línea en blanco separa una pregunta de la siguiente>

// Clasifica una línea según su rol.
function clasificar(linea) {
  const t = linea.trim()
  if (t === '') return { tipo: 'blank' }

  // Reverso de flashcard: "Reverso: ..." (se revisa antes que "Respuesta").
  const rev = t.match(/^(reverso|back)\s*[:\-]\s*(.+)$/i)
  if (rev) return { tipo: 'reverso', texto: rev[2].trim() }

  // Opción: empieza por una letra A-F seguida de ) o .
  const op = t.match(/^([A-Fa-f])\s*[.)]\s*(.*)$/)
  if (op) return { tipo: 'opcion', letra: op[1].toUpperCase(), texto: op[2].trim() }

  // Respuesta de opción múltiple: "Respuesta: B", "Respuesta correcta: C"...
  const ans = t.match(
    /^(respuesta\s*correcta|respuesta|resp)\b\s*[:.\-)]*\s*([A-Fa-f])\b(.*)$/i,
  )
  if (ans) {
    return {
      tipo: 'respuesta',
      letra: ans[2].toUpperCase(),
      resto: (ans[3] || '').replace(/^[.\-:\s]+/, '').trim(),
    }
  }
  return { tipo: 'texto', texto: t }
}

function quitarEtiquetaExplicacion(s) {
  return s.replace(/^\s*(explicaci[oó]n|explanation)\s*[:\-]?\s*/i, '').trim()
}

function limpiarEnunciado(s) {
  return s
    .replace(/^\s*pregunta\s*\d*\s*[:.\-)]?\s*/i, '')
    .replace(/^\s*\d+\s*[.)\-]\s*/, '')
    .trim()
}

// Segmenta el texto en bloques (uno por pregunta) y los estructura.
function construirBloques(lineas) {
  const bloques = []
  const nuevo = () => ({
    pregunta: [],
    opciones: [],
    respuestaLetra: null,
    reverso: null,
    explicacion: [],
    raw: [],
  })
  let b = nuevo()
  const tieneContenido = (x) =>
    x.pregunta.length ||
    x.opciones.length ||
    x.respuestaLetra ||
    x.reverso ||
    x.explicacion.length
  const cerrar = () => {
    if (tieneContenido(b)) bloques.push(b)
    b = nuevo()
  }

  for (const linea of lineas) {
    const c = clasificar(linea)

    if (c.tipo === 'blank') {
      // Una línea en blanco tras la respuesta o el reverso cierra la pregunta.
      if (b.respuestaLetra || b.reverso) cerrar()
      continue
    }

    // Una opción "A" cuando ya hay opciones indica una pregunta nueva
    // (por si el archivo no separó con línea en blanco).
    if (c.tipo === 'opcion' && c.letra === 'A' && b.opciones.length > 0) {
      cerrar()
    }

    b.raw.push(linea.trim())

    if (c.tipo === 'opcion') {
      b.opciones.push({ letra: c.letra, texto: c.texto })
    } else if (c.tipo === 'respuesta') {
      b.respuestaLetra = c.letra
      if (c.resto) b.explicacion.push(c.resto)
    } else if (c.tipo === 'reverso') {
      b.reverso = c.texto
    } else {
      // texto
      if (b.opciones.length === 0 && !b.respuestaLetra && !b.reverso) {
        b.pregunta.push(c.texto)
      } else if (b.respuestaLetra || b.reverso) {
        b.explicacion.push(quitarEtiquetaExplicacion(c.texto))
      } else {
        // texto entre opciones: continuación de la última opción
        b.opciones[b.opciones.length - 1].texto += ' ' + c.texto
      }
    }
  }
  cerrar()
  return bloques
}

// Valida y convierte un bloque a pregunta, o devuelve el motivo del error.
function finalizar(b) {
  const raw = b.raw.join('\n')

  // Flashcard: frente (pregunta) + reverso, sin opciones.
  if (b.reverso && b.opciones.length === 0) {
    const frente = limpiarEnunciado(b.pregunta.join(' ').trim())
    const reverso = b.reverso.trim()
    const motivos = []
    if (!frente) motivos.push('falta el frente de la flashcard')
    if (!reverso) motivos.push('falta el reverso')
    if (motivos.length) return { ok: false, raw, motivo: motivos.join('; ') }
    return {
      ok: true,
      pregunta: {
        pregunta: frente,
        opciones: [],
        respuestaCorrecta: -1,
        explicacion: reverso,
        tipo: 'flashcard',
      },
    }
  }

  const enunciado = limpiarEnunciado(b.pregunta.join(' ').trim())
  const opciones = b.opciones.map((o) => o.texto.trim())
  const explicacion = b.explicacion.join(' ').trim() || null

  const motivos = []
  if (!enunciado) motivos.push('falta el enunciado de la pregunta')
  if (b.opciones.length < 2) motivos.push('se necesitan al menos 2 opciones')
  if (opciones.some((t) => !t)) motivos.push('hay opciones sin texto')

  let idx = -1
  if (!b.respuestaLetra) {
    motivos.push('falta la respuesta correcta (p. ej. "Respuesta: B")')
  } else {
    idx = b.opciones.findIndex((o) => o.letra === b.respuestaLetra)
    if (idx === -1) {
      motivos.push(`la respuesta "${b.respuestaLetra}" no coincide con ninguna opción`)
    }
  }

  if (motivos.length) return { ok: false, raw, motivo: motivos.join('; ') }
  return {
    ok: true,
    pregunta: {
      pregunta: enunciado,
      opciones,
      respuestaCorrecta: idx,
      explicacion,
      tipo: 'opcion',
    },
  }
}

// Devuelve { preguntas: [...válidas...], errores: [{ texto, motivo }] }.
export function parsearPreguntas(texto) {
  const lineas = String(texto).replace(/\r\n?/g, '\n').split('\n')
  const bloques = construirBloques(lineas)
  const preguntas = []
  const errores = []

  for (const b of bloques) {
    // Bloques sin opciones, sin respuesta y sin reverso no son preguntas
    // (títulos, intros): se ignoran.
    if (b.opciones.length === 0 && !b.respuestaLetra && !b.reverso) continue
    const r = finalizar(b)
    if (r.ok) preguntas.push(r.pregunta)
    else errores.push({ texto: r.raw, motivo: r.motivo })
  }
  return { preguntas, errores }
}
