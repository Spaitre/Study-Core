// Redimensiona/comprime una imagen en el navegador ANTES de subirla, para
// nunca mandar el archivo original sin procesar al servidor (una foto de
// celular sin comprimir puede pesar varios MB; esto la deja en unos cientos
// de KB sin perder detalle relevante).
function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => resolve(img)
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Recorta al centro y reduce a un cuadrado de `size`x`size` (fotos de perfil).
export async function recortarCuadrado(file, size = 256, calidad = 0.85) {
  const img = await cargarImagen(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const min = Math.min(img.width, img.height)
  const sx = (img.width - min) / 2
  const sy = (img.height - min) / 2
  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
  return canvas.toDataURL('image/jpeg', calidad)
}

// Reduce manteniendo proporción (sin recortar) hasta que el lado más largo
// mida `maxLado`. Para imágenes de preguntas: hay que ver el contenido
// completo (una radiografía, un ECG), no solo el centro recortado.
export async function reducirImagen(file, maxLado = 1000, calidad = 0.8) {
  const img = await cargarImagen(file)
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
  const w = Math.round(img.width * escala)
  const h = Math.round(img.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', calidad)
}
