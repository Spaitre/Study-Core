// Rate limiting por IP para endpoints de auth expuestos sin sesión
// (login/registro/invitado). En memoria: alcanza porque el backend corre en
// una sola instancia (ver railway.json, numReplicas: 1) y ya existe bloqueo
// por CUENTA en authService.js — esto es una capa aparte contra IPs que
// atacan muchas cuentas distintas o crean cuentas en masa.
//
// Los límites son generosos a propósito: varios alumnos de la misma escuela
// suelen compartir la IP pública del WiFi del campus (NAT), así que un
// límite pensado para un solo usuario bloquearía a un salón entero.
const intentos = new Map() // `${bucket}:${ip}` -> { cuenta, expira }

function limpiarExpirados() {
  const ahora = Date.now()
  for (const [clave, v] of intentos) {
    if (v.expira <= ahora) intentos.delete(clave)
  }
}
setInterval(limpiarExpirados, 5 * 60 * 1000).unref()

export function limitarPorIp(bucket, max, ventanaMs) {
  return (req, res, next) => {
    const clave = `${bucket}:${req.ip}`
    const ahora = Date.now()
    const actual = intentos.get(clave)

    if (!actual || actual.expira <= ahora) {
      intentos.set(clave, { cuenta: 1, expira: ahora + ventanaMs })
      return next()
    }

    actual.cuenta++
    if (actual.cuenta > max) {
      const min = Math.max(1, Math.ceil((actual.expira - ahora) / 60000))
      return res
        .status(429)
        .json({ error: `Demasiados intentos desde esta red. Intenta de nuevo en ${min} minuto${min === 1 ? '' : 's'}.` })
    }
    next()
  }
}
