// Progreso de gamificación: racha diaria, XP/nivel, monedas y cajas de regalo.
import { database } from '../db/index.js'
import { progresoRepo } from '../repositories/progresoRepo.js'
import { sortearCosmetico } from './cosmeticosCatalogo.js'
import { fallo } from './ApiError.js'

// XP por pregunta acertada + bono fijo por terminar una sesión (incentiva
// terminar aunque falten pocas correctas).
const XP_POR_ACIERTO = 10
const BONUS_SESION = 20

// Escalafón médico usado como "nivel". xpMin es el umbral acumulado para
// entrar a ese nivel (no XP por nivel); el nombre se muestra tal cual en la UI.
export const NIVELES = [
  { nombre: 'Estudiante', xpMin: 0 },
  { nombre: 'Interno', xpMin: 500 },
  { nombre: 'Pasante', xpMin: 1200 },
  { nombre: 'Médico general', xpMin: 2200 },
  { nombre: 'R1', xpMin: 3600 },
  { nombre: 'R2', xpMin: 5400 },
  { nombre: 'R3', xpMin: 7600 },
  { nombre: 'R4', xpMin: 10200 },
  { nombre: 'Especialista', xpMin: 13500 },
  { nombre: 'Subespecialista', xpMin: 17500 },
  { nombre: 'Adscrito', xpMin: 22500 },
  { nombre: 'Jefe de servicio', xpMin: 28500 },
  { nombre: 'Subdirector médico', xpMin: 36000 },
  { nombre: 'Director de Hospital', xpMin: 45000 },
]

// Recompensa de las cajas: se sortea al abrir (ponderado). Si toca 'cosmetico'
// pero el usuario ya tiene todo el catálogo, se recae en monedas (ver abrirCaja).
const RECOMPENSAS = [
  { tipo: 'monedas', peso: 55, min: 10, max: 30 },
  { tipo: 'xp', peso: 30, min: 20, max: 50 },
  { tipo: 'cosmetico', peso: 15 },
]

export function calcularNivel(xpTotal) {
  let indice = 0
  for (let i = 0; i < NIVELES.length; i++) {
    if (xpTotal >= NIVELES[i].xpMin) indice = i
    else break
  }
  const actual = NIVELES[indice]
  const siguiente = NIVELES[indice + 1] || null
  return {
    nombre: actual.nombre,
    indice,
    xpNivelInicio: actual.xpMin,
    xpSiguiente: siguiente ? siguiente.xpMin : null,
    // 1 = nivel máximo alcanzado (no hay siguiente umbral).
    progreso: siguiente ? (xpTotal - actual.xpMin) / (siguiente.xpMin - actual.xpMin) : 1,
  }
}

function fechaUTC(fecha) {
  return fecha.toISOString().slice(0, 10)
}

function sortearRecompensa() {
  const total = RECOMPENSAS.reduce((s, r) => s + r.peso, 0)
  let n = Math.random() * total
  for (const r of RECOMPENSAS) {
    if (n < r.peso) return r
    n -= r.peso
  }
  return RECOMPENSAS[RECOMPENSAS.length - 1]
}

export const progresoService = {
  // Se llama dentro de la misma transacción que guarda la sesión (ver
  // sesionesService.guardar). Actualiza racha + XP y, si la racha avanza a un
  // día nuevo, otorga una caja de regalo.
  async registrarActividad(usuarioId, aciertos, tx) {
    await progresoRepo.asegurarFila(usuarioId, tx)
    const prog = await progresoRepo.obtener(usuarioId, tx)

    const hoy = fechaUTC(new Date())
    let rachaActual = prog.racha_actual
    let esDiaNuevo = false
    if (prog.ultima_fecha_actividad !== hoy) {
      esDiaNuevo = true
      const ayer = fechaUTC(new Date(Date.now() - 24 * 60 * 60 * 1000))
      rachaActual = prog.ultima_fecha_actividad === ayer ? rachaActual + 1 : 1
    }
    const rachaMaxima = Math.max(prog.racha_maxima, rachaActual)
    const xpGanado = aciertos * XP_POR_ACIERTO + BONUS_SESION
    const xpTotal = prog.xp_total + xpGanado

    await progresoRepo.actualizarActividad(
      usuarioId,
      { rachaActual, rachaMaxima, ultimaFechaActividad: hoy, xpTotal },
      tx,
    )

    let cajaId = null
    if (esDiaNuevo) {
      cajaId = await progresoRepo.crearCaja(usuarioId, 'racha_diaria', new Date().toISOString(), tx)
    }

    return { xpGanado, rachaActual, cajaNueva: cajaId !== null }
  },

  async resumen(usuarioId) {
    await progresoRepo.asegurarFila(usuarioId)
    const prog = await progresoRepo.obtener(usuarioId)
    const [cajas, cosmeticos] = await Promise.all([
      progresoRepo.cajasPendientes(usuarioId),
      progresoRepo.clavesCosmeticos(usuarioId),
    ])
    return {
      rachaActual: prog.racha_actual,
      rachaMaxima: prog.racha_maxima,
      xpTotal: prog.xp_total,
      monedas: prog.monedas,
      nivel: calcularNivel(prog.xp_total),
      cajas,
      cajasPendientes: cajas.length,
      cosmeticos,
    }
  },

  async abrirCaja(usuarioId, cajaId) {
    const caja = await progresoRepo.obtenerCaja(cajaId, usuarioId)
    if (!caja) throw fallo(404, 'caja no encontrada')
    if (caja.abierta_en) throw fallo(400, 'esta caja ya fue abierta')

    let r = sortearRecompensa()
    let cosmetico = null
    if (r.tipo === 'cosmetico') {
      const yaObtenidas = await progresoRepo.clavesCosmeticos(usuarioId)
      cosmetico = sortearCosmetico(yaObtenidas)
      // Catálogo agotado para este usuario: recae en monedas en vez de nada.
      if (!cosmetico) r = RECOMPENSAS.find((x) => x.tipo === 'monedas')
    }

    const cantidad = r.tipo === 'cosmetico' ? null : Math.floor(Math.random() * (r.max - r.min + 1)) + r.min
    const ahora = new Date().toISOString()

    // El check de arriba (`caja.abierta_en`) no es atómico: dos peticiones
    // concurrentes (doble clic, reintento de red) pueden pasarlo las dos. La
    // UPDATE con guard es lo que de verdad decide quién gana — si perdemos la
    // carrera, `changes` sale en 0 y no se entrega nada.
    const gano = await database.withTransaction(async (tx) => {
      const info = await progresoRepo.marcarAbierta(cajaId, r.tipo, cantidad, cosmetico?.clave ?? null, ahora, tx)
      if (info.changes === 0) return false
      if (r.tipo === 'monedas') await progresoRepo.sumarMonedas(usuarioId, cantidad, tx)
      else if (r.tipo === 'xp') await progresoRepo.sumarXp(usuarioId, cantidad, tx)
      else await progresoRepo.otorgarCosmetico(usuarioId, cosmetico.clave, ahora, tx)
      return true
    })

    if (!gano) throw fallo(400, 'esta caja ya fue abierta')

    return r.tipo === 'cosmetico'
      ? { tipo: 'cosmetico', clave: cosmetico.clave, rareza: cosmetico.rareza }
      : { tipo: r.tipo, cantidad }
  },
}
