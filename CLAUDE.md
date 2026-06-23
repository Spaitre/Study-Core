# CLAUDE.md — Study Core

> Documento de contexto del proyecto. **Léelo junto con `TASKS.md` al iniciar cualquier conversación nueva.** Manténlo actualizado cada vez que se complete una funcionalidad importante.
>
> Última actualización: 2026-06-23
>
> Nota: el proyecto se llamaba "Cerebro Quiz" y se renombró a **Study Core**. La carpeta del repo sigue siendo `cerebro-quiz/`, la base es `data/cerebro.db` y varios logs/IDs internos conservan el prefijo "cerebro" (inocuo).

---

## 1. Objetivo general

Aplicación web tipo **Kahoot para estudio médico personal** (enfocada al ENARM). Organiza preguntas en una jerarquía **Carpeta → Materia → Tema**, las estudia en quizzes con cronómetro y retroalimentación, repasa flashcards con repetición espaciada, y muestra estadísticas.

**Es multiusuario y social:**
- Cada persona tiene **cuenta** (correo + contraseña) **o entra como invitado**, con datos aislados.
- **Perfil**: nombre de usuario + foto (13 avatares animados o imagen subida).
- **Amigos** con solicitudes.
- **Proyectos colaborativos**: carpetas/materias compartidas por código, con permisos.
- **Multijugador en tiempo real** estilo Kahoot (salas con código de 5 dígitos).
- **Import/Export** de materias y carpetas en JSON.

## 2. Arquitectura

Dos procesos que corren juntos con `npm run dev`:

- **Backend** (`server/`): Node + Express + **SQLite** (módulo nativo `node:sqlite`, sin deps nativas). API REST en `http://localhost:3001`. Fuente de datos principal. Además mantiene **estado en memoria** de las salas de multijugador (no en SQLite).
  - **Capas (refactor jun 2026):** `routes/` (solo HTTP) → `services/` (negocio, permisos, transacciones) → `repositories/` (solo SQL) → `db/` (acceso a datos). `index.js` solo construye la app y monta routers. La capa de datos expone una **interfaz async** (`db/index.js → database`) aunque hoy use `node:sqlite` (síncrono), para poder migrar a Postgres reescribiendo solo `db/` sin tocar servicios/rutas. Las transacciones van por `database.withTransaction(fn)`; los repos aceptan un `exec` opcional para componerlas. Errores de negocio con `ApiError(status, msg)` que el manejador global traduce a `{ error }`.
- **Frontend** (`src/`): React 18 + Vite. **Configurado en el puerto 80 e IPv4** (`host: '127.0.0.1'`), así abre en **`http://studycore.localhost`** (los navegadores resuelven `*.localhost` a la máquina, sin tocar el archivo `hosts`). `allowedHosts` incluye `studycore.localhost`. Vite hace proxy de `/api` → `:3001`. Ver `vite.config.js`.

**Autenticación:** sesión por **token aleatorio en cookie httpOnly** (`sc_token`); en la base solo se guarda el `sha256` del token. Contraseñas con **hash scrypt + salt** (`node:crypto`). Cliente con `credentials: 'include'`. Todo `/api/*` (salvo `/api/auth/*`) exige sesión vía `requireAuth`, que deja `req.usuarioId`.

**Aislamiento de datos por contexto (personal vs proyecto):** `carpetas` y `materias` llevan `usuario_id` **y** `proyecto_id`. Personal = `usuario_id = yo AND proyecto_id IS NULL`; proyecto = `proyecto_id = P` (con membresía). Temas/preguntas heredan acceso vía su materia. Helpers clave: en `services/contenidoService.js` → `resolverContexto(usuarioId, raw)` (resuelve `?proyecto=` / `body.proyectoId` validando membresía) y `exigirEdicion` (modo solo lectura); en `repositories/contenidoRepo.js` → `carpetaAccesible` / `materiaAccesible` / `temaAccesible` / `pregAccesible` (devuelven `proyecto_id`) y los fragmentos SQL `ACC_CARPETA` / `ACC_MATERIA`. Permisos de proyecto en `services/proyectosService.js` (`esMiembro`, `puedeEditarProyecto`).

**Importación JSON al arrancar: DESACTIVADA.** Las cuentas empiezan vacías; `server/importer.js` ya no se invoca (se conserva por si se reintroduce).

## 3. Tecnologías

- **Node 24** (`node:sqlite` requiere Node ≥ 22.5). En este equipo Node **no está en el PATH**; vive en `C:\Program Files\nodejs` (invocar por ruta absoluta o `npm.cmd`).
- **Express 4**, **React 18**, **Vite 5**, **concurrently**.
- **pdf-parse v2** (.pdf) y **mammoth** (.docx) para importar archivos.
- Auth/hashing con **`node:crypto`** (scrypt, sha256, randomBytes); sin libs de auth externas.
- Sin TypeScript. Sin dependencias de IA.

## 4. Estructura de carpetas

```
cerebro-quiz/
├── CLAUDE.md, TASKS.md, README.md
├── package.json, index.html, public/cerebro.svg
├── vite.config.js            # host 127.0.0.1 :80, studycore.localhost, proxy /api -> :3001
├── data/
│   ├── cerebro.db            # SQLite (no versionado)
│   └── json/                 # JSON de import/export manual (ya NO se auto-importa)
├── server/
│   ├── index.js              # construye la app Express y monta los routers (delgado)
│   ├── db/
│   │   ├── index.js          # punto único de datos: expone `database` (async) y reexporta `db`/rutas
│   │   ├── sqlite.js         # adaptador async sobre node:sqlite (caché de stmts, withTransaction)
│   │   └── schema.js         # esquema y migraciones (ALTER en try/catch); conexión cruda `db`
│   ├── repositories/         # SOLO SQL: usuariosRepo, tokensRepo, amigosRepo, proyectosRepo,
│   │   │                     #   contenidoRepo, sesionesRepo
│   ├── services/            # negocio/permisos/transacciones: authService, perfilService,
│   │   │                     #   amigosService, proyectosService, contenidoService, sesionesService,
│   │   │                     #   salasService, ApiError
│   ├── routes/              # SOLO HTTP (un archivo por dominio) + _wrap.js (ah: async handler)
│   ├── salas/salasStore.js   # multijugador en memoria (Map + lógica de juego, sin BD ni HTTP)
│   ├── db.js                 # reexport de compat hacia db/ (lo usa el legado importer.js)
│   ├── importer.js           # legado (no se llama al arrancar)
│   └── importar/{extraer.js, parsear.js}   # extractores por formato + parser por patrones
└── src/
    ├── main.jsx, App.jsx, api.js, index.css
    ├── useContenido.js          # hook: catálogo (carpetas/materias) + CRUD para un contexto (personal o proyecto)
    └── components/
        ├── AuthScreen.jsx           # login / registro / entrar como invitado (menú lateral)
        ├── Sidebar.jsx              # menú: foto + nombre + nav (Inicio/Proyectos/Multijugador/Amigos/Cuenta) + logout
        ├── Avatar.jsx               # 13 avatares animados (SVG) + foto subida; exporta AVATARES
        ├── CuentaScreen.jsx         # editar nombre (con chequeo en vivo) + elegir/subir foto
        ├── AmigosScreen.jsx         # amigos / agregar / solicitudes
        ├── ProyectosScreen.jsx      # lista de proyectos, unirse por código, crear, editar (incl. PermisoSelector)
        ├── ProyectoScreen.jsx       # workspace de un proyecto: reutiliza HomeScreen con useContenido(proyectoId)
        ├── PermisoSelector.jsx      # 3 opciones de permiso (todos / solo dueño / selectivo)
        ├── MultijugadorScreen.jsx   # crear sala (carpetas propias / de proyectos) + unirse por código
        ├── SalaScreen.jsx           # lobby + juego Kahoot (sondeo ~1s)
        ├── HomeScreen.jsx           # carpetas + materias + temas + tiempo + modales + import/export
        ├── QuizScreen.jsx           # quiz individual: opción múltiple + flashcards
        ├── ResultsScreen.jsx, StatsScreen.jsx
        └── ImportarPreguntasModal.jsx, GestionPreguntasModal.jsx
```

## 5. Base de datos (SQLite)

`PRAGMA foreign_keys = ON; journal_mode = WAL;`

**Auth / usuario / social:**
- **usuarios** (`id` PK, `email` UNIQUE, `password_hash`, `password_salt`, `creado_en`, `nombre_usuario` UNIQUE, `foto_perfil`, `invitado` 0/1). `foto_perfil` = clave de avatar o `data:` URL.
- **tokens** (`token_hash` PK, `usuario_id` → usuarios CASCADE, `creado_en`, `expira_en`) — vigencia 30 días.
- **amistades** (`id` PK, `solicitante_id`/`receptor_id` → usuarios CASCADE, `estado` `'pendiente'|'aceptada'`, `creado_en`, UNIQUE(solicitante,receptor)).

**Proyectos colaborativos:**
- **proyectos** (`id` PK, `nombre`, `propietario_id` → usuarios CASCADE, `creado_en`, `codigo` UNIQUE (6 dígitos), `permiso_edicion` `'todos'|'solo_propietario'|'selectivo'`).
- **proyecto_miembros** (`proyecto_id` → proyectos CASCADE, `usuario_id` → usuarios CASCADE, PK compuesta) — quién está dentro (efectivo).
- **proyecto_acceso** (`proyecto_id`, `usuario_id`, PK compuesta) — lista blanca para modo `'selectivo'` (si está vacía ⇒ acceso abierto).

**Contenido de estudio:**
- **carpetas** (`id` TEXT PK, `nombre`, `posicion`, `usuario_id`, `proyecto_id`).
- **materias** (`id` TEXT PK, `nombre`, `icono`, `posicion`, `carpeta_id`, `usuario_id`, `proyecto_id`).
- **temas** (`id` TEXT PK, `materia_id` → materias CASCADE, `nombre`).
- **preguntas** (`id` PK AUTOINCREMENT, `tema_id` → temas CASCADE, `pregunta`, `opciones` JSON, `respuesta_correcta` INT, `explicacion`, `hash` UNIQUE, `tipo` `'opcion'|'flashcard'`).
- **sesiones** (`id` PK, `fecha`, `materia_id`, `total`, `aciertos`, `usuario_id`) y **sesion_respuestas** (→ sesiones CASCADE; guarda `tema_nombre` como texto).
- **imported_files** — legado del auto-import (sin uso).

**Notas:** columnas `usuario_id`/`proyecto_id`/`invitado` se agregan por `ALTER` (sin FK declarada → cascades de contenido se hacen manualmente en los endpoints). IDs de carpeta/materia/tema = slug global, desambiguados con sufijo (`idUnico`). Al borrar carpeta/materia se borran sus hijos manualmente. Borrar un proyecto borra su contenido (`WHERE proyecto_id=?`) manualmente; el resto cae por cascada.

**Las salas de multijugador NO están en SQLite** — viven en un `Map` en memoria en `server/index.js`.

## 6. Modelos de datos (API/JSON)

- **Perfil**: `{ id, email, nombreUsuario, foto, invitado }`.
- **Proyecto**: `{ id, nombre, codigo, permisoEdicion, propietarioId, esPropietario, puedeEditar, acceso: [ids], miembros: [{id,nombreUsuario,email,foto}] }`.
- **Sala (vista según estado)**: `{ codigo, estado: 'lobby'|'pregunta'|'revelar'|'final', esHost, espectador, total, ... }`; en `pregunta`: `{ idx, pregunta:{enunciado,opciones}, deadline, tiempo, tuRespondida, numRespondieron, numJugadores }`; en `revelar`: `{ correcta, tuOpcion, tuCorrecta, ganancia, tabla }`; en `final`: `{ tabla }`.
- **Materia/Carpeta/Pregunta**: como en §1 (carpeta `{id,nombre,materias:<conteo>}`).
- **Export**: materia → `{ materias: [...] }`; carpeta → `{ carpeta: "Nombre", materias: [...] }`; varias carpetas → `{ carpetas: [{carpeta, materias}] }`. Import acepta estos formatos (y arreglo/objeto suelto).

## 7. Flujo de la app

0. **Acceso** (`AuthScreen`): Iniciar sesión / Crear cuenta (correo+contraseña, mín. 6) **o "Entrar como invitado"** (sin registro; nombre y avatar aleatorios).
1. **Inicio** (`HomeScreen` dentro del `Sidebar`): Carpeta → Materia → Temas → tiempo (30s/1min/sin tiempo, `localStorage`) → quiz. Aquí también **importar/exportar** materias y carpetas.
2. **Quiz** (`QuizScreen`): opción múltiple (cronómetro, opciones barajadas en servidor) o flashcard (revelar + repaso 1–4/Espacio).
3. **Resultados** / **Historial** por usuario.

**Menú lateral** (`Sidebar`, en Inicio/Proyectos/Multijugador/Amigos/Cuenta): foto + nombre arriba; orden **Inicio · Proyectos · Multijugador · Amigos · Cuenta** + Cerrar sesión. Quiz/sala/resultados van a pantalla completa.

- **Cuenta** (`CuentaScreen`): nombre de usuario **1–20 caracteres, se permiten especiales**, con **chequeo en vivo** (avisa "ese nombre ya existe"; sin mensaje de "disponible"). Foto: 13 avatares o **subir imagen** (recorte a 256×256 → data URL JPEG; **se guarda automáticamente al subirla**). El cuadro "Subir imagen" siempre muestra el ícono, no la miniatura.
- **Amigos** (`AmigosScreen`): amigos / agregar (correo o nombre) / solicitudes. No es en tiempo real.
- **Proyectos** (`ProyectosScreen`): **unirse por código (6 dígitos)**; **crear** (nombre + permiso, sin invitar a nadie — todos entran por código); cada proyecto muestra su código copiable; el dueño puede **editar** (nombre, permiso, quitar miembros) — el panel se cierra al guardar; eliminar/salir con **modal de confirmación** (botón rojo). Al entrar (`ProyectoScreen`) se ve igual que el Inicio pero con el contenido **compartido** del proyecto; en modo solo lectura se ocultan los controles de edición.
- **Multijugador** (`MultijugadorScreen` → `SalaScreen`): ver abajo §8.

## 8. Funcionalidades implementadas

- **Cuentas** (registro/login/logout) + **invitado** (cuenta temporal con nombre/avatar aleatorios; **se elimina al cerrar sesión**, y una **limpieza automática** borra invitados con >30 días sin token vigente, al arrancar y cada 6 h).
- **Perfil**: nombre único (1–20, con chequeo en vivo de disponibilidad) + foto (13 avatares SVG animados o imagen subida que se guarda sola).
- **Amigos**: solicitar/cancelar/aceptar/rechazar/eliminar.
- **Proyectos colaborativos**: código único de 6 dígitos, unirse por código, 3 permisos (**todos** / **solo propietario** [los demás solo ven] / **selectivo** [lista blanca; si vacía ⇒ abierto]). Al pasar a selectivo se expulsa a los miembros no permitidos. Contenido del proyecto aislado del personal; cualquiera con permiso aporta carpetas/materias/temas/preguntas.
- **Multijugador estilo Kahoot** (salas en memoria, sincronizadas por **sondeo ~1s**): el host elige **carpetas propias o de proyectos** (agrupadas) → materias → temas; tiempo 10/20/30/60s; rol **participar o espectador**. Sala con **código de 5 dígitos**, lobby con tarjetas de jugadores (animación), botón **Iniciar** del host. Pregunta con opciones de colores + cronómetro; al responder todos o agotarse el tiempo se **revela**; **puntos tipo Kahoot** (correcto + rápido = hasta 1000). Host avanza, puede **Terminar partida** a mitad; jugadores pueden **Salir** en cualquier momento. Final con **podio** + tabla.
- **Import/Export JSON**: exportar **materia(s)** (selección múltiple) y **carpeta(s)** (selección múltiple, en un archivo); importar materias a una carpeta existente, o importar carpeta(s) nuevas. Respeta el contexto (personal/proyecto) y el permiso. Dedup de preguntas por hash dentro de cada tema.
- Quiz individual (opción múltiple + flashcards), retroalimentación, resultados e historial por usuario.
- **Importar preguntas desde archivo** PDF/DOCX/TXT (detección por patrones, vista previa editable, prompts copiables para IA externa). CRUD de preguntas por tema.
- Iconos editar/eliminar/exportar en las esquinas de las tarjetas (al hover); memoria del tiempo (localStorage).

## 9. Pendientes / ideas

Ver `TASKS.md`. En resumen: tiempo real para amigos/proyectos (hoy por recarga; sin websockets); mover materias entre carpetas desde la UI; separar aciertos flashcards vs opción múltiple; cambio/recuperación de contraseña; rate limiting en login; multijugador con **WebSockets** si crece; **hosting** permanente (ver §15).

## 10. Componentes / módulos clave

- **App.jsx**: estado global (usuario, proyecto/sala actual, solicitudes, sesión de quiz). Verifica sesión (`fetchYo`), usa `useContenido(null)` para el contenido personal, enruta entre pantallas con `Sidebar` (HOME/PROYECTOS/PROYECTO/MULTIJUGADOR/AMIGOS/CUENTA) y pantalla completa (QUIZ/RESULTS/STATS/SALA).
- **useContenido(proyectoId, activo)**: encapsula carpetas/materias + todos los handlers CRUD (incl. `onImportarMaterias`, `onImportarCarpeta`) para un contexto. Lo usan el Inicio (personal) y cada `ProyectoScreen`.
- **Avatar.jsx**: 13 presets SVG (`ajolote, gato (negro), zorro, buho, rana, pinguino, pulpo, perro, conejo, panda, leon, unicornio, dragon`) animados con clases CSS `av-*`; o `<img>` si la foto es `data:`.
- **SalaScreen.jsx**: sondea `fetchSala` cada 1s; reloj local; render por estado (lobby/pregunta/revelar/final).

## 11. API REST (bajo `/api`)

**Auth (públicas):** `POST /auth/registro`, `POST /auth/login`, `POST /auth/logout` (borra invitado si lo es), `POST /auth/invitado` (crea invitado + cookie), `GET /auth/yo`.

**Perfil:** `GET /perfil`, `PATCH /perfil` (`{nombreUsuario?, foto?}`; nombre 1–20, cualquier carácter), `GET /perfil/disponible?nombre=` (chequeo en vivo).

**Amigos:** `GET /amigos`, `/amigos/solicitudes`, `/amigos/enviadas`, `POST /amigos/solicitar` (`{identificador}`), `POST /amigos/:id/aceptar`, `DELETE /amigos/:id`.

**Proyectos:** `GET /proyectos`, `POST /proyectos` (`{nombre, permisoEdicion, acceso:[ids]}`), `POST /proyectos/unirse` (`{codigo}`), `GET /proyectos/:id`, `PATCH /proyectos/:id` (`{nombre?, permisoEdicion?, acceso?}`), `DELETE /proyectos/:id` (dueño), `DELETE /proyectos/:id/miembros/:uid` (dueño), `POST /proyectos/:id/salir`.

**Salas (multijugador):** `POST /salas` (`{temas, tiempo, hostJuega}`), `POST /salas/unirse` (`{codigo}`), `GET /salas/:codigo` (sondeo; revela si toca), `POST /salas/:codigo/iniciar|responder|siguiente|terminar|salir`.

**Contenido (con `?proyecto=` opcional):** carpetas `GET/POST/PATCH/DELETE /carpetas[/:id]`, `PUT /carpetas/orden`; materias análogo + `PUT /materias/orden`; `POST/PATCH/DELETE /temas`; preguntas `GET/POST /temas/:id/preguntas`, `PATCH/DELETE /preguntas/:id`, `GET /preguntas?temas=`, `GET /search?q=`.

**Import/Export:** `POST /carpetas/:id/importar` (materias a carpeta existente), `POST /carpetas/importar` (carpeta(s) nuevas), `GET /materias/:id/export`, `GET /carpetas/:id/export`; archivo: `POST /temas/:id/importar/analizar|confirmar`.

**Sesiones/Stats/Export:** `POST /sesiones`, `GET /stats`, `GET /export`.

`src/api.js` envuelve todo con `credentials: 'include'`.

## 12. Decisiones de diseño

- **Capa de datos async (Fase 1 de optimización, jun 2026):** los repos/servicios usan una interfaz async aunque `node:sqlite` sea síncrono, para que migrar a Postgres (`pg`, async) solo toque `db/` y no se propague por todo el stack. Costo asumido: un mutex de transacción en `db/sqlite.js` (con una sola conexión SQLite no pueden solaparse dos `BEGIN`; en Postgres cada tx tomará su cliente del pool y el mutex sobra). Se reusan prepared statements vía caché por SQL en el adaptador.
- **Auth con `node:crypto`** (scrypt+salt; token sha256 en DB; cookie httpOnly + SameSite=Lax, `Secure` si `COOKIE_SECURE=1`).
- **Acceso por contexto**: SQL filtra personal vs proyecto; selectivo se aplica sincronizando `proyecto_miembros` (se quitan los no permitidos) y bloqueando la unión por código de no listados.
- **Invitados** = cuentas reales con flag `invitado` y correo/contraseña aleatorios inservibles; se borran al salir + limpieza por inactividad.
- **Multijugador en memoria + sondeo** (sin deps nuevas): sencillez por encima de latencia mínima. **Implica una sola instancia del backend** y que un reinicio pierde las salas activas.
- **Avatares SVG animados**; imagen subida reducida a 256×256 (data URL, ~1 MB máx).
- **SQLite con `node:sqlite`**; dedup de preguntas por `hash = sha256(tema_id + enunciado normalizado)`; barajado de opciones en el servidor.
- **URL local bonita** vía `*.localhost` (sin editar `hosts`); Vite en IPv4:80.

## 13. Convenciones

Español en UI/comentarios/errores. JSX funcional con hooks; estado en `App.jsx` / `useContenido`, props hacia abajo, handlers `onXxx`. Errores API `{ error: "mensaje" }` con HTTP adecuado. IDs = slug global. CSS plano en `src/index.css` con variables (`--morado`, etc.).

## 14. Problemas conocidos / límites

- **Sin tiempo real**: amigos, proyectos y (parcialmente) multijugador se refrescan por recarga/sondeo, no por push.
- **Multijugador**: salas en memoria ⇒ se pierden al reiniciar; requiere **una sola instancia**. Sondeo 1s escala mal a cientos de usuarios (ok para amigos).
- **SQLite**: un escritor a la vez; perfecto para decenas de usuarios, no cientos concurrentes. No elimina columnas (las migraciones por `ALTER` quedan).
- **`studycore.localhost` es solo local** (cada equipo resuelve `*.localhost` hacia sí mismo). Desde otros dispositivos hay que usar IP/host real.
- **Sin cambio/recuperación de contraseña** ni rate limiting aún.
- Borrar carpeta/proyecto elimina su contenido (con confirmación) — no lo mueve.

## 15. Hosting (para acceso desde cualquier dispositivo)

**Listo en código (Fase 7):**
- **Build servido por el mismo Express** (mismo origen, sin CORS): si existe `dist/`, `index.js` sirve los estáticos + fallback SPA (rutas que no empiezan por `/api/`). En dev no existe `dist/` y lo sirve Vite en :80; se genera con `npm run build`.
- **`trust proxy`** activado (cookie `Secure` y protocolo correctos detrás del proxy del hosting).
- **SQLite en disco persistente vía env**: `DATA_DIR` (carpeta) o `DB_PATH` (archivo). Por defecto `data/cerebro.db`.
- **Pragmas de producción**: `busy_timeout=5000`, `synchronous=NORMAL` (+ `journal_mode=WAL`, `foreign_keys=ON`).
- **Apagado limpio** (SIGTERM/SIGINT): cierra el server HTTP y la BD con checkpoint del WAL.
- **`railway.json`**: build `npm run build`, start `npm start`, **`numReplicas: 1`** (obligatorio por salas en memoria + SQLite de un escritor).

**Pasos manuales pendientes para desplegar en Railway:** crear el proyecto, montar un **volumen** y apuntar `DATA_DIR` ahí, definir `COOKIE_SECURE=1` (HTTPS) y `NODE_ENV=production`, asignar dominio. `PORT` lo inyecta Railway. Las capas 100% gratis "duermen" (pierden salas) o no persisten SQLite. Falta: **respaldo** periódico del `.db`.

**Escala (constraint):** una sola instancia (salas en memoria + un escritor SQLite). Escala vertical; cuando crezca, salas→WebSockets/Redis y SQLite→Postgres (la capa de datos async de la Fase 1 ya deja esto último listo).

## 16. Cómo correr el proyecto

**Desarrollo:**
```
cd cerebro-quiz
npm install        # solo la primera vez
npm run dev        # backend (3001) + frontend (Vite en :80)
```
Abrir **http://studycore.localhost** (o `http://localhost`). En este equipo, invocar Node por ruta absoluta si no está en el PATH (`C:\Program Files\nodejs`).

**Producción (mismo origen):**
```
npm run build      # genera dist/
npm start          # Express sirve API + dist/ en $PORT
```
Variables: `PORT` (hosting), `DATA_DIR`/`DB_PATH` (BD persistente), `COOKIE_SECURE=1` (HTTPS), `NODE_ENV=production`.
