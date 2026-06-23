import { useState, useEffect } from 'react'
import {
  fetchPreguntas,
  guardarSesion,
  fetchYo,
  logout,
  fetchSolicitudes,
} from './api.js'
import useContenido from './useContenido.js'
import AuthScreen from './components/AuthScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import CuentaScreen from './components/CuentaScreen.jsx'
import AmigosScreen from './components/AmigosScreen.jsx'
import ProyectosScreen from './components/ProyectosScreen.jsx'
import ProyectoScreen from './components/ProyectoScreen.jsx'
import MultijugadorScreen from './components/MultijugadorScreen.jsx'
import SalaScreen from './components/SalaScreen.jsx'
import QuizScreen from './components/QuizScreen.jsx'
import ResultsScreen from './components/ResultsScreen.jsx'
import StatsScreen from './components/StatsScreen.jsx'

const SCREENS = {
  HOME: 'home',
  PROYECTOS: 'proyectos',
  PROYECTO: 'proyecto',
  MULTIJUGADOR: 'multijugador',
  SALA: 'sala',
  CUENTA: 'cuenta',
  AMIGOS: 'amigos',
  QUIZ: 'quiz',
  RESULTS: 'results',
  STATS: 'stats',
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.HOME)
  const [error, setError] = useState(null)
  // Usuario autenticado (null = sin sesión). undefined = aún verificando.
  const [usuario, setUsuario] = useState(undefined)
  // Nº de solicitudes de amistad pendientes (badge del menú lateral).
  const [solicitudes, setSolicitudes] = useState(0)
  // Proyecto abierto actualmente (al entrar a un proyecto).
  const [proyectoActual, setProyectoActual] = useState(null)
  // Sala multijugador activa (al crear/unirse).
  const [salaActual, setSalaActual] = useState(null)

  // Contenido personal (carpetas/materias/temas) y sus handlers.
  const personal = useContenido(null, !!usuario)

  // Preguntas de la partida actual y resultados (paralelos).
  const [preguntas, setPreguntas] = useState([])
  const [materiaActual, setMateriaActual] = useState(null)
  const [resultados, setResultados] = useState([])
  // Segundos por pregunta elegidos (null = sin tiempo). Por defecto 30 s.
  const [tiempoPorPregunta, setTiempoPorPregunta] = useState(30)

  // Al iniciar, comprueba si ya hay una sesión activa (cookie).
  useEffect(() => {
    fetchYo()
      .then((u) => setUsuario(u || null))
      .catch(() => setUsuario(null))
  }, [])

  // Cuenta de solicitudes pendientes para el badge (al entrar y al navegar).
  const enShell = [
    SCREENS.HOME,
    SCREENS.PROYECTOS,
    SCREENS.PROYECTO,
    SCREENS.MULTIJUGADOR,
    SCREENS.CUENTA,
    SCREENS.AMIGOS,
  ].includes(screen)
  useEffect(() => {
    if (!usuario) return
    fetchSolicitudes()
      .then((s) => setSolicitudes(s.length))
      .catch(() => {})
  }, [usuario, screen])

  // Tras autenticarse: guarda el usuario (dispara la carga del catálogo).
  function onAutenticado(u) {
    setError(null)
    setUsuario(u)
  }

  // Perfil actualizado (nombre / foto): refresca el usuario en memoria.
  function onActualizarPerfil(perfil) {
    setUsuario(perfil)
  }

  // Cierra sesión y limpia el estado local.
  async function onLogout() {
    try {
      await logout()
    } catch (e) {
      console.error('No se pudo cerrar sesión:', e)
    }
    setUsuario(null)
    setProyectoActual(null)
    setSalaActual(null)
    setPreguntas([])
    setResultados([])
    setScreen(SCREENS.HOME)
  }

  async function iniciarQuiz(materia, temasSeleccionados, tiempo) {
    setError(null)
    try {
      const preg = await fetchPreguntas(temasSeleccionados)
      if (preg.length === 0) {
        setError('No hay preguntas para los temas seleccionados.')
        return
      }
      setTiempoPorPregunta(tiempo)
      setMateriaActual(materia)
      setPreguntas(preg)
      setResultados([])
      setScreen(SCREENS.QUIZ)
    } catch (e) {
      setError(e.message)
    }
  }

  async function terminarQuiz(resultadosFinales) {
    setResultados(resultadosFinales)
    setScreen(SCREENS.RESULTS)
    // Persistir la sesión en SQLite (no bloquea la UI).
    try {
      await guardarSesion({
        materiaId: materiaActual?.id ?? null,
        respuestas: resultadosFinales,
      })
    } catch (e) {
      console.error('No se pudo guardar la sesión:', e)
    }
  }

  function volverInicio() {
    setPreguntas([])
    setResultados([])
    setScreen(SCREENS.HOME)
  }

  function abrirProyecto(p) {
    setProyectoActual(p)
    setScreen(SCREENS.PROYECTO)
  }

  // Mientras se verifica la cookie de sesión.
  if (usuario === undefined) {
    return (
      <div className="app">
        <div className="estado-carga">🧠 Cargando…</div>
      </div>
    )
  }

  // Sin sesión: pantalla de acceso con menú lateral (login / registro).
  if (!usuario) {
    return <AuthScreen onAutenticado={onAutenticado} />
  }

  // Pantallas con menú lateral (zona principal).
  if (enShell) {
    // El proyecto abierto resalta la sección "Proyectos" en el menú.
    const seccion = screen === SCREENS.PROYECTO ? SCREENS.PROYECTOS : screen
    return (
      <div className="shell">
        <Sidebar
          usuario={usuario}
          screen={seccion}
          solicitudes={solicitudes}
          onNavigate={(id) => {
            setProyectoActual(null)
            setScreen(id)
          }}
          onLogout={onLogout}
        />
        <main className="shell-main">
          {error && <div className="banner-error">⚠️ {error}</div>}

          {screen === SCREENS.HOME &&
            (personal.cargando ? (
              <div className="estado-carga">🧠 Cargando tus datos…</div>
            ) : (
              <HomeScreen
                materias={personal.materias}
                carpetas={personal.carpetas}
                onIniciar={iniciarQuiz}
                onVerStats={() => setScreen(SCREENS.STATS)}
                {...personal.handlers}
              />
            ))}

          {screen === SCREENS.PROYECTOS && (
            <ProyectosScreen onAbrir={abrirProyecto} />
          )}
          {screen === SCREENS.PROYECTO && proyectoActual && (
            <ProyectoScreen
              proyecto={proyectoActual}
              onIniciar={iniciarQuiz}
              onVolver={() => {
                setProyectoActual(null)
                setScreen(SCREENS.PROYECTOS)
              }}
            />
          )}

          {screen === SCREENS.MULTIJUGADOR && (
            <MultijugadorScreen
              onEntrarSala={(sala) => {
                setSalaActual(sala)
                setScreen(SCREENS.SALA)
              }}
            />
          )}

          {screen === SCREENS.CUENTA && (
            <CuentaScreen usuario={usuario} onActualizar={onActualizarPerfil} />
          )}
          {screen === SCREENS.AMIGOS && <AmigosScreen />}
        </main>
      </div>
    )
  }

  // Sala multijugador (pantalla completa, estilo Kahoot).
  if (screen === SCREENS.SALA && salaActual) {
    return (
      <div className="app app-ancha">
        <SalaScreen
          codigo={salaActual.codigo}
          salaInicial={salaActual}
          onSalir={() => {
            setSalaActual(null)
            setScreen(SCREENS.MULTIJUGADOR)
          }}
        />
      </div>
    )
  }

  // Pantallas a pantalla completa (quiz / resultados / historial).
  return (
    <div className="app">
      {error && <div className="banner-error">⚠️ {error}</div>}

      {screen === SCREENS.QUIZ && (
        <QuizScreen
          preguntas={preguntas}
          tiempoPorPregunta={tiempoPorPregunta}
          onTerminar={terminarQuiz}
          onSalir={volverInicio}
        />
      )}
      {screen === SCREENS.RESULTS && (
        <ResultsScreen
          resultados={resultados}
          onReiniciar={volverInicio}
          onVerStats={() => setScreen(SCREENS.STATS)}
        />
      )}
      {screen === SCREENS.STATS && <StatsScreen onVolver={volverInicio} />}
    </div>
  )
}
