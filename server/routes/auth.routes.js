// Rutas de autenticación (públicas, bajo /api/auth). Solo HTTP: parsean la
// petición, llaman al servicio y responden. La lógica vive en authService.
import { Router } from 'express'
import { ah } from './_wrap.js'
import {
  crearUsuario,
  crearInvitado,
  verificarCredenciales,
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
import { usuariosRepo } from '../repositories/usuariosRepo.js'

const router = Router()
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

router.post(
  '/registro',
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
  ah(async (req, res) => {
    const nombre = await nombreInvitadoUnico()
    const foto = AVATARES[Math.floor(Math.random() * AVATARES.length)]
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
