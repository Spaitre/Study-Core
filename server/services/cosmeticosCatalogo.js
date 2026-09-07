// Catálogo de cosméticos (marcos de avatar e insignias) ganables en las cajas
// de regalo. El servidor solo necesita clave/tipo/rareza para el sorteo; el
// detalle visual (colores, iconos) vive en src/components/cosmeticos.js —
// las claves deben coincidir entre ambos archivos.
export const COSMETICOS = [
  { clave: 'marco_bronce', tipo: 'marco', rareza: 'comun' },
  { clave: 'marco_plata', tipo: 'marco', rareza: 'comun' },
  { clave: 'marco_oro', tipo: 'marco', rareza: 'raro' },
  { clave: 'marco_esmeralda', tipo: 'marco', rareza: 'raro' },
  { clave: 'marco_zafiro', tipo: 'marco', rareza: 'epico' },
  { clave: 'marco_rubi', tipo: 'marco', rareza: 'legendario' },
  { clave: 'insignia_corazon', tipo: 'insignia', rareza: 'comun' },
  { clave: 'insignia_estrella', tipo: 'insignia', rareza: 'comun' },
  { clave: 'insignia_rayo', tipo: 'insignia', rareza: 'raro' },
  { clave: 'insignia_trofeo', tipo: 'insignia', rareza: 'raro' },
  { clave: 'insignia_corona', tipo: 'insignia', rareza: 'epico' },
  { clave: 'insignia_diamante', tipo: 'insignia', rareza: 'legendario' },
]

// Peso relativo dentro del sorteo de cosméticos: entre más rara, menos
// probable, para que los legendarios se sientan especiales.
const PESO_RAREZA = { comun: 10, raro: 5, epico: 2, legendario: 1 }

// Elige un cosmético al azar entre los que el usuario todavía no tiene.
// Devuelve null si ya los tiene todos (el llamador debe tener un plan B).
export function sortearCosmetico(clavesYaObtenidas) {
  const disponibles = COSMETICOS.filter((c) => !clavesYaObtenidas.includes(c.clave))
  if (disponibles.length === 0) return null
  const total = disponibles.reduce((s, c) => s + PESO_RAREZA[c.rareza], 0)
  let n = Math.random() * total
  for (const c of disponibles) {
    n -= PESO_RAREZA[c.rareza]
    if (n <= 0) return c
  }
  return disponibles[disponibles.length - 1]
}
