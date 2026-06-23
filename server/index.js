// Punto de entrada del backend: construye la app Express, monta los routers por
// dominio y arranca el servidor. La lógica vive en services/, el SQL en
// repositories/ y el acceso a datos en db/ (interfaz async, lista para Postgres).
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { requireAuth, limpiarInvitadosInactivos } from './services/authService.js'
import { ApiError } from './services/ApiError.js'
import { closeDatabase } from './db/index.js'
import { usuariosRepo } from './repositories/usuariosRepo.js'
import authRoutes from './routes/auth.routes.js'
import perfilRoutes from './routes/perfil.routes.js'
import amigosRoutes from './routes/amigos.routes.js'
import proyectosRoutes from './routes/proyectos.routes.js'
import contenidoRoutes from './routes/contenido.routes.js'
import sesionesRoutes from './routes/sesiones.routes.js'
import salasRoutes from './routes/salas.routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
// Detrás del proxy del hosting (Railway): confía en X-Forwarded-* para que la
// cookie Secure y la detección de protocolo funcionen.
app.set('trust proxy', 1)
app.use(express.json({ limit: '5mb' }))

const PORT = process.env.PORT || 3001

// Autenticación (rutas públicas).
app.use('/api/auth', authRoutes)

// A partir de aquí, TODO requiere sesión y queda aislado por usuario.
app.use('/api', requireAuth)

// Dominios protegidos.
app.use('/api/perfil', perfilRoutes)
app.use('/api/amigos', amigosRoutes)
app.use('/api/proyectos', proyectosRoutes)
app.use('/api', contenidoRoutes) // carpetas/materias/temas/preguntas + import/export
app.use('/api', sesionesRoutes) // sesiones + stats
app.use('/api/salas', salasRoutes) // multijugador (estado en memoria)

// Producción: el mismo Express sirve el build del frontend (mismo origen, sin
// CORS). Se activa si existe dist/ (lo genera `npm run build`); en desarrollo no
// existe y el frontend lo sirve Vite en :80 con su proxy. El fallback devuelve
// index.html para rutas del cliente, sin capturar /api.
const distDir = path.resolve(__dirname, '..', 'dist')
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')))
  console.log('[Study Core] Sirviendo build del frontend desde dist/.')
}

// Manejador de errores: traduce ApiError a su status; el resto es 500.
// Debe ir DESPUÉS de todas las rutas.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message })
  console.error('[Study Core] Error no controlado:', err)
  res.status(500).json({ error: err.message })
})

// ----- Arranque -----
// Las cuentas empiezan vacías: el auto-import de data/json queda desactivado.
console.log(`[Study Core] Cuentas registradas: ${await usuariosRepo.contar()}.`)

// Limpieza de invitados inactivos al arrancar y cada 6 horas.
limpiarInvitadosInactivos()
setInterval(limpiarInvitadosInactivos, 6 * 60 * 60 * 1000)

const server = app.listen(PORT, () => {
  console.log(`[Study Core] API SQLite escuchando en http://localhost:${PORT}`)
})

// Apagado limpio: deja de aceptar conexiones, cierra la BD (checkpoint del WAL)
// y sale. Railway envía SIGTERM en cada despliegue.
let apagando = false
function apagar(signal) {
  if (apagando) return
  apagando = true
  console.log(`[Study Core] ${signal} recibido; cerrando…`)
  server.close(() => {
    closeDatabase()
    process.exit(0)
  })
  // Si alguna conexión cuelga, forzar salida a los 10 s.
  setTimeout(() => process.exit(1), 10000).unref()
}
process.on('SIGTERM', () => apagar('SIGTERM'))
process.on('SIGINT', () => apagar('SIGINT'))
