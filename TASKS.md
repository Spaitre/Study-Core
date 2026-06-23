# TASKS.md — Study Core

> Lista de tareas del proyecto. Léela junto con `CLAUDE.md` al iniciar una conversación nueva.
> Convención: al empezar una tarea muévela a **En progreso**; al terminarla, a **Completadas** (con fecha) y actualiza `CLAUDE.md` si cambió el estado del proyecto.
>
> Última actualización: 2026-06-23

---

## 🔜 Pendientes

**Tiempo real / social**
- [ ] **Tiempo real** para amigos y proyectos (hoy se refrescan por recarga/navegación). Evaluar polling ligero o WebSockets.
- [ ] **Multijugador con WebSockets** si crece el uso (hoy es por sondeo ~1s; suficiente para amigos, no para cientos).
- [ ] Permitir que el **host se reconecte** a su sala si refresca la página (hoy la sala sigue viva pero él deja de controlarla).

**Cuentas**
- [ ] **Cambio de contraseña** y recuperación de cuenta.
- [ ] **Rate limiting** en `login`/`registro` (necesario antes de exponer a internet).

**Contenido**
- [ ] UI para **mover materias entre carpetas** (reubicar una existente, no solo crear en la activa).
- [ ] En **Resultados**, distinguir desempeño de **flashcards vs opción múltiple**.
- [ ] Permitir **editar/recuperar los bloques con error** del import de archivos directamente en el modal.
- [ ] Exponer **búsqueda** en la UI (el endpoint `/api/search` ya existe).
- [ ] Tecla **Esc** para cerrar modales y **Enter** para confirmar (accesibilidad).

**Hosting (acceso desde cualquier dispositivo)** — ver §15 de `CLAUDE.md`
- [x] Servir el **build** del frontend desde el mismo Express (mismo origen) — Fase 7.
- [x] Ruta de **SQLite por variable de entorno** (`DATA_DIR`/`DB_PATH`) — Fase 7.
- [ ] **Desplegar** en Railway (config lista en `railway.json`: 1 instancia; falta el paso manual: crear proyecto, volumen en `DATA_DIR`, `COOKIE_SECURE=1`, dominio).
- [ ] **Respaldo** periódico de `data/cerebro.db`.

**Ideas opcionales**
- [ ] Reintegrar **generación con IA** como proveedor intercambiable (Ollama local / API), si se decide.
- [ ] Limpieza de **proyectos/contenido huérfano** de invitados borrados (hoy se conserva si cuelga de proyectos de otros).

## 🚧 En progreso

- (ninguna)

## ✅ Completadas

**Optimización — Fase 1: capa de acceso a datos (jun 2026)**
- [x] Separar `server/index.js` (~1.700 líneas) en capas **rutas → servicios → repositorios → db/**, comportamiento idéntico, verificado por dominio con curl.
- [x] **Abstracción de datos async** (`db/index.js → database`) lista para migrar a PostgreSQL sin tocar servicios/rutas; `withTransaction` + mutex de transacción; caché de prepared statements; `ApiError` + manejador global.
- [x] Multijugador aislado en `salas/salasStore.js` (memoria, sin BD ni HTTP).

**Optimización — Fase 2: eficiencia de endpoints (jun 2026)**
- [x] Quitar N+1 manteniendo el JSON idéntico (solo menos consultas, sin cambiar payloads): amigos (JOIN perfil), proyectos `listar` (acceso+miembros en 2 consultas + `puedeEditar` en memoria), catálogo `/materias` (temas de todas las materias en 1 consulta).
- [x] Índice `idx_temas_materia` sobre `temas(materia_id)`.
- [x] Prepared statements ya reusados vía la caché del adaptador (Fase 1).
- [ ] Recorte de payloads ("payloads chicos"): diferido a las fases de frontend (4/5), donde cliente y servidor cambian juntos.

**Optimización — Fase 7: producción Railway (jun 2026)**
- [x] El mismo Express **sirve el build** (`dist/`) con fallback SPA si existe; en dev no se activa (lo sirve Vite). Mismo origen, sin CORS.
- [x] **`trust proxy`** para cookie `Secure`/protocolo detrás del proxy.
- [x] **Pragmas** SQLite de producción: `busy_timeout=5000`, `synchronous=NORMAL` (+ WAL y FK ya activos).
- [x] **Ruta de datos por env** (`DATA_DIR`/`DB_PATH`) para volumen persistente; por defecto `data/` (dev intacto).
- [x] **Apagado limpio** en SIGTERM/SIGINT: cierra el server y la BD (checkpoint WAL).
- [x] **`railway.json`** (build `npm run build`, start `npm start`, **`numReplicas: 1`**) + script `start`.
- [ ] Fases 3–6 de optimización (multijugador, frontend, red, importación): **pendientes**, rinden con tráfico.

**Base del quiz (jun 2026)**
- [x] App React + Vite tipo Kahoot (materia/tema, cronómetro, retroalimentación, resultados).
- [x] **SQLite** (`node:sqlite`) como fuente principal; barajado de opciones en el servidor por intento.
- [x] Cronómetro configurable (30s/1min/sin tiempo) con memoria en `localStorage`.
- [x] **Historial / estadísticas** acumuladas en SQLite.
- [x] Jerarquía **Carpeta → Materia → Tema**; CRUD + reordenar (drag); CRUD de preguntas por tema.
- [x] **Flashcards** con repetición espaciada; las 4 opciones de repaso en fila debajo del reverso.
- [x] **Importar preguntas desde archivo** PDF/DOCX/TXT (parser por patrones, vista previa editable, prompts copiables).
- [x] Banco de **Microbiología** tipo ENARM (5 temas × 30).

**Multiusuario y social (jun 2026)**
- [x] **Cuentas** (registro/login/logout) con auth scrypt + cookie httpOnly; datos aislados por usuario.
- [x] **Migrar** el banco original a la cuenta `tomasfloram@gmail.com`; auto-import de `data/json` desactivado.
- [x] **Perfil**: nombre de usuario (1–20, caracteres especiales, chequeo en vivo de disponibilidad) + foto.
- [x] **13 avatares animados** (SVG) + **subir imagen** (se guarda automáticamente; recorte 256×256).
- [x] **Amigos**: solicitar/aceptar/rechazar/eliminar (por correo o nombre).
- [x] **Entrar como invitado** (nombre + avatar aleatorios); se borra al cerrar sesión + limpieza de >30 días.

**Proyectos colaborativos (jun 2026)**
- [x] Proyectos con **código de 6 dígitos**, unirse por código, lista de miembros.
- [x] **Permisos**: todos / solo propietario / **selectivo** (lista blanca; vacía = abierto). Editar proyecto + quitar miembros + modales de confirmación (rojo).
- [x] Workspace del proyecto (`ProyectoScreen`) reutilizando el Inicio vía el hook `useContenido`; modo solo lectura.

**Multijugador (jun 2026)**
- [x] Salas en memoria por **sondeo ~1s**, código de 5 dígitos, lobby estilo Kahoot.
- [x] Host **participa o espectador**; tiempos 10/20/30/60s; puntos tipo Kahoot; podio + tabla.
- [x] **Terminar partida** (host) y **Salir** (jugadores) durante la sesión.
- [x] Crear sala eligiendo **carpetas propias o de proyectos** → materias → temas.

**Import/Export y otros (jun 2026)**
- [x] **Exportar/Importar** materias y carpetas (selección múltiple) desde la UI.
- [x] **URL local**: `http://studycore.localhost` (Vite IPv4:80, sin tocar `hosts`).
- [x] `CLAUDE.md` / `TASKS.md` / `README.md` al día.
