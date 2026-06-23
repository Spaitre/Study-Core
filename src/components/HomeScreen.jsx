import { useState, useEffect, useRef } from 'react'
import ImportarPreguntasModal from './ImportarPreguntasModal.jsx'
import GestionPreguntasModal from './GestionPreguntasModal.jsx'
import { exportarMateria as apiExportarMateria, exportarCarpeta as apiExportarCarpeta } from '../api.js'

// Descarga un objeto como archivo JSON.
function descargarJSON(nombreArchivo, datos) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

// Nombre de archivo seguro a partir de un texto.
function nombreArchivo(texto, sufijo) {
  const base = String(texto || 'export').replace(/[^a-z0-9áéíóúñ ]/gi, '').trim() || 'export'
  return `${base}${sufijo}.json`
}

// Clave de localStorage para recordar el tiempo elegido entre sesiones.
const STORAGE_TIEMPO = 'cerebro:tiempoPorPregunta'

function leerTiempoGuardado() {
  const guardado = localStorage.getItem(STORAGE_TIEMPO)
  if (guardado === null) return 30
  return guardado === 'null' ? null : Number(guardado)
}

export default function HomeScreen({
  materias,
  carpetas,
  onIniciar,
  onVerStats,
  ocultarEncabezado = false,
  onCrearMateria,
  onCrearTema,
  onReordenarMaterias,
  onEliminarMateria,
  onEliminarTema,
  onEditarMateria,
  onEditarTema,
  onActualizarConteoTema,
  onCrearCarpeta,
  onEditarCarpeta,
  onEliminarCarpeta,
  onReordenarCarpetas,
  onImportarMaterias,
  onImportarCarpeta,
}) {
  const [carpetaId, setCarpetaId] = useState(carpetas[0]?.id ?? null)
  const [materiaId, setMateriaId] = useState(null)
  const [temasSel, setTemasSel] = useState([])
  const [tiempo, setTiempo] = useState(leerTiempoGuardado)

  // Formularios de creación.
  const [formCarpeta, setFormCarpeta] = useState(false)
  const [nombreCarpeta, setNombreCarpeta] = useState('')
  const [formMateria, setFormMateria] = useState(false)
  const [nombreMateria, setNombreMateria] = useState('')
  const [iconoMateria, setIconoMateria] = useState('')
  const [formTema, setFormTema] = useState(false)
  const [nombreTema, setNombreTema] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [mensajeImport, setMensajeImport] = useState(null)
  const [modalExport, setModalExport] = useState(null) // materias: null | array de ids
  const [modalExportCarp, setModalExportCarp] = useState(null) // carpetas: null | array de ids
  const importRef = useRef(null)
  const importCarpetaRef = useRef(null)

  // Edición inline.
  const [editCarpetaId, setEditCarpetaId] = useState(null)
  const [editNombreCarpeta, setEditNombreCarpeta] = useState('')
  const [editMateriaId, setEditMateriaId] = useState(null)
  const [editNombreMateria, setEditNombreMateria] = useState('')
  const [editIconoMateria, setEditIconoMateria] = useState('')
  const [editTemaId, setEditTemaId] = useState(null)
  const [editNombreTema, setEditNombreTema] = useState('')

  // Arrastre para reordenar (materias y carpetas).
  const [arrastrandoId, setArrastrandoId] = useState(null)
  const [sobreId, setSobreId] = useState(null)
  const [dragCarpeta, setDragCarpeta] = useState(null)
  const [sobreCarpeta, setSobreCarpeta] = useState(null)

  const [confirmar, setConfirmar] = useState(null)
  const [importarTema, setImportarTema] = useState(null)
  // Modal de gestión de preguntas: { tema, modo } o null.
  const [gestion, setGestion] = useState(null)

  // Materias de la carpeta seleccionada.
  const materiasCarpeta = materias.filter((m) => m.carpetaId === carpetaId)

  // Al cambiar de carpeta (o si cambian las materias), ajusta la materia activa.
  useEffect(() => {
    const lista = materias.filter((m) => m.carpetaId === carpetaId)
    setMateriaId((cur) =>
      lista.some((m) => m.id === cur) ? cur : (lista[0]?.id ?? null),
    )
    setFormMateria(false)
    setFormTema(false)
  }, [carpetaId, materias])

  // Al cambiar de materia, selecciona todos sus temas por defecto.
  useEffect(() => {
    const m = materias.find((x) => x.id === materiaId)
    setTemasSel((m?.temas ?? []).map((t) => t.id))
    setFormTema(false)
    setNombreTema('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaId])

  useEffect(() => {
    localStorage.setItem(STORAGE_TIEMPO, String(tiempo))
  }, [tiempo])

  const OPCIONES_TIEMPO = [
    { valor: 30, etiqueta: '30 segundos', icono: '⏱️' },
    { valor: 60, etiqueta: '1 minuto', icono: '🕐' },
    { valor: null, etiqueta: 'Sin tiempo', icono: '∞' },
  ]

  const materia = materias.find((m) => m.id === materiaId)

  // ---------- Carpetas ----------
  async function guardarCarpeta() {
    if (!nombreCarpeta.trim()) return
    setGuardando(true)
    setErrorForm(null)
    try {
      const nueva = await onCrearCarpeta(nombreCarpeta)
      setCarpetaId(nueva.id)
      setNombreCarpeta('')
      setFormCarpeta(false)
    } catch (e) {
      setErrorForm(e.message)
    } finally {
      setGuardando(false)
    }
  }
  async function guardarEdicionCarpeta() {
    if (!editNombreCarpeta.trim()) return
    setGuardando(true)
    try {
      await onEditarCarpeta(editCarpetaId, editNombreCarpeta)
      setEditCarpetaId(null)
    } catch (e) {
      setErrorForm(e.message)
    } finally {
      setGuardando(false)
    }
  }
  function eliminarCarpeta(e, c) {
    e.stopPropagation()
    setConfirmar({
      titulo: 'Eliminar carpeta',
      mensaje: `¿Seguro que deseas eliminar la carpeta "${c.nombre}"? Se borrarán también sus ${c.materias} materia(s) y todo su contenido. Esta acción no se puede deshacer.`,
      onSi: async () => {
        try {
          await onEliminarCarpeta(c.id)
          if (carpetaId === c.id) {
            const resto = carpetas.filter((x) => x.id !== c.id)
            setCarpetaId(resto[0]?.id ?? null)
          }
        } catch (err) {
          setErrorForm(err.message)
        }
      },
    })
  }
  function soltarCarpeta(destinoId) {
    if (!dragCarpeta || dragCarpeta === destinoId) return
    const lista = [...carpetas]
    const desde = lista.findIndex((c) => c.id === dragCarpeta)
    const hasta = lista.findIndex((c) => c.id === destinoId)
    if (desde === -1 || hasta === -1) return
    const [movida] = lista.splice(desde, 1)
    lista.splice(hasta, 0, movida)
    onReordenarCarpetas(lista)
  }

  // ---------- Materias ----------
  async function guardarMateria() {
    if (!nombreMateria.trim() || !carpetaId) return
    setGuardando(true)
    setErrorForm(null)
    try {
      const nueva = await onCrearMateria(nombreMateria, iconoMateria, carpetaId)
      setMateriaId(nueva.id)
      setNombreMateria('')
      setIconoMateria('')
      setFormMateria(false)
    } catch (e) {
      setErrorForm(e.message)
    } finally {
      setGuardando(false)
    }
  }
  // Importa materias (con temas y preguntas) desde un archivo JSON a la carpeta activa.
  async function importarMateriasArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-elegir el mismo archivo
    if (!file) return
    setMensajeImport(null)
    setErrorForm(null)
    if (!carpetaId) {
      setErrorForm('Primero elige una carpeta donde importar.')
      return
    }
    try {
      const datos = JSON.parse(await file.text())
      const r = await onImportarMaterias(carpetaId, datos)
      setMensajeImport(
        `Importado: ${r.materias} materia(s), ${r.temas} tema(s), ${r.preguntas} pregunta(s).`,
      )
    } catch (err) {
      setErrorForm(
        err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message,
      )
    }
  }
  // Importa una carpeta nueva (con sus materias) desde un archivo JSON.
  async function importarCarpetaArchivo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMensajeImport(null)
    setErrorForm(null)
    try {
      const datos = JSON.parse(await file.text())
      const r = await onImportarCarpeta(datos)
      const creadas = r.carpetas || []
      if (creadas[0]) setCarpetaId(creadas[0].id)
      setMensajeImport(
        `${creadas.length} carpeta(s) importada(s): ${r.materias} materia(s), ${r.temas} tema(s), ${r.preguntas} pregunta(s).`,
      )
    } catch (err) {
      setErrorForm(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message)
    }
  }
  // Exporta varias carpetas seleccionadas en un solo archivo JSON.
  function toggleExportCarp(id) {
    setModalExportCarp((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  async function confirmarExportCarpetas() {
    const ids = modalExportCarp
    if (!ids || ids.length === 0) return
    setErrorForm(null)
    try {
      const partes = await Promise.all(ids.map((id) => apiExportarCarpeta(id)))
      const c0 = carpetas.find((x) => x.id === ids[0])
      const fname = ids.length === 1 ? nombreArchivo(c0?.nombre, '-carpeta') : 'carpetas-export.json'
      descargarJSON(fname, { carpetas: partes })
      setModalExportCarp(null)
    } catch (err) {
      setErrorForm(err.message)
      setModalExportCarp(null)
    }
  }
  // Exporta una materia (con sus temas y preguntas) a un archivo JSON.
  async function exportarMateriaPorId(id, nombre) {
    setErrorForm(null)
    try {
      const datos = await apiExportarMateria(id)
      descargarJSON(nombreArchivo(nombre, ''), datos)
    } catch (err) {
      setErrorForm(err.message)
    }
  }
  function exportarMateriaArchivo(e, m) {
    e.stopPropagation()
    exportarMateriaPorId(m.id, m.nombre)
  }
  // Exporta varias materias seleccionadas en un solo archivo JSON.
  function toggleExport(id) {
    setModalExport((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  async function confirmarExportMaterias() {
    const ids = modalExport
    if (!ids || ids.length === 0) return
    setErrorForm(null)
    try {
      const partes = await Promise.all(ids.map((id) => apiExportarMateria(id)))
      const materias = partes.flatMap((p) => p.materias)
      const c = carpetas.find((x) => x.id === carpetaId)
      descargarJSON(nombreArchivo(c?.nombre || 'materias', '-materias'), { materias })
      setModalExport(null)
    } catch (err) {
      setErrorForm(err.message)
      setModalExport(null)
    }
  }
  function abrirEditarMateria(e, m) {
    e.stopPropagation()
    setEditMateriaId(m.id)
    setEditNombreMateria(m.nombre)
    setEditIconoMateria(m.icono ?? '')
    setErrorForm(null)
  }
  async function guardarEdicionMateria() {
    if (!editNombreMateria.trim()) return
    setGuardando(true)
    try {
      await onEditarMateria(editMateriaId, editNombreMateria, editIconoMateria)
      setEditMateriaId(null)
    } catch (err) {
      setErrorForm(err.message)
    } finally {
      setGuardando(false)
    }
  }
  function eliminarMateria(e, m) {
    e.stopPropagation()
    setConfirmar({
      titulo: 'Eliminar materia',
      mensaje: `¿Seguro que deseas eliminar la materia "${m.nombre}"? Se borrarán también sus ${m.temas.length} tema(s) y todas sus preguntas.`,
      onSi: async () => {
        try {
          await onEliminarMateria(m.id)
        } catch (err) {
          setErrorForm(err.message)
        }
      },
    })
  }
  function seleccionarMateria(id) {
    setMateriaId(id)
  }
  function alSoltar(destinoId) {
    if (!arrastrandoId || arrastrandoId === destinoId) return
    const lista = [...materiasCarpeta]
    const desde = lista.findIndex((m) => m.id === arrastrandoId)
    const hasta = lista.findIndex((m) => m.id === destinoId)
    if (desde === -1 || hasta === -1) return
    const [movida] = lista.splice(desde, 1)
    lista.splice(hasta, 0, movida)
    // Reconstruye el arreglo completo rellenando los huecos de esta carpeta.
    let k = 0
    const nuevoFull = materias.map((m) =>
      m.carpetaId === carpetaId ? lista[k++] : m,
    )
    onReordenarMaterias(nuevoFull)
  }

  // ---------- Temas ----------
  async function guardarTema() {
    if (!nombreTema.trim() || !materiaId) return
    setGuardando(true)
    setErrorForm(null)
    try {
      const nuevo = await onCrearTema(materiaId, nombreTema)
      setTemasSel((prev) => [...prev, nuevo.id])
      setNombreTema('')
      setFormTema(false)
    } catch (e) {
      setErrorForm(e.message)
    } finally {
      setGuardando(false)
    }
  }
  function abrirEditarTema(e, t) {
    e.preventDefault()
    e.stopPropagation()
    setEditTemaId(t.id)
    setEditNombreTema(t.nombre)
    setErrorForm(null)
  }
  async function guardarEdicionTema() {
    if (!editNombreTema.trim()) return
    setGuardando(true)
    try {
      await onEditarTema(materiaId, editTemaId, editNombreTema)
      setEditTemaId(null)
    } catch (err) {
      setErrorForm(err.message)
    } finally {
      setGuardando(false)
    }
  }
  function eliminarTema(e, t) {
    e.preventDefault()
    e.stopPropagation()
    setConfirmar({
      titulo: 'Eliminar tema',
      mensaje: `¿Seguro que deseas eliminar el tema "${t.nombre}" y sus ${t.preguntas} pregunta(s)?`,
      onSi: async () => {
        try {
          await onEliminarTema(materiaId, t.id)
          setTemasSel((prev) => prev.filter((id) => id !== t.id))
        } catch (err) {
          setErrorForm(err.message)
        }
      },
    })
  }
  function toggleTema(temaId) {
    setTemasSel((prev) =>
      prev.includes(temaId)
        ? prev.filter((id) => id !== temaId)
        : [...prev, temaId],
    )
  }

  const totalPreguntas = (materia?.temas ?? [])
    .filter((t) => temasSel.includes(t.id))
    .reduce((acc, t) => acc + t.preguntas, 0)
  const puedeIniciar = temasSel.length > 0 && totalPreguntas > 0

  return (
    <div className="screen home">
      {!ocultarEncabezado && (
        <header className="home-header">
          <h1>🧠 Study Core</h1>
          <p className="subtitle">Estudio médico personal</p>
          <button className="btn-ghost" onClick={onVerStats}>
            📊 Ver mi historial
          </button>
        </header>
      )}

      {/* ---------- Carpetas ---------- */}
      <section className="panel">
        <div className="materias-cab">
          <h2>Carpetas</h2>
          <div className="materias-cab-acciones">
            <button
              className="btn-importar-materia"
              onClick={() => setModalExportCarp(carpetaId ? [carpetaId] : [])}
              disabled={carpetas.length === 0}
              title="Exportar una o varias carpetas a un archivo JSON"
            >
              ⬇️ Exportar carpetas
            </button>
            <button
              className="btn-importar-materia"
              onClick={() => importCarpetaRef.current?.click()}
              title="Importar una carpeta (con sus materias) desde un archivo JSON"
            >
              ⬆️ Importar carpeta
            </button>
          </div>
          <input
            ref={importCarpetaRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importarCarpetaArchivo}
          />
        </div>
        <div className={`carpeta-grid${carpetas.length + 1 > 8 ? ' scrollable' : ''}`}>
          {formCarpeta ? (
            <div className="carpeta-card form-card">
              <input
                className="form-input"
                value={nombreCarpeta}
                onChange={(e) => setNombreCarpeta(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && guardarCarpeta()}
                placeholder="Nombre de la carpeta"
                autoFocus
              />
              <div className="form-acciones">
                <button
                  className="btn-mini"
                  onClick={() => {
                    setFormCarpeta(false)
                    setNombreCarpeta('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-mini primary"
                  onClick={guardarCarpeta}
                  disabled={!nombreCarpeta.trim() || guardando}
                >
                  Crear
                </button>
              </div>
            </div>
          ) : (
            <button
              className="carpeta-card agregar"
              onClick={() => {
                setFormCarpeta(true)
                setErrorForm(null)
              }}
            >
              ＋ Nueva carpeta
            </button>
          )}

          {carpetas.map((c) =>
            editCarpetaId === c.id ? (
              <div key={c.id} className="carpeta-card form-card">
                <input
                  className="form-input"
                  value={editNombreCarpeta}
                  onChange={(e) => setEditNombreCarpeta(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEdicionCarpeta()}
                  autoFocus
                />
                <div className="form-acciones">
                  <button className="btn-mini" onClick={() => setEditCarpetaId(null)}>
                    Cancelar
                  </button>
                  <button
                    className="btn-mini primary"
                    onClick={guardarEdicionCarpeta}
                    disabled={!editNombreCarpeta.trim() || guardando}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={() => setDragCarpeta(c.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (sobreCarpeta !== c.id) setSobreCarpeta(c.id)
                }}
                onDrop={() => {
                  soltarCarpeta(c.id)
                  setDragCarpeta(null)
                  setSobreCarpeta(null)
                }}
                onDragEnd={() => {
                  setDragCarpeta(null)
                  setSobreCarpeta(null)
                }}
                className={`carpeta-card${c.id === carpetaId ? ' active' : ''}${
                  dragCarpeta === c.id ? ' arrastrando' : ''
                }${sobreCarpeta === c.id && dragCarpeta !== c.id ? ' sobre' : ''}`}
                onClick={() => setCarpetaId(c.id)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && setCarpetaId(c.id)
                }
                title="Arrastra para reordenar"
              >
                <button
                  className="btn-editar"
                  title="Renombrar carpeta"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditCarpetaId(c.id)
                    setEditNombreCarpeta(c.nombre)
                  }}
                >
                  ✏️
                </button>
                <button
                  className="btn-eliminar"
                  title="Eliminar carpeta"
                  onClick={(e) => eliminarCarpeta(e, c)}
                >
                  ✕
                </button>
                <span className="carpeta-icono">📁</span>
                <span className="carpeta-nombre">{c.nombre}</span>
                <span className="carpeta-meta">{c.materias} materias</span>
              </div>
            ),
          )}
        </div>
      </section>

      {/* ---------- Materias ---------- */}
      <section className="panel">
        <div className="materias-cab">
          <h2>1. Elige una materia</h2>
          <div className="materias-cab-acciones">
            <button
              className="btn-importar-materia"
              onClick={() => setModalExport(materiaId ? [materiaId] : [])}
              disabled={materiasCarpeta.length === 0}
              title="Exportar una o varias materias a un archivo JSON"
            >
              ⬇️ Exportar materias
            </button>
            <button
              className="btn-importar-materia"
              onClick={() => {
                if (!carpetaId) {
                  setErrorForm('Primero elige una carpeta donde importar.')
                  return
                }
                importRef.current?.click()
              }}
              title="Importar materias (con temas y preguntas) desde un archivo JSON"
            >
              ⬆️ Importar materias
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importarMateriasArchivo}
          />
        </div>
        {mensajeImport && <div className="banner-ok">{mensajeImport}</div>}
        <div
          className={`materia-grid${
            materiasCarpeta.length + 1 > 8 ? ' scrollable' : ''
          }`}
        >
          {formMateria ? (
            <div className="materia-card form-card">
              <input
                className="form-input"
                value={iconoMateria}
                onChange={(e) => setIconoMateria(e.target.value)}
                placeholder="Emoji"
                maxLength={2}
              />
              <input
                className="form-input"
                value={nombreMateria}
                onChange={(e) => setNombreMateria(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && guardarMateria()}
                placeholder="Nombre de la materia"
                autoFocus
              />
              <div className="form-acciones">
                <button
                  className="btn-mini"
                  onClick={() => {
                    setFormMateria(false)
                    setNombreMateria('')
                    setIconoMateria('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-mini primary"
                  onClick={guardarMateria}
                  disabled={!nombreMateria.trim() || guardando}
                >
                  Crear
                </button>
              </div>
            </div>
          ) : (
            <button
              className="materia-card agregar"
              onClick={() => {
                if (!carpetaId) {
                  setErrorForm('Primero crea o elige una carpeta.')
                  return
                }
                setFormMateria(true)
                setErrorForm(null)
              }}
            >
              <span className="materia-icono">＋</span>
              <span className="materia-nombre">Nueva materia</span>
            </button>
          )}

          {materiasCarpeta.map((m) =>
            editMateriaId === m.id ? (
              <div key={m.id} className="materia-card form-card">
                <input
                  className="form-input"
                  value={editIconoMateria}
                  onChange={(e) => setEditIconoMateria(e.target.value)}
                  placeholder="Emoji"
                  maxLength={2}
                />
                <input
                  className="form-input"
                  value={editNombreMateria}
                  onChange={(e) => setEditNombreMateria(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEdicionMateria()}
                  autoFocus
                />
                <div className="form-acciones">
                  <button className="btn-mini" onClick={() => setEditMateriaId(null)}>
                    Cancelar
                  </button>
                  <button
                    className="btn-mini primary"
                    onClick={guardarEdicionMateria}
                    disabled={!editNombreMateria.trim() || guardando}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={() => setArrastrandoId(m.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (sobreId !== m.id) setSobreId(m.id)
                }}
                onDrop={() => {
                  alSoltar(m.id)
                  setArrastrandoId(null)
                  setSobreId(null)
                }}
                onDragEnd={() => {
                  setArrastrandoId(null)
                  setSobreId(null)
                }}
                className={`materia-card${m.id === materiaId ? ' active' : ''}${
                  arrastrandoId === m.id ? ' arrastrando' : ''
                }${sobreId === m.id && arrastrandoId !== m.id ? ' sobre' : ''}`}
                onClick={() => seleccionarMateria(m.id)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && seleccionarMateria(m.id)
                }
                title="Arrastra para reordenar"
              >
                <button
                  className="btn-editar"
                  title="Renombrar / cambiar emoji"
                  onClick={(e) => abrirEditarMateria(e, m)}
                >
                  ✏️
                </button>
                <button
                  className="btn-eliminar"
                  title="Eliminar materia"
                  onClick={(e) => eliminarMateria(e, m)}
                >
                  ✕
                </button>
                <button
                  className="btn-exportar"
                  title="Exportar materia (con temas y preguntas)"
                  onClick={(e) => exportarMateriaArchivo(e, m)}
                >
                  ⬇️
                </button>
                <span className="materia-icono">{m.icono ?? '📚'}</span>
                <span className="materia-nombre">{m.nombre}</span>
                <span className="materia-meta">{m.temas.length} temas</span>
              </div>
            ),
          )}
        </div>
        {errorForm && (formMateria || formCarpeta || !carpetaId) && (
          <p className="form-error">⚠️ {errorForm}</p>
        )}
      </section>

      {/* ---------- Temas ---------- */}
      <section className="panel">
        <h2>2. Selecciona los temas</h2>
        <div
          className={`tema-list${
            (materia?.temas?.length ?? 0) > 5 ? ' scrollable' : ''
          }`}
        >
          {(materia?.temas ?? []).map((t) =>
            editTemaId === t.id ? (
              <div key={t.id} className="tema-item form-tema">
                <input
                  className="form-input"
                  value={editNombreTema}
                  onChange={(e) => setEditNombreTema(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEdicionTema()}
                  autoFocus
                />
                <button
                  className="btn-mini primary"
                  onClick={guardarEdicionTema}
                  disabled={!editNombreTema.trim() || guardando}
                >
                  Guardar
                </button>
                <button className="btn-mini" onClick={() => setEditTemaId(null)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div key={t.id} className="tema-bloque">
                <label
                  className={`tema-item ${temasSel.includes(t.id) ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={temasSel.includes(t.id)}
                    onChange={() => toggleTema(t.id)}
                  />
                  <span className="tema-nombre">{t.nombre}</span>
                  <span className="tema-meta">{t.preguntas} preguntas</span>
                  <button
                    className="btn-editar"
                    title="Renombrar tema"
                    onClick={(e) => abrirEditarTema(e, t)}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-importar"
                    title="Importar preguntas desde un archivo"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setImportarTema(t)
                    }}
                  >
                    📥
                  </button>
                  <button
                    className="btn-eliminar"
                    title="Eliminar tema"
                    onClick={(e) => eliminarTema(e, t)}
                  >
                    ✕
                  </button>
                </label>
                {/* Barra de gestión de preguntas (debajo del nombre del tema) */}
                <div className="tema-preg-toolbar">
                  <button
                    className="btn-preg"
                    onClick={() => setGestion({ tema: t, modo: 'nueva' })}
                  >
                    ➕ Agregar pregunta
                  </button>
                  <button
                    className="btn-preg"
                    onClick={() => setGestion({ tema: t, modo: 'lista' })}
                  >
                    📝 Gestionar ({t.preguntas})
                  </button>
                </div>
              </div>
            ),
          )}

          {materia &&
            (formTema ? (
              <div className="tema-item form-tema">
                <input
                  className="form-input"
                  value={nombreTema}
                  onChange={(e) => setNombreTema(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarTema()}
                  placeholder={`Nuevo tema en ${materia.nombre}`}
                  autoFocus
                />
                <button
                  className="btn-mini primary"
                  onClick={guardarTema}
                  disabled={!nombreTema.trim() || guardando}
                >
                  Crear
                </button>
                <button
                  className="btn-mini"
                  onClick={() => {
                    setFormTema(false)
                    setNombreTema('')
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                className="tema-item agregar"
                onClick={() => {
                  setFormTema(true)
                  setErrorForm(null)
                }}
              >
                ＋ Nuevo tema
              </button>
            ))}
        </div>
        {errorForm && formTema && <p className="form-error">⚠️ {errorForm}</p>}
      </section>

      {/* ---------- Tiempo ---------- */}
      <section className="panel">
        <h2>3. Tiempo por pregunta</h2>
        <div className="tiempo-grid">
          {OPCIONES_TIEMPO.map((op) => (
            <button
              key={op.etiqueta}
              className={`tiempo-card ${tiempo === op.valor ? 'active' : ''}`}
              onClick={() => setTiempo(op.valor)}
            >
              <span className="tiempo-icono">{op.icono}</span>
              <span className="tiempo-etiqueta">{op.etiqueta}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <span className="resumen">
          {totalPreguntas} pregunta{totalPreguntas === 1 ? '' : 's'} ·{' '}
          {tiempo === null ? 'sin tiempo' : `${tiempo}s c/u`}
        </span>
        <button
          className="btn-primary"
          disabled={!puedeIniciar}
          onClick={() => onIniciar(materia, temasSel, tiempo)}
        >
          Comenzar quiz →
        </button>
      </footer>

      {/* Modal: elegir cuántas materias exportar */}
      {modalExport !== null && (
        <div className="modal-overlay" onClick={() => setModalExport(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">Exportar materias</h3>
            <p className="modal-mensaje">
              Elige cuáles materias exportar a un archivo JSON.
            </p>
            <div className="export-todas">
              <button
                className="btn-mini"
                onClick={() => setModalExport(materiasCarpeta.map((m) => m.id))}
              >
                Todas
              </button>
              <button className="btn-mini" onClick={() => setModalExport([])}>
                Ninguna
              </button>
            </div>
            <div className="export-lista">
              {materiasCarpeta.length === 0 ? (
                <p className="vacio">Esta carpeta no tiene materias.</p>
              ) : (
                materiasCarpeta.map((m) => (
                  <label
                    key={m.id}
                    className={`amigo-check ${modalExport.includes(m.id) ? 'activo' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={modalExport.includes(m.id)}
                      onChange={() => toggleExport(m.id)}
                    />
                    <span>
                      {m.icono ?? '📚'} {m.nombre} ({m.temas.length} temas)
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="modal-acciones">
              <button className="btn-mini" onClick={() => setModalExport(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarExportMaterias}
                disabled={modalExport.length === 0}
              >
                Exportar ({modalExport.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: elegir cuántas carpetas exportar */}
      {modalExportCarp !== null && (
        <div className="modal-overlay" onClick={() => setModalExportCarp(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">Exportar carpetas</h3>
            <p className="modal-mensaje">
              Elige cuáles carpetas exportar (con todas sus materias) a un archivo JSON.
            </p>
            <div className="export-todas">
              <button
                className="btn-mini"
                onClick={() => setModalExportCarp(carpetas.map((c) => c.id))}
              >
                Todas
              </button>
              <button className="btn-mini" onClick={() => setModalExportCarp([])}>
                Ninguna
              </button>
            </div>
            <div className="export-lista">
              {carpetas.length === 0 ? (
                <p className="vacio">No hay carpetas.</p>
              ) : (
                carpetas.map((c) => (
                  <label
                    key={c.id}
                    className={`amigo-check ${modalExportCarp.includes(c.id) ? 'activo' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={modalExportCarp.includes(c.id)}
                      onChange={() => toggleExportCarp(c.id)}
                    />
                    <span>
                      📁 {c.nombre} ({c.materias} materias)
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="modal-acciones">
              <button className="btn-mini" onClick={() => setModalExportCarp(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmarExportCarpetas}
                disabled={modalExportCarp.length === 0}
              >
                Exportar ({modalExportCarp.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de borrado */}
      {confirmar && (
        <div className="modal-overlay" onClick={() => setConfirmar(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-titulo">{confirmar.titulo}</h3>
            <p className="modal-mensaje">{confirmar.mensaje}</p>
            <div className="modal-acciones">
              <button className="btn-mini" onClick={() => setConfirmar(null)}>
                Cancelar
              </button>
              <button
                className="btn-peligro"
                onClick={() => {
                  const fn = confirmar.onSi
                  setConfirmar(null)
                  fn()
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {importarTema && (
        <ImportarPreguntasModal
          tema={importarTema}
          onCerrar={() => setImportarTema(null)}
          onImportado={(total) =>
            onActualizarConteoTema(materiaId, importarTema.id, total)
          }
        />
      )}

      {gestion && (
        <GestionPreguntasModal
          tema={gestion.tema}
          modoInicial={gestion.modo}
          onCerrar={() => setGestion(null)}
          onCambio={(total) =>
            onActualizarConteoTema(materiaId, gestion.tema.id, total)
          }
        />
      )}
    </div>
  )
}
