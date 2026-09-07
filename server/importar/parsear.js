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

  // Encabezado "Pregunta N" / "Flashcard N" en su propia línea (sin nada
  // más): marca el inicio de una pregunta nueva aunque no haya línea en
  // blanco antes (los prompts de caso clínico y flashcards enlazan el último
  // campo de una tarjeta con el encabezado de la siguiente).
  if (/^(pregunta|flashcard)\s*\d+\s*[:.\-)]?\s*$/i.test(t)) return { tipo: 'encabezado' }

  // Etiquetas de sección: "Caso:" / "Anverso:" (pueden traer el texto en la
  // misma línea o dejarlo para las líneas siguientes) e "Incisos:" (siempre
  // sola, antes de las opciones A-D).
  const caso = t.match(/^(caso|anverso|front)\s*[:\-]\s*(.*)$/i)
  if (caso) return { tipo: 'etiquetaCaso', texto: caso[2].trim() }
  if (/^incisos\s*[:\-]?\s*$/i.test(t)) return { tipo: 'etiquetaIncisos' }

  // Reverso de flashcard: "Reverso: ..." en la misma línea, o "Reverso:"
  // sola con el contenido en las líneas siguientes (se revisa antes que
  // "Respuesta").
  const rev = t.match(/^(reverso|back)\s*[:\-]\s*(.*)$/i)
  if (rev) return { tipo: 'reverso', texto: rev[2].trim() }

  // Opción: empieza por una letra A-F seguida de ) o .
  const op = t.match(/^([A-Fa-f])\s*[.)]\s*(.*)$/)
  if (op) return { tipo: 'opcion', letra: op[1].toUpperCase(), texto: op[2].trim() }

  // Respuesta de opción múltiple: "Respuesta: B", "Respuesta correcta: C"...
  // (el texto que a veces sigue a la letra, p. ej. "C) Penfigoide ampolloso",
  // se descarta: ya está en la opción correspondiente).
  const ans = t.match(
    /^(respuesta\s*correcta|respuesta|resp)\b\s*[:.\-)]*\s*([A-Fa-f])\b(.*)$/i,
  )
  if (ans) {
    return { tipo: 'respuesta', letra: ans[2].toUpperCase() }
  }

  // Metadatos de caso clínico / flashcard (solo etiquetas dedicadas propias
  // de los prompts).
  const materia = t.match(/^materia\s*[:\-]\s*(.+)$/i)
  if (materia) return { tipo: 'materiaCaso', texto: materia[1].trim() }
  const temaCat = t.match(/^tema\s*[:\-]\s*(.+)$/i)
  if (temaCat) return { tipo: 'temaCategoria', texto: temaCat[1].trim() }
  const dif = t.match(/^dificultad\s*[:\-]\s*(.+)$/i)
  if (dif) return { tipo: 'dificultad', texto: dif[1].trim() }

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

// Segmenta el texto en bloques (uno por pregunta/flashcard) y los estructura.
function construirBloques(lineas) {
  const bloques = []
  const nuevo = () => ({
    pregunta: [],
    opciones: [],
    respuestaLetra: null,
    enReverso: false,
    reversoLineas: [],
    explicacion: [],
    materiaCaso: null,
    temaCategoria: null,
    dificultad: null,
    raw: [],
  })
  let b = nuevo()
  const tieneContenido = (x) =>
    x.pregunta.length ||
    x.opciones.length ||
    x.respuestaLetra ||
    x.enReverso ||
    x.explicacion.length
  const cerrar = () => {
    if (tieneContenido(b)) bloques.push(b)
    b = nuevo()
  }

  for (const linea of lineas) {
    const c = clasificar(linea)

    if (c.tipo === 'blank') {
      // Una línea en blanco tras la respuesta o el reverso cierra la pregunta.
      if (b.respuestaLetra || b.enReverso) cerrar()
      continue
    }

    // Una opción "A" cuando ya hay opciones indica una pregunta nueva
    // (por si el archivo no separó con línea en blanco).
    if (c.tipo === 'opcion' && c.letra === 'A' && b.opciones.length > 0) {
      cerrar()
    }

    // Encabezado "Pregunta N" / "Flashcard N": cierra la anterior si ya
    // estaba completa (formatos donde no hay línea en blanco entre tarjetas)
    // y no se agrega como texto de la nueva.
    if (c.tipo === 'encabezado') {
      if (b.respuestaLetra || b.enReverso) cerrar()
      continue
    }

    // "Incisos:" es puramente estructural: nunca aporta texto, se descarta.
    if (c.tipo === 'etiquetaIncisos') {
      b.raw.push(linea.trim())
      continue
    }

    b.raw.push(linea.trim())

    if (c.tipo === 'opcion') {
      b.opciones.push({ letra: c.letra, texto: c.texto })
    } else if (c.tipo === 'respuesta') {
      // El texto que a veces sigue a la letra (p. ej. "B) Enfermedad de
      // cambios mínimos") solo restata la opción: se descarta para no
      // duplicarlo al inicio de la explicación real.
      b.respuestaLetra = c.letra
    } else if (c.tipo === 'reverso') {
      b.enReverso = true
      if (c.texto) b.reversoLineas.push(c.texto)
    } else if (c.tipo === 'materiaCaso') {
      b.materiaCaso = c.texto
    } else if (c.tipo === 'temaCategoria') {
      b.temaCategoria = c.texto
    } else if (c.tipo === 'dificultad') {
      b.dificultad = c.texto
    } else if (c.tipo === 'etiquetaCaso') {
      // "Caso:"/"Anverso:" son etiquetas de sección; solo el texto que las
      // acompañe (si lo hay) forma parte del enunciado.
      if (c.texto && b.opciones.length === 0 && !b.respuestaLetra && !b.enReverso) {
        b.pregunta.push(c.texto)
      }
    } else {
      // texto
      if (b.opciones.length === 0 && !b.respuestaLetra && !b.enReverso) {
        b.pregunta.push(c.texto)
      } else if (b.enReverso) {
        b.reversoLineas.push(c.texto)
      } else if (b.respuestaLetra) {
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
  if (b.enReverso && b.opciones.length === 0) {
    const frente = limpiarEnunciado(b.pregunta.join(' ').trim())
    const reverso = b.reversoLineas.join(' ').trim()
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
        materiaCaso: b.materiaCaso || null,
        temaCategoria: b.temaCategoria || null,
        dificultad: b.dificultad || null,
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
      materiaCaso: b.materiaCaso || null,
      temaCategoria: b.temaCategoria || null,
      dificultad: b.dificultad || null,
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
    if (b.opciones.length === 0 && !b.respuestaLetra && !b.enReverso) continue
    const r = finalizar(b)
    if (r.ok) preguntas.push(r.pregunta)
    else errores.push({ texto: r.raw, motivo: r.motivo })
  }
  return { preguntas, errores }
}
