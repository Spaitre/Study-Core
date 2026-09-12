import { useState, useEffect, useRef } from 'react'
import Avatar, { AVATARES, AVATARES_BLOQUEADOS } from './Avatar.jsx'
import MarcoAvatar from './MarcoAvatar.jsx'
import { MARCOS, INSIGNIAS, RAREZA_LABEL } from './cosmeticos.js'
import { actualizarPerfil, nombreDisponible, fetchProgreso, fetchMisiones, fetchEstadisticasAdmin } from '../api.js'
import { recortarCuadrado } from '../imagenes.js'

export default function CuentaScreen({ usuario, onActualizar }) {
  const [nombre, setNombre] = useState(usuario?.nombreUsuario || '')
  const [foto, setFoto] = useState(usuario?.foto || 'ajolote')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Estado del nombre: 'mismo' | 'ok' | 'ocupado' | 'invalido' | 'cargando' | null
  const [nombreEstado, setNombreEstado] = useState('mismo')
  const [cosmeticos, setCosmeticos] = useState([])
  const [marcoGuardando, setMarcoGuardando] = useState(false)
  const [misiones, setMisiones] = useState(null)
  const [statsAdmin, setStatsAdmin] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchProgreso()
      .then((p) => setCosmeticos(p.cosmeticos || []))
      .catch(() => {})
    fetchMisiones().then(setMisiones).catch(() => {})
    if (usuario?.esAdmin) fetchEstadisticasAdmin().then(setStatsAdmin).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.esAdmin])

  const avataresDesbloqueados = misiones?.avataresDesbloqueados || []
  function avatarDesbloqueado(key) {
    return !AVATARES_BLOQUEADOS.includes(key) || avataresDesbloqueados.includes(key)
  }

  async function elegirAvatar(key) {
    if (!avatarDesbloqueado(key)) return
    setFoto(key)
  }

  async function elegirMarco(clave) {
    if (marcoGuardando || clave === usuario?.marco) return
    setMarcoGuardando(true)
    setError(null)
    try {
      const perfil = await actualizarPerfil({ marco: clave })
      onActualizar(perfil)
    } catch (e) {
      setError(e.message)
    } finally {
      setMarcoGuardando(false)
    }
  }

  const subida = typeof foto === 'string' && foto.startsWith('data:')
  const original = usuario?.nombreUsuario || ''

  // Comprueba la disponibilidad del nombre mientras se escribe (con retraso).
  useEffect(() => {
    const n = nombre.trim()
    if (n === original) {
      setNombreEstado('mismo')
      return
    }
    if (n.length < 1 || n.length > 20) {
      setNombreEstado('invalido')
      return
    }
    setNombreEstado('cargando')
    let vivo = true
    const id = setTimeout(async () => {
      try {
        const r = await nombreDisponible(n)
        if (vivo) setNombreEstado(r.disponible ? 'ok' : 'ocupado')
      } catch {
        if (vivo) setNombreEstado(null)
      }
    }, 400)
    return () => {
      vivo = false
      clearTimeout(id)
    }
  }, [nombre, original])

  const nombreInvalido = nombreEstado === 'ocupado' || nombreEstado === 'invalido'

  async function elegirArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setAviso(null)
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen')
      return
    }
    try {
      const dataUrl = await recortarCuadrado(file)
      setFoto(dataUrl)
      // Guardar automáticamente la nueva foto de perfil.
      const perfil = await actualizarPerfil({ foto: dataUrl })
      onActualizar(perfil)
      setAviso('Foto de perfil actualizada ✓')
    } catch (err) {
      setError(err.message || 'No se pudo procesar la imagen')
    }
  }

  async function guardar() {
    setError(null)
    setAviso(null)
    setGuardando(true)
    try {
      const perfil = await actualizarPerfil({ nombreUsuario: nombre.trim(), foto })
      onActualizar(perfil)
      setAviso('Cambios guardados ✓')
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="screen cuenta">
      <header className="page-header">
        <h1>Cuenta</h1>
        <p className="subtitle">Personaliza tu perfil</p>
      </header>

      {error && <div className="banner-error">⚠️ {error}</div>}
      {aviso && <div className="banner-ok">{aviso}</div>}

      {usuario?.esAdmin && (
        <section className="panel">
          <h2>🛡️ Estadísticas de la app</h2>
          {!statsAdmin ? (
            <p className="cuenta-ayuda">Cargando…</p>
          ) : (
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-num">{statsAdmin.cuentasTotal}</span>
                <span className="admin-stat-label">Cuentas totales</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num">{statsAdmin.cuentasRegistradas}</span>
                <span className="admin-stat-label">Registradas</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num">{statsAdmin.cuentasInvitado}</span>
                <span className="admin-stat-label">Invitados</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num">{statsAdmin.grupos}</span>
                <span className="admin-stat-label">Grupos de estudio</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num">{statsAdmin.contenidoPublico}</span>
                <span className="admin-stat-label">Banco público</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-num">{statsAdmin.sesionesJugadas}</span>
                <span className="admin-stat-label">Sesiones jugadas</span>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="panel cuenta-resumen">
        <MarcoAvatar foto={foto} marco={usuario?.marco} size={96} />
        <div>
          <div className="cuenta-nombre-grande">{nombre || 'Usuario'}</div>
          <div className="cuenta-email">
            {usuario?.invitado ? '👤 Cuenta de invitado' : usuario?.email}
          </div>
        </div>
      </section>

      {misiones && (
        <section className="panel">
          <h2>🎯 Misiones de bienvenida</h2>
          <p className="cuenta-ayuda">
            Completa las 3 para ganar XP y desbloquear el avatar 🦊 zorro.
          </p>
          <div className="misiones-lista">
            {misiones.misiones.map((m) => (
              <div key={m.clave} className={`mision-item ${m.completada ? 'completada' : ''}`}>
                <span className="mision-check">{m.completada ? '✅' : '⬜'}</span>
                <span className="mision-texto">
                  <strong>{m.nombre}</strong>
                  <span className="cuenta-ayuda">{m.descripcion}</span>
                </span>
                <span className="mision-xp">+{m.xp} XP</span>
              </div>
            ))}
          </div>
          {misiones.avatarDesbloqueado && (
            <p className="banner-ok">🦊 ¡Ya desbloqueaste el avatar zorro!</p>
          )}
        </section>
      )}

      <section className="panel">
        <h2>Nombre de usuario</h2>
        <input
          className={`cuenta-input ${nombreInvalido ? 'campo-error' : ''}`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="tu_nombre"
          maxLength={20}
        />
        {nombreEstado === 'ocupado' && (
          <p className="nombre-estado error">⚠️ Ese nombre de usuario ya existe</p>
        )}
        {nombreEstado === 'invalido' && (
          <p className="nombre-estado error">El nombre debe tener entre 1 y 20 caracteres</p>
        )}
        <p className="cuenta-ayuda">
          De 1 a 20 caracteres. Otros usuarios podrán agregarte con este nombre.
        </p>
      </section>

      <section className="panel">
        <h2>Foto de perfil</h2>
        <p className="cuenta-ayuda">
          Ajolote, zorro, búho, rana y pingüino se desbloquean completando misiones.
        </p>
        <div className="avatar-grid">
          {AVATARES.map((a) => {
            const desbloqueado = avatarDesbloqueado(a.key)
            return (
              <button
                key={a.key}
                className={`avatar-opcion ${foto === a.key ? 'activo' : ''} ${desbloqueado ? '' : 'bloqueado'}`}
                onClick={() => elegirAvatar(a.key)}
                title={desbloqueado ? a.label : `${a.label} (bloqueado)`}
              >
                <Avatar foto={a.key} size={64} />
                <span>{desbloqueado ? a.label : '🔒'}</span>
              </button>
            )
          })}

          <button
            className={`avatar-opcion avatar-subir ${subida ? 'activo' : ''}`}
            onClick={() => fileRef.current?.click()}
            title="Subir imagen"
          >
            <span className="avatar-subir-icono">⬆️</span>
            <span>Subir imagen</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={elegirArchivo}
          />
        </div>
      </section>

      <section className="panel">
        <h2>Marco de avatar</h2>
        <p className="cuenta-ayuda">
          Se desbloquean al azar en las cajas de regalo por mantener tu racha de estudio.
        </p>
        <div className="cosmeticos-grid">
          <button
            className={`cosmetico-opcion ${!usuario?.marco ? 'activo' : ''}`}
            onClick={() => elegirMarco(null)}
            disabled={marcoGuardando}
          >
            <MarcoAvatar foto={foto} marco={null} size={56} />
            <span>Ninguno</span>
          </button>
          {MARCOS.map((m) => {
            const desbloqueado = cosmeticos.includes(m.clave)
            return (
              <button
                key={m.clave}
                className={`cosmetico-opcion ${usuario?.marco === m.clave ? 'activo' : ''} ${
                  desbloqueado ? '' : 'bloqueado'
                }`}
                onClick={() => desbloqueado && elegirMarco(m.clave)}
                disabled={marcoGuardando || !desbloqueado}
                title={desbloqueado ? m.nombre : `${m.nombre} (bloqueado)`}
              >
                <MarcoAvatar foto={foto} marco={m.clave} size={56} />
                <span>{desbloqueado ? m.nombre : '🔒'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Insignias</h2>
        <p className="cuenta-ayuda">Tu colección de insignias ganadas en cajas de regalo.</p>
        <div className="cosmeticos-grid">
          {INSIGNIAS.map((i) => {
            const desbloqueada = cosmeticos.includes(i.clave)
            return (
              <div
                key={i.clave}
                className={`cosmetico-opcion insignia-opcion ${desbloqueada ? '' : 'bloqueado'}`}
                title={desbloqueada ? `${i.nombre} · ${RAREZA_LABEL[i.rareza]}` : 'Insignia bloqueada'}
              >
                <span className="insignia-icono">{desbloqueada ? i.icono : '❔'}</span>
                <span>{desbloqueada ? i.nombre : '???'}</span>
              </div>
            )
          })}
        </div>
      </section>

      <button
        className="btn-primary"
        onClick={guardar}
        disabled={guardando || nombreInvalido || nombreEstado === 'cargando'}
      >
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
