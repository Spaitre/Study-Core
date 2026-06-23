// Servicio de autenticación: contraseñas (scrypt), tokens de sesión, cookies y
// el middleware requireAuth. La lógica vive aquí; el acceso a datos lo hacen
// usuariosRepo y tokensRepo. Sin dependencias de auth externas (node:crypto).
import crypto from 'node:crypto'
import { usuariosRepo } from '../repositories/usuariosRepo.js'
import { tokensRepo } from '../repositories/tokensRepo.js'

const COOKIE_NAME = 'sc_token'
const DIAS_VALIDEZ = 30
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
  return usuariosRepo.crear({ email, hash, salt, nombre, foto: 'ajolote', invitado: 0 })
}

// Crea una cuenta de invitado (sin registro): correo y contraseña aleatorios
// que no sirven para iniciar sesión; solo vive mientras dure la sesión.
export async function crearInvitado(nombreUsuario, foto) {
  const email = `invitado_${crypto.randomBytes(6).toString('hex')}@guest.local`
  const { hash, salt } = hashPassword(crypto.randomBytes(24).toString('hex'))
  return usuariosRepo.crear({ email, hash, salt, nombre: nombreUsuario, foto, invitado: 1 })
}

export async function verificarCredenciales(email, password) {
  const u = await usuariosRepo.porEmail(email)
  if (!u) return null
  if (!verifyPassword(password, u.password_hash, u.password_salt)) return null
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
