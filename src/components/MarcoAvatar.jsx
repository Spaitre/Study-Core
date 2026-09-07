import Avatar from './Avatar.jsx'
import { MARCOS } from './cosmeticos.js'

// Avatar + anillo decorativo (marco cosmético equipado), si tiene uno. El
// anillo se dibuja en SVG (mismo estilo que Avatar.jsx), sin assets externos.
export default function MarcoAvatar({ foto, marco, size = 56 }) {
  const def = MARCOS.find((m) => m.clave === marco)
  if (!def) return <Avatar foto={foto} size={size} />

  const grosorAvatar = Math.round(size * 0.86)
  return (
    <div className="marco-avatar" style={{ width: size, height: size }} title={def.nombre}>
      <Avatar foto={foto} size={grosorAvatar} />
      <svg className="marco-anillo" viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="47" fill="none" stroke={def.color2} strokeWidth="7" />
        <circle cx="50" cy="50" r="47" fill="none" stroke={def.color} strokeWidth="3.5" />
      </svg>
    </div>
  )
}
