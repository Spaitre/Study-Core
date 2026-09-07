// Servicio de autenticación: contraseñas (scrypt), tokens de sesión, cookies y
// el middleware requireAuth. La lógica vive aquí; el acceso a datos lo hacen
// usuariosRepo y tokensRepo. Sin dependencias de auth externas (node:crypto).
import crypto from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { tokensRepo } from '../repositories/tokensRepo.js'
import { fallo } from './ApiError.js'

const COOKIE_NAME = 'sc_token'
const DIAS_VALIDEZ = 30
// Login con Google: opcional. Sin GOOGLE_CLIENT_ID configurado, la ruta
// correspondiente responde que no está disponible en vez de fallar al cargar.
// Acepta también VITE_GOOGLE_CLIENT_ID para que baste con una sola variable
// en .env (el front la necesita con ese prefijo; aquí no es obligatorio).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
// Bloqueo temporal de la cuenta tras varios intentos de login fallidos
// seguidos (mitiga fuerza bruta sobre una cuenta conocida).
const MAX_INTENTOS_LOGIN = 5
const BLOQUEO_MS = 15 * 60 * 1000
// En despliegue con HTTPS, exporta COOKIE_SECURE=1 para marcar la cookie Secure.
const cookieSecure = process.env.COOKIE_SECURE === '1'

// Avatares predefinidos (claves SVG). Compartido con el perfil para validar la
// foto y para asignar uno aleatorio a los invitados.
export const AVATARES = [
  'ajolote',
  'gato',
  'zorro',
  'buho',
  'rana',
  'pinguino',
  'pulpo',
  'perro',
  'conejo',
  'panda',
  'leon',
  'unicornio',
  'dragon',
]

// ----- Contraseñas -----
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}
function verifyPassword(password, hash, salt) {
  const intento = crypto.scryptSync(password, salt, 64).toString('hex')
  const a = Buffer.from(intento, 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ----- Tokens de sesión (solo se guarda el sha256, no el token en claro) -----
function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function crearToken(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex')
  const ahora = new Date()
  const expira = new Date(ahora.getTime() + DIAS_VALIDEZ * 86400000)
  await tokensRepo.crear(tokenHash(token), usuarioId, ahora.toISOString(), expira.toISOString())
  return { token, expira }
}

export async function usuarioPorToken(token) {
  if (!token) return null
  const row = await tokensRepo.porHash(tokenHash(token))
  if (!row) return null
  if (new Date(row.expira_en) < new Date()) {
    await tokensRepo.borrar(tokenHash(token))
    return null
  }
  return usuariosRepo.perfil(row.usuario_id)
}

export async function borrarToken(token) {
  if (token) await tokensRepo.borrar(tokenHash(token))
}

// ----- Cuentas -----
async function generarUsername(email) {
  const base = String(email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'usuario'
  let nombre = base
  let k = 2
  while (await usuariosRepo.nombreTomado(nombre)) nombre = `${base}${k++}`
  return nombre
}

export async function crearUsuario(email, password) {
  const { hash, salt } = hashPassword(password)
  const nombre = await generarUsername(email)
  // 'gato' porque 'ajolote' es un avatar bloqueado (desbloqueable por misión).
  return usuariosRepo.crear({ email, hash, salt, nombre, foto: 'gato', invitado: 0 })
}

// Crea una cuenta de invitado (sin registro): correo y contraseña aleatorios
// que no sirven para iniciar sesión; solo vive mientras dure la sesión.
export async function crearInvitado(nombreUsuario, foto) {
  const email = `invitado_${crypto.randomBytes(6).toString('hex')}@guest.local`
  const { hash, salt } = hashPassword(crypto.randomBytes(24).toString('hex'))
  return usuariosRepo.crear({ email, hash, salt, nombre: nombreUsuario, foto, invitado: 1 })
}

// Verifica un idToken de Google Identity Services y devuelve el perfil,
// creando la cuenta si es la primera vez o vinculándola por correo si ya
// existía una cuenta registrada con contraseña (se confía en que Google ya
// verificó ese correo). No usa contraseña: a la cuenta se le asigna una
// aleatoria e inutilizable, igual que a los invitados.
export async function iniciarSesionGoogle(idToken) {
  if (!googleClient) throw fallo(500, 'El login con Google no está configurado en el servidor')
  if (!idToken) throw fallo(400, 'Falta el token de Google')

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch {
    throw fallo(401, 'Token de Google inválido')
  }
  if (!payload?.email) throw fallo(401, 'Google no proporcionó un correo')
  if (!payload.email_verified) throw fallo(401, 'Ese correo de Google no está verificado')
  const email = String(payload.email).trim().toLowerCase()

  const existente = await usuariosRepo.porEmail(email)
  const u = existente || (await crearUsuario(email, crypto.randomBytes(24).toString('hex')))
  return usuariosRepo.perfil(u.id)
}

// Minutos redondeados hacia arriba hasta que expire un bloqueo (mínimo 1).
function minutosRestantes(bloqueadoHasta) {
  const ms = new Date(bloqueadoHasta).getTime() - Date.now()
  return Math.max(1, Math.ceil(ms / 60000))
}

export async function verificarCredenciales(email, password) {
  const u = await usuariosRepo.porEmail(email)
  if (!u) return null

  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) {
    const min = minutosRestantes(u.bloqueado_hasta)
    throw fallo(
      429,
      `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en ${min} minuto${min === 1 ? '' : 's'}.`,
    )
  }

  if (!verifyPassword(password, u.password_hash, u.password_salt)) {
    const intentos = (u.bloqueado_hasta ? 0 : u.intentos_fallidos) + 1
    const bloqueaAhora = intentos >= MAX_INTENTOS_LOGIN
    await usuariosRepo.registrarIntentoFallido(
      u.id,
      bloqueaAhora ? 0 : intentos,
      bloqueaAhora ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null,
    )
    return null
  }

  if (u.intentos_fallidos > 0 || u.bloqueado_hasta) await usuariosRepo.resetIntentosFallidos(u.id)
  return usuariosRepo.perfil(u.id)
}

// Nombre aleatorio único para invitados (AnimalAdjetivoNN).
const INV_ADJETIVOS = [
  'Veloz', 'Curioso', 'Astuto', 'Valiente', 'Sabio', 'Genial', 'Cosmico',
  'Epico', 'Agil', 'Feliz', 'Audaz', 'Brillante',
]
const INV_ANIMALES = [
  'Zorro', 'Buho', 'Ajolote', 'Panda', 'Dragon', 'Leon', 'Gato', 'Conejo',
  'Pinguino', 'Pulpo', 'Unicornio', 'Perro',
]
export async function nombreInvitadoUnico() {
  for (let i = 0; i < 60; i++) {
    const ani = INV_ANIMALES[Math.floor(Math.random() * INV_ANIMALES.length)]
    const adj = INV_ADJETIVOS[Math.floor(Math.random() * INV_ADJETIVOS.length)]
    const n = `${ani}${adj}`.slice(0, 16) + Math.floor(10 + Math.random() * 90)
    if (!(await usuariosRepo.nombreTomado(n))) return n
  }
  let n
  do {
    n = 'Invitado' + Math.floor(1000 + Math.random() * 9000)
  } while (await usuariosRepo.nombreTomado(n))
  return n
}

// ----- Invitados: eliminación y limpieza -----
// Elimina la cuenta de invitado y su contenido (no propaga error: el logout no
// debe fallar por esto).
export async function eliminarCuentaInvitado(id) {
  try {
    await usuariosRepo.eliminarConContenido(id)
  } catch (e) {
    console.error('[Study Core] No se pudo eliminar la cuenta de invitado:', e.message)
  }
}

// Cuentas de invitado de más de 30 días cuya sesión ya expiró. Se ejecuta al
// arrancar y cada 6 horas.
export async function limpiarInvitadosInactivos() {
  const ahora = new Date().toISOString()
  const limite = new Date(Date.now() - 30 * 86400000).toISOString()
  const inactivos = await usuariosRepo.invitadosInactivos(limite, ahora)
  for (const u of inactivos) await eliminarCuentaInvitado(u.id)
  if (inactivos.length)
    console.log(`[Study Core] Invitados inactivos eliminados: ${inactivos.length}.`)
  return inactivos.length
}

// ----- Cookies -----
export function parseCookies(req) {
  const header = req.headers.cookie
  const out = {}
  if (!header) return out
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim())
  }
  return out
}

export function setAuthCookie(res, token, expira) {
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Expires=${expira.toUTCString()}`,
  ]
  if (cookieSecure) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

export function clearAuthCookie(res) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]
  if (cookieSecure) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

// ----- Middleware: exige sesión válida y deja el usuario en req -----
export async function requireAuth(req, res, next) {
  try {
    const token = parseCookies(req)[COOKIE_NAME]
    const u = await usuarioPorToken(token)
    if (!u) return res.status(401).json({ error: 'No autenticado' })
    req.usuarioId = u.id
    req.usuario = u
    next()
  } catch (e) {
    next(e)
  }
}

export { COOKIE_NAME }
