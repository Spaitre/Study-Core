// Rutas de autenticación (públicas, bajo /api/auth). Solo HTTP: parsean la
// petición, llaman al servicio y responden. La lógica vive en authService.
import { Router } from 'express'
import { ah } from './_wrap.js'
import {
  crearUsuario,
  crearInvitado,
  verificarCredenciales,
  iniciarSesionGoogle,
  crearToken,
  usuarioPorToken,
  borrarToken,
  setAuthCookie,
  clearAuthCookie,
  parseCookies,
  nombreInvitadoUnico,
  eliminarCuentaInvitado,
  AVATARES,
  COOKIE_NAME,
} from '../services/authService.js'
import { AVATARES_BLOQUEADOS } from '../services/avataresCatalogo.js'
import { limitarPorIp } from '../rateLimiter.js'

// Los invitados solo reciben un avatar libre (los bloqueados se desbloquean
// jugando, no vienen gratis de fábrica).
const AVATARES_LIBRES = AVATARES.filter((a) => !AVATARES_BLOQUEADOS.includes(a))
import { usuariosRepo } from '../repositories/usuariosRepo.js'

const router = Router()
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const VENTANA_15MIN = 15 * 60 * 1000

// Límite por IP (además del bloqueo por cuenta que ya existe): protege
// contra fuerza bruta repartida entre varias cuentas y contra creación
// masiva de cuentas/invitados desde un mismo origen.
const limiteLogin = limitarPorIp('login', 30, VENTANA_15MIN)
const limiteRegistro = limitarPorIp('registro', 15, VENTANA_15MIN)
const limiteInvitado = limitarPorIp('invitado', 30, VENTANA_15MIN)

router.post(
  '/registro',
  limiteRegistro,
  ah(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Correo inválido' })
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    if (await usuariosRepo.porEmail(email))
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' })
    const u = await crearUsuario(email, password)
    const { token, expira } = await crearToken(u.id)
    setAuthCookie(res, token, expira)
    res.json({ usuario: { id: u.id, email: u.email } })
  }),
)

router.post(
  '/login',
  limiteLogin,
  ah(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const u = await verificarCredenciales(email, password)
    if (!u) return res.status(401).json({ error: 'Correo o contraseña incorrectos' })
    const { token, expira } = await crearToken(u.id)
    setAuthCookie(res, token, expira)
    res.json({ usuario: u })
  }),
)

router.post(
  '/google',
  ah(async (req, res) => {
    const u = await iniciarSesionGoogle(req.body?.idToken)
    const { token, expira } = await crearToken(u.id)
    setAuthCookie(res, token, expira)
    res.json({ usuario: u })
  }),
)

router.post(
  '/logout',
  ah(async (req, res) => {
    const token = parseCookies(req)[COOKIE_NAME]
    const usuario = await usuarioPorToken(token)
    await borrarToken(token)
    clearAuthCookie(res)
    // Si era invitado, la cuenta temporal se elimina al salir.
    if (usuario && usuario.invitado) await eliminarCuentaInvitado(usuario.id)
    res.json({ ok: true })
  }),
)

router.post(
  '/invitado',
  limiteInvitado,
  ah(async (req, res) => {
    const nombre = await nombreInvitadoUnico()
    const foto = AVATARES_LIBRES[Math.floor(Math.random() * AVATARES_LIBRES.length)]
    const usuario = await crearInvitado(nombre, foto)
    const { token, expira } = await crearToken(usuario.id)
    setAuthCookie(res, token, expira)
    res.json({ usuario })
  }),
)

// Quién soy (no falla si no hay sesión: devuelve usuario null).
router.get(
  '/yo',
  ah(async (req, res) => {
    const u = await usuarioPorToken(parseCookies(req)[COOKIE_NAME])
    res.json({ usuario: u || null })
  }),
)

export default router
