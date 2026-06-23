import { useState, useEffect, useCallback } from 'react'
import {
  fetchMaterias,
  fetchCarpetas,
  crearMateria,
  crearTema,
  reordenarMaterias,
  eliminarMateria,
  eliminarTema,
  editarMateria,
  editarTema,
  crearCarpeta,
  editarCarpeta,
  eliminarCarpeta,
  reordenarCarpetas,
  importarMateriasACarpeta,
  importarCarpeta,
} from './api.js'

// Maneja el catálogo (carpetas + materias + temas) y su CRUD para un contexto:
// personal (proyectoId = null) o un proyecto (proyectoId = N). La misma lógica
// sirve para la pantalla de inicio y para la pantalla de cada proyecto.
export default function useContenido(proyectoId = null, activo = true) {
  const [carpetas, setCarpetas] = useState([])
  const [materias, setMaterias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const recargar = useCallback(() => {
    setCargando(true)
    return Promise.all([fetchCarpetas(proyectoId), fetchMaterias(proyectoId)])
      .then(([c, m]) => {
        setCarpetas(c)
        setMaterias(m)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [proyectoId])

  useEffect(() => {
    if (!activo) return
    recargar()
  }, [activo, recargar])

  // ----- Materias -----
  async function onCrearMateria(nombre, icono, carpetaId) {
    const nueva = await crearMateria(nombre, icono, carpetaId, proyectoId)
    setMaterias((prev) => [...prev, nueva])
    setCarpetas((prev) =>
      prev.map((c) => (c.id === carpetaId ? { ...c, materias: (c.materias || 0) + 1 } : c)),
    )
    return nueva
  }
  async function onEliminarMateria(id) {
    await eliminarMateria(id)
    const carpetaId = materias.find((m) => m.id === id)?.carpetaId
    setMaterias((prev) => prev.filter((m) => m.id !== id))
    if (carpetaId) {
      setCarpetas((prev) =>
        prev.map((c) =>
          c.id === carpetaId ? { ...c, materias: Math.max(0, (c.materias || 0) - 1) } : c,
        ),
      )
    }
  }
  async function onEditarMateria(id, nombre, icono) {
    const m = await editarMateria(id, nombre, icono)
    setMaterias((prev) =>
      prev.map((x) => (x.id === id ? { ...x, nombre: m.nombre, icono: m.icono } : x)),
    )
  }
  function onReordenarMaterias(nuevas) {
    setMaterias(nuevas)
    reordenarMaterias(nuevas.map((m) => m.id)).catch((e) =>
      console.error('No se pudo guardar el orden:', e),
    )
  }

  // ----- Temas -----
  async function onCrearTema(materiaId, nombre) {
    const nuevo = await crearTema(materiaId, nombre)
    setMaterias((prev) =>
      prev.map((m) => (m.id === materiaId ? { ...m, temas: [...m.temas, nuevo] } : m)),
    )
    return nuevo
  }
  async function onEliminarTema(materiaId, temaId) {
    await eliminarTema(temaId)
    setMaterias((prev) =>
      prev.map((m) =>
        m.id === materiaId ? { ...m, temas: m.temas.filter((t) => t.id !== temaId) } : m,
      ),
    )
  }
  async function onEditarTema(materiaId, temaId, nombre) {
    const t = await editarTema(temaId, nombre)
    setMaterias((prev) =>
      prev.map((m) =>
        m.id === materiaId
          ? { ...m, temas: m.temas.map((x) => (x.id === temaId ? { ...x, nombre: t.nombre } : x)) }
          : m,
      ),
    )
  }
  function onActualizarConteoTema(materiaId, temaId, total) {
    setMaterias((prev) =>
      prev.map((m) =>
        m.id === materiaId
          ? {
              ...m,
              temas: m.temas.map((t) => (t.id === temaId ? { ...t, preguntas: total } : t)),
            }
          : m,
      ),
    )
  }

  // ----- Carpetas -----
  async function onCrearCarpeta(nombre) {
    const nueva = await crearCarpeta(nombre, proyectoId)
    setCarpetas((prev) => [...prev, nueva])
    return nueva
  }
  async function onEditarCarpeta(id, nombre) {
    const c = await editarCarpeta(id, nombre)
    setCarpetas((prev) => prev.map((x) => (x.id === id ? { ...x, nombre: c.nombre } : x)))
  }
  async function onEliminarCarpeta(id) {
    await eliminarCarpeta(id)
    setCarpetas((prev) => prev.filter((c) => c.id !== id))
    setMaterias((prev) => prev.filter((m) => m.carpetaId !== id))
  }
  function onReordenarCarpetas(nuevas) {
    setCarpetas(nuevas)
    reordenarCarpetas(nuevas.map((c) => c.id)).catch((e) =>
      console.error('No se pudo guardar el orden de carpetas:', e),
    )
  }
  // Importa materias (con temas y preguntas) a una carpeta y recarga el catálogo.
  async function onImportarMaterias(carpetaId, datos) {
    const r = await importarMateriasACarpeta(carpetaId, datos)
    await recargar()
    return r
  }
  // Importa una carpeta nueva (con sus materias) en este contexto y recarga.
  async function onImportarCarpeta(datos) {
    const r = await importarCarpeta(datos, proyectoId)
    await recargar()
    return r
  }

  return {
    carpetas,
    materias,
    cargando,
    error,
    recargar,
    handlers: {
      onCrearMateria,
      onEliminarMateria,
      onEditarMateria,
      onReordenarMaterias,
      onCrearTema,
      onEliminarTema,
      onEditarTema,
      onActualizarConteoTema,
      onCrearCarpeta,
      onEditarCarpeta,
      onEliminarCarpeta,
      onReordenarCarpetas,
      onImportarMaterias,
      onImportarCarpeta,
    },
  }
}
