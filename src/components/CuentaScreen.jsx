import { useState, useEffect, useRef } from 'react'
import Avatar, { AVATARES } from './Avatar.jsx'
import { actualizarPerfil, nombreDisponible } from '../api.js'

// Reduce la imagen subida a 256x256 (recorte centrado) y la devuelve como
// data URL JPEG, para guardar algo ligero en la base.
function archivoADataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function CuentaScreen({ usuario, onActualizar }) {
  const [nombre, setNombre] = useState(usuario?.nombreUsuario || '')
  const [foto, setFoto] = useState(usuario?.foto || 'ajolote')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // Estado del nombre: 'mismo' | 'ok' | 'ocupado' | 'invalido' | 'cargando' | null
  const [nombreEstado, setNombreEstado] = useState('mismo')
  const fileRef = useRef(null)

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
      const dataUrl = await archivoADataUrl(file)
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

      <section className="panel cuenta-resumen">
        <Avatar foto={foto} size={96} />
        <div>
          <div className="cuenta-nombre-grande">{nombre || 'Usuario'}</div>
          <div className="cuenta-email">
            {usuario?.invitado ? '👤 Cuenta de invitado' : usuario?.email}
          </div>
        </div>
      </section>

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
        <div className="avatar-grid">
          {AVATARES.map((a) => (
            <button
              key={a.key}
              className={`avatar-opcion ${foto === a.key ? 'activo' : ''}`}
              onClick={() => setFoto(a.key)}
              title={a.label}
            >
              <Avatar foto={a.key} size={64} />
              <span>{a.label}</span>
            </button>
          ))}

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
