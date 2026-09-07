// Bus de eventos minúsculo para avisos de logro (ganar XP, desbloquear un
// avatar). Se dispara desde donde ocurre la acción (crear pregunta, terminar
// sesión, aceptar amigo) y lo consume un solo <LogroToast> montado una vez en
// App.jsx — evita pasar la función por props a través de varias pantallas.
const listeners = new Set()

export function mostrarLogro(info) {
  listeners.forEach((fn) => fn(info))
}

export function suscribirLogros(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Traduce la respuesta de progresar() del backend ({ esNueva, xpGanado,
// avatarDesbloqueado }) al aviso correspondiente, si aplica. `xpExtra` suma
// XP de otro origen (p. ej. el de la sesión, aparte del de la misión).
export function logroDeMision(mision, xpExtra = 0) {
  if (mision?.avatarDesbloqueado) {
    mostrarLogro({ tipo: 'avatar', avatar: mision.avatarDesbloqueado })
    return
  }
  const xpTotal = (mision?.xpGanado || 0) + xpExtra
  if (xpTotal > 0) mostrarLogro({ tipo: 'xp', xp: xpTotal })
}
