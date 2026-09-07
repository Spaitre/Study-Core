// Carga server/../.env en desarrollo local (Node nativo, sin dependencias).
// En producción (Railway) las variables se configuran en la plataforma y no
// existe archivo .env, así que un fallo aquí es normal y se ignora.
// IMPORTANTE: debe ser el primer import de server/index.js para que el resto
// de módulos (que leen process.env al cargarse) ya vean estas variables.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // sin .env (producción, o aún no se configuró ninguna variable)
}
