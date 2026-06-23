// Avatares: 7 caritas animadas (SVG) + soporte para foto subida (data URL).
// Las animaciones (flotar/parpadear) están en index.css con las clases av-*.

export const AVATARES = [
  { key: 'ajolote', label: 'Ajolote' },
  { key: 'gato', label: 'Gato' },
  { key: 'zorro', label: 'Zorro' },
  { key: 'buho', label: 'Búho' },
  { key: 'rana', label: 'Rana' },
  { key: 'pinguino', label: 'Pingüino' },
  { key: 'pulpo', label: 'Pulpo' },
  { key: 'perro', label: 'Perro' },
  { key: 'conejo', label: 'Conejo' },
  { key: 'panda', label: 'Panda' },
  { key: 'leon', label: 'León' },
  { key: 'unicornio', label: 'Unicornio' },
  { key: 'dragon', label: 'Dragón' },
]

// Ojos reutilizables (parpadean).
function Ojos({ cx1, cx2, cy, r = 5, brillo = true }) {
  return (
    <g className="av-blink">
      <circle cx={cx1} cy={cy} r={r} fill="#1f2937" />
      <circle cx={cx2} cy={cy} r={r} fill="#1f2937" />
      {brillo && (
        <>
          <circle cx={cx1 + 1.6} cy={cy - 1.6} r={r / 3} fill="#fff" />
          <circle cx={cx2 + 1.6} cy={cy - 1.6} r={r / 3} fill="#fff" />
        </>
      )}
    </g>
  )
}

function Ajolote() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#fde2ef" />
      <g className="av-bob">
        {/* branquias */}
        <g className="av-sway">
          <path d="M30 40 Q14 34 12 28" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M30 47 Q12 47 8 44" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M30 54 Q14 60 12 66" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
        <g className="av-sway">
          <path d="M70 40 Q86 34 88 28" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M70 47 Q88 47 92 44" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M70 54 Q86 60 88 66" stroke="#f9a8d4" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="52" r="26" fill="#f9b8d6" />
        <Ojos cx1={41} cx2={59} cy={50} r={4} />
        <circle cx="38" cy="58" r="3.5" fill="#fb7baf" opacity="0.7" />
        <circle cx="62" cy="58" r="3.5" fill="#fb7baf" opacity="0.7" />
        <path d="M44 60 Q50 66 56 60" stroke="#9d174d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Gato() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#e2e8f0" />
      <g className="av-bob">
        {/* orejas */}
        <path d="M30 30 L23 9 L47 24 Z" fill="#111827" />
        <path d="M70 30 L77 9 L53 24 Z" fill="#111827" />
        <path d="M32 27 L28 15 L42 25 Z" fill="#374151" />
        <path d="M68 27 L72 15 L58 25 Z" fill="#374151" />
        {/* cara */}
        <circle cx="50" cy="54" r="27" fill="#111827" />
        {/* ojos verdes con pupila vertical */}
        <g className="av-blink">
          <ellipse cx="41" cy="52" rx="5" ry="6.5" fill="#a3e635" />
          <ellipse cx="59" cy="52" rx="5" ry="6.5" fill="#a3e635" />
          <ellipse cx="41" cy="52" rx="1.6" ry="5.5" fill="#111827" />
          <ellipse cx="59" cy="52" rx="1.6" ry="5.5" fill="#111827" />
        </g>
        <path d="M50 60 l-3 3 h6 z" fill="#f9a8d4" />
        <path d="M50 63 Q45 67 41 65 M50 63 Q55 67 59 65" stroke="#374151" strokeWidth="2" fill="none" strokeLinecap="round" />
        <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.9">
          <path d="M34 58 H18 M34 62 H20" />
          <path d="M66 58 H82 M66 62 H80" />
        </g>
      </g>
    </>
  )
}

function Zorro() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#ffe9d6" />
      <g className="av-bob">
        <path d="M28 32 L22 10 L42 26 Z" fill="#ea580c" />
        <path d="M72 32 L78 10 L58 26 Z" fill="#ea580c" />
        <path d="M24 40 Q50 20 76 40 Q70 72 50 78 Q30 72 24 40 Z" fill="#f97316" />
        <path d="M34 52 Q50 40 50 78 Q40 70 34 52 Z" fill="#fff" />
        <path d="M66 52 Q50 40 50 78 Q60 70 66 52 Z" fill="#fff" />
        <Ojos cx1={40} cx2={60} cy={50} r={4} />
        <path d="M50 64 l-4 4 h8 z" fill="#1f2937" />
      </g>
    </>
  )
}

function Buho() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#e7e2ff" />
      <g className="av-bob">
        <path d="M28 34 L24 18 L40 28 Z" fill="#7c6f57" />
        <path d="M72 34 L76 18 L60 28 Z" fill="#7c6f57" />
        <ellipse cx="50" cy="54" rx="28" ry="26" fill="#9b8b6e" />
        <circle cx="40" cy="48" r="13" fill="#fff" />
        <circle cx="60" cy="48" r="13" fill="#fff" />
        <g className="av-blink">
          <circle cx="40" cy="48" r="6" fill="#1f2937" />
          <circle cx="60" cy="48" r="6" fill="#1f2937" />
          <circle cx="42" cy="46" r="2" fill="#fff" />
          <circle cx="62" cy="46" r="2" fill="#fff" />
        </g>
        <path d="M50 56 l-4 6 h8 z" fill="#f59e0b" />
        <path d="M34 70 Q42 78 50 72 Q58 78 66 70" stroke="#7c6f57" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Rana() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#dcfce7" />
      <g className="av-bob">
        <circle cx="36" cy="34" r="12" fill="#4ade80" />
        <circle cx="64" cy="34" r="12" fill="#4ade80" />
        <g className="av-blink">
          <circle cx="36" cy="34" r="6" fill="#fff" />
          <circle cx="64" cy="34" r="6" fill="#fff" />
          <circle cx="36" cy="34" r="3" fill="#1f2937" />
          <circle cx="64" cy="34" r="3" fill="#1f2937" />
        </g>
        <path d="M24 46 Q50 38 76 46 Q74 72 50 76 Q26 72 24 46 Z" fill="#22c55e" />
        <path d="M34 60 Q50 72 66 60" stroke="#14532d" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="40" cy="64" r="2.5" fill="#16a34a" />
        <circle cx="60" cy="64" r="2.5" fill="#16a34a" />
      </g>
    </>
  )
}

function Pinguino() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#dbeafe" />
      <g className="av-bob">
        <ellipse cx="50" cy="52" rx="27" ry="30" fill="#1f2937" />
        <ellipse cx="50" cy="58" rx="17" ry="22" fill="#fff" />
        <Ojos cx1={43} cx2={57} cy={42} r={3.5} />
        <path d="M50 46 l-5 4 5 4 5 -4 z" fill="#f59e0b" />
        <path d="M30 78 q-6 6 2 7 M70 78 q6 6 -2 7" stroke="#f59e0b" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Pulpo() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#ede9fe" />
      <g className="av-bob">
        <path d="M26 50 Q26 24 50 24 Q74 24 74 50 L74 60 Q74 64 70 64 L30 64 Q26 64 26 60 Z" fill="#a78bfa" />
        <g className="av-tentacle" fill="#8b5cf6">
          <path d="M28 60 Q24 76 30 82 Q34 76 34 62 Z" />
          <path d="M40 64 Q38 80 44 84 Q47 78 46 64 Z" />
          <path d="M54 64 Q56 80 50 84 Q47 78 48 64 Z" />
          <path d="M66 60 Q70 76 64 82 Q60 76 60 62 Z" />
        </g>
        <Ojos cx1={42} cx2={58} cy={46} r={4.5} />
        <path d="M44 56 Q50 60 56 56" stroke="#5b21b6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Perro() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#fef3e2" />
      <g className="av-bob">
        {/* orejas caídas */}
        <path d="M28 30 Q14 32 16 54 Q26 52 32 40 Z" fill="#92400e" />
        <path d="M72 30 Q86 32 84 54 Q74 52 68 40 Z" fill="#92400e" />
        <circle cx="50" cy="52" r="26" fill="#c87f38" />
        <ellipse cx="50" cy="60" rx="16" ry="13" fill="#f5deb3" />
        <Ojos cx1={41} cx2={59} cy={48} r={4} />
        <ellipse cx="50" cy="58" rx="5" ry="4" fill="#1f2937" />
        <path d="M50 62 V66 Q45 69 42 66 M50 66 Q55 69 58 66" stroke="#7c4a12" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Conejo() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#86efac" />
      <g className="av-bob">
        {/* orejas largas */}
        <g className="av-sway">
          <ellipse cx="40" cy="22" rx="6" ry="18" fill="#f3f4f6" />
          <ellipse cx="60" cy="22" rx="6" ry="18" fill="#f3f4f6" />
          <ellipse cx="40" cy="22" rx="2.5" ry="12" fill="#fbcfe8" />
          <ellipse cx="60" cy="22" rx="2.5" ry="12" fill="#fbcfe8" />
        </g>
        <circle cx="50" cy="56" r="24" fill="#f9fafb" />
        <Ojos cx1={42} cx2={58} cy={54} r={4} />
        <path d="M50 60 l-3 3 h6 z" fill="#f472b6" />
        <path d="M50 63 V67 M50 63 Q46 66 43 65 M50 63 Q54 66 57 65" stroke="#9ca3af" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="38" cy="62" r="3" fill="#fbcfe8" opacity="0.7" />
        <circle cx="62" cy="62" r="3" fill="#fbcfe8" opacity="0.7" />
      </g>
    </>
  )
}

function Panda() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#93c5fd" />
      <g className="av-bob">
        <circle cx="32" cy="30" r="10" fill="#111827" />
        <circle cx="68" cy="30" r="10" fill="#111827" />
        <circle cx="50" cy="54" r="27" fill="#fafafa" />
        {/* parches de ojos */}
        <ellipse cx="40" cy="52" rx="8" ry="10" fill="#111827" transform="rotate(-18 40 52)" />
        <ellipse cx="60" cy="52" rx="8" ry="10" fill="#111827" transform="rotate(18 60 52)" />
        <g className="av-blink">
          <circle cx="41" cy="52" r="3.5" fill="#fff" />
          <circle cx="59" cy="52" r="3.5" fill="#fff" />
        </g>
        <ellipse cx="50" cy="62" rx="4" ry="3" fill="#111827" />
        <path d="M50 65 Q46 69 42 67 M50 65 Q54 69 58 67" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Leon() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#fff7ed" />
      <g className="av-bob">
        {/* melena */}
        <g fill="#b45309">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2
            const x = 50 + Math.cos(a) * 30
            const y = 54 + Math.sin(a) * 30
            return <circle key={i} cx={x} cy={y} r="8" />
          })}
        </g>
        <circle cx="50" cy="54" r="24" fill="#f59e0b" />
        <Ojos cx1={42} cx2={58} cy={50} r={4} />
        <path d="M50 58 l-4 3 h8 z" fill="#7c2d12" />
        <path d="M50 61 V65 Q45 68 42 65 M50 65 Q55 68 58 65" stroke="#7c2d12" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

function Unicornio() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#c4b5fd" />
      <g className="av-bob">
        {/* cuerno */}
        <path d="M50 8 l5 20 h-10 z" fill="#fcd34d" />
        <path d="M50 8 l5 20 h-10 z" fill="none" stroke="#f59e0b" strokeWidth="1" />
        {/* orejas */}
        <path d="M34 30 L30 16 L44 26 Z" fill="#f5f3ff" />
        <path d="M66 30 L70 16 L56 26 Z" fill="#f5f3ff" />
        {/* melena */}
        <path d="M34 26 Q22 34 26 50 Q34 44 36 34 Z" fill="#a78bfa" />
        <path d="M66 26 Q78 34 74 50 Q66 44 64 34 Z" fill="#f9a8d4" />
        <circle cx="50" cy="54" r="25" fill="#fafafa" />
        <Ojos cx1={42} cx2={58} cy={52} r={4} />
        <path d="M50 60 l-3 2 h6 z" fill="#f472b6" />
        <circle cx="38" cy="60" r="3.5" fill="#fbcfe8" opacity="0.7" />
        <circle cx="62" cy="60" r="3.5" fill="#fbcfe8" opacity="0.7" />
      </g>
    </>
  )
}

function Dragon() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="#dcfce7" />
      <g className="av-bob">
        {/* cuernos */}
        <path d="M34 26 L30 12 L42 22 Z" fill="#facc15" />
        <path d="M66 26 L70 12 L58 22 Z" fill="#facc15" />
        {/* púas */}
        <g fill="#15803d">
          <path d="M50 22 l5 8 h-10 z" />
          <path d="M40 24 l4 7 h-8 z" />
          <path d="M60 24 l4 7 h-8 z" />
        </g>
        <circle cx="50" cy="54" r="26" fill="#22c55e" />
        <ellipse cx="50" cy="64" rx="14" ry="11" fill="#86efac" />
        <Ojos cx1={41} cx2={59} cy={48} r={4.5} />
        <ellipse cx="44" cy="64" rx="2" ry="2.5" fill="#166534" />
        <ellipse cx="56" cy="64" rx="2" ry="2.5" fill="#166534" />
        <path d="M44 70 Q50 73 56 70" stroke="#166534" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </>
  )
}

const RENDERERS = {
  ajolote: Ajolote,
  gato: Gato,
  zorro: Zorro,
  buho: Buho,
  rana: Rana,
  pinguino: Pinguino,
  pulpo: Pulpo,
  perro: Perro,
  conejo: Conejo,
  panda: Panda,
  leon: Leon,
  unicornio: Unicornio,
  dragon: Dragon,
}

export default function Avatar({ foto, size = 56 }) {
  // Imagen subida por el usuario.
  if (typeof foto === 'string' && foto.startsWith('data:')) {
    return (
      <img
        className="avatar avatar-img"
        src={foto}
        alt="Foto de perfil"
        style={{ width: size, height: size }}
      />
    )
  }
  const Render = RENDERERS[foto] || Ajolote
  return (
    <svg
      className="avatar"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Avatar"
    >
      <Render />
    </svg>
  )
}
