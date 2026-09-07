// Catálogo visual de cosméticos (marcos de avatar e insignias) ganables en
// las cajas de regalo. Las claves deben coincidir con
// server/services/cosmeticosCatalogo.js, que es la fuente de verdad para el
// sorteo; aquí solo vive cómo se ven.
export const MARCOS = [
  { clave: 'marco_bronce', nombre: 'Bronce', rareza: 'comun', color: '#c98a4b', color2: '#8a5a26' },
  { clave: 'marco_plata', nombre: 'Plata', rareza: 'comun', color: '#d5dbe3', color2: '#9aa3b0' },
  { clave: 'marco_oro', nombre: 'Oro', rareza: 'raro', color: '#fbd34d', color2: '#d69e00' },
  { clave: 'marco_esmeralda', nombre: 'Esmeralda', rareza: 'raro', color: '#4ade80', color2: '#15803d' },
  { clave: 'marco_zafiro', nombre: 'Zafiro', rareza: 'epico', color: '#60a5fa', color2: '#1d4ed8' },
  { clave: 'marco_rubi', nombre: 'Rubí', rareza: 'legendario', color: '#f87171', color2: '#b91c1c' },
]

export const INSIGNIAS = [
  { clave: 'insignia_corazon', nombre: 'Corazón', rareza: 'comun', icono: '❤️' },
  { clave: 'insignia_estrella', nombre: 'Estrella', rareza: 'comun', icono: '⭐' },
  { clave: 'insignia_rayo', nombre: 'Rayo', rareza: 'raro', icono: '⚡' },
  { clave: 'insignia_trofeo', nombre: 'Trofeo', rareza: 'raro', icono: '🏆' },
  { clave: 'insignia_corona', nombre: 'Corona', rareza: 'epico', icono: '👑' },
  { clave: 'insignia_diamante', nombre: 'Diamante', rareza: 'legendario', icono: '💎' },
]

export const TODOS_COSMETICOS = [...MARCOS, ...INSIGNIAS]

export const RAREZA_LABEL = { comun: 'Común', raro: 'Raro', epico: 'Épico', legendario: 'Legendario' }

export function buscarCosmetico(clave) {
  return TODOS_COSMETICOS.find((c) => c.clave === clave) || null
}
