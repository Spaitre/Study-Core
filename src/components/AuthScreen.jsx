import { useState } from 'react'
import { login, registro, entrarInvitado } from '../api.js'

// Pantalla de acceso: menú lateral a la izquierda con las dos opciones
// (iniciar sesión / crear cuenta) y el formulario correspondiente a la derecha.
export default function AuthScreen({ onAutenticado }) {
  const [modo, setModo] = useState('login') // 'login' | 'registro'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const esRegistro = modo === 'registro'

  function cambiarModo(nuevo) {
    setModo(nuevo)
    setError(null)
    setPassword('')
    setPassword2('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (esRegistro && password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }
    setCargando(true)
    try {
      const usuario = esRegistro
        ? await registro(email.trim(), password)
        : await login(email.trim(), password)
      onAutenticado(usuario)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function entrarComoInvitado() {
    setError(null)
    setCargando(true)
    try {
      const usuario = await entrarInvitado()
      onAutenticado(usuario)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-sidebar">
        <div className="auth-marca">🧠 Study Core</div>
        <p className="auth-marca-sub">Estudio médico personal</p>
        <nav className="auth-menu">
          <button
            className={`auth-menu-item ${!esRegistro ? 'activo' : ''}`}
            onClick={() => cambiarModo('login')}
          >
            🔑 Iniciar sesión
          </button>
          <button
            className={`auth-menu-item ${esRegistro ? 'activo' : ''}`}
            onClick={() => cambiarModo('registro')}
          >
            ✨ Crear cuenta
          </button>
        </nav>
      </aside>

      <main className="auth-panel">
        <form className="auth-form" onSubmit={onSubmit}>
          <h1>{esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
          <p className="auth-form-sub">
            {esRegistro
              ? 'Registra tu correo y una contraseña. Tu cuenta tendrá su propio historial, carpetas, materias, temas y preguntas.'
              : 'Entra con una cuenta existente para ver tus datos guardados.'}
          </p>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <label className="auth-label">
            Correo
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              required
            />
          </label>

          <label className="auth-label">
            Contraseña
            <input
              type="password"
              autoComplete={esRegistro ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={esRegistro ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
              minLength={6}
              required
            />
          </label>

          {esRegistro && (
            <label className="auth-label">
              Repetir contraseña
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Vuelve a escribirla"
                minLength={6}
                required
              />
            </label>
          )}

          <button className="btn-primary" type="submit" disabled={cargando}>
            {cargando
              ? 'Procesando…'
              : esRegistro
                ? 'Crear cuenta'
                : 'Entrar'}
          </button>

          <p className="auth-cambio">
            {esRegistro ? (
              <>
                ¿Ya tienes cuenta?{' '}
                <button type="button" className="btn-link" onClick={() => cambiarModo('login')}>
                  Inicia sesión
                </button>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{' '}
                <button type="button" className="btn-link" onClick={() => cambiarModo('registro')}>
                  Crea una
                </button>
              </>
            )}
          </p>

          <div className="auth-separador">
            <span>o</span>
          </div>
          <button
            type="button"
            className="btn-ghost auth-invitado"
            onClick={entrarComoInvitado}
            disabled={cargando}
          >
            👤 Entrar como invitado
          </button>
          <p className="auth-invitado-nota">
            Sin registrarte: te asignamos un nombre y un avatar al azar. Tus datos se pierden al
            cerrar sesión.
          </p>
        </form>
      </main>
    </div>
  )
}
