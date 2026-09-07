import { useEffect, useRef, useState } from 'react'

// Cuenta de 0 hasta `valor` en `duracionMs` con requestAnimationFrame, en vez
// de mostrar el número final de golpe (se usa en Resultados: % y aciertos).
export default function NumeroAnimado({ valor, duracionMs = 900, sufijo = '' }) {
  const [mostrado, setMostrado] = useState(0)
  const inicioRef = useRef(null)

  useEffect(() => {
    inicioRef.current = null
    let id
    function paso(ts) {
      if (inicioRef.current === null) inicioRef.current = ts
      const t = Math.min(1, (ts - inicioRef.current) / duracionMs)
      const avance = 1 - (1 - t) * (1 - t) // easeOutQuad: arranca rápido, frena al final
      setMostrado(Math.round(avance * valor))
      if (t < 1) id = requestAnimationFrame(paso)
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [valor, duracionMs])

  return (
    <>
      {mostrado}
      {sufijo}
    </>
  )
}
