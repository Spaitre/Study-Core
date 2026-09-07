import { useState, useEffect } from 'react'
import { fetchMisiones } from '../api.js'

// Recordatorio en Inicio de "el botón Importar de cualquier tema puede
// generar preguntas con IA a partir de tus apuntes". Se muestra hasta que:
// - el usuario lo cierra (se guarda en este dispositivo, no vuelve a salir), o
// - ya creó su primera pregunta (ya sea con IA o a mano: para entonces ya
//   sabe cómo funciona el flujo y el aviso deja de aportar).
const STORAGE_KEY = 'cerebro:sugerenciaIACerrada'

export default function SugerenciaIAWidget() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') return
    fetchMisiones()
      .then((d) => {
        const yaCreoPregunta = d.misiones.find((m) => m.clave === 'primera_pregunta')?.completada
        setVisible(!yaCreoPregunta)
      })
      .catch(() => setVisible(true))
  }, [])

  function cerrar() {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage no disponible: el aviso solo se cierra por esta sesión.
    }
  }

  if (!visible) return null

  return (
    <section className="panel sugerencia-ia">
      <button className="sugerencia-ia-cerrar" onClick={cerrar} title="No volver a mostrar">
        ✕
      </button>
      <h2>✨ Genera preguntas con IA a partir de tus apuntes</h2>
      <ol className="sugerencia-ia-pasos">
        <li>
          Entra a cualquier tema y toca <strong>📥 Importar</strong> — ahí hay un prompt listo para copiar.
        </li>
        <li>Pégalo en ChatGPT, Claude o Gemini junto con tus apuntes.</li>
        <li>Copia lo que te responda la IA y pégalo de vuelta ahí. Listo, ya tienes tus preguntas.</li>
      </ol>
    </section>
  )
}
