import { useEffect } from 'react'
import Avatar from './Avatar.jsx'

// Aviso flotante que aparece solo y se cierra solo (ganaste XP, desbloqueaste
// un avatar). position: fixed, así que se monta una sola vez en App.jsx y no
// empuja el layout de la pantalla donde se dispara.
export default function LogroToast({ logro, onCerrar }) {
  useEffect(() => {
    if (!logro) return
    const duracion = logro.tipo === 'avatar' ? 3400 : 2400
    const id = setTimeout(onCerrar, duracion)
    return () => clearTimeout(id)
  }, [logro, onCerrar])

  if (!logro) return null

  return (
    <div className={`logro-toast logro-toast-${logro.tipo}`} key={logro.tipo + (logro.avatar || logro.xp)}>
      {logro.tipo === 'avatar' ? (
        <>
          <Avatar foto={logro.avatar} size={32} />
          <span>¡Desbloqueaste un avatar nuevo!</span>
        </>
      ) : (
        <span>✨ +{logro.xp} XP</span>
      )}
    </div>
  )
}
