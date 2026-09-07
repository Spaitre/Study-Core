# 🧠 Study Core — Estudio médico colaborativo

Aplicación web tipo Kahoot para repasar temas médicos (enfocada al ENARM), **multiusuario y social**. **React + Vite** en el frontend y **SQLite** (módulo nativo `node:sqlite`) como base de datos. Cada persona tiene su cuenta (o entra como invitado), con carpetas, materias, temas y preguntas propias; se pueden formar **grupos de estudio** y jugar **partidas multijugador en tiempo real**.

> El repo se llama `cerebro-quiz/` y la base `data/cerebro.db` por razones históricas (antes "Cerebro Quiz"); la app se renombró a **Study Core**.

## Características

**Estudio**
- 📚 **Carpeta → Materia → Tema → Pregunta**: organiza y elige qué repasar.
- ⏱️ **Cronómetro** configurable (30s / 1min / sin tiempo) y **opciones barajadas** en el servidor por intento.
- ✅ **Retroalimentación inmediata** con explicación; **resultados** (% por tema) e **historial** acumulado.
- 🃏 **Flashcards** con repetición espaciada.
- 📥 **Importar desde archivo** PDF/DOCX/TXT o **texto pegado** (parser por patrones, vista previa editable, prompts copiables para IA externa: caso clínico y flashcards con metadatos de Materia/Tema/Dificultad).
- 🔁 **Import/Export JSON** de materias, carpetas y preguntas de un tema (selección múltiple) desde la UI.

**Cuentas y social**
- 👤 **Cuentas** (correo + contraseña con hash scrypt + cookie httpOnly, o **Google**) o **entrar como invitado** (nombre y avatar aleatorios; la cuenta se borra al cerrar sesión). Bloqueo temporal tras varios intentos fallidos de login.
- 🎨 **Perfil**: nombre de usuario único + foto (13 avatares animados o imagen subida).
- 🫂 **Amigos** con solicitudes.
- 👥 **Grupos de estudio**: carpetas/materias compartidas; se unen por **código de 6 dígitos**; permisos **todos / solo propietario / selectivo** (lista blanca); **estadísticas colectivas** y **objetivos grupales** con progreso en vivo.
- 🎮 **Multijugador estilo Kahoot**: sala con **código de 5 dígitos**, lobby, host participante o espectador, tiempos 10/20/30/60s, puntos por rapidez y **podio** final.

## Requisitos

**Node.js 22.5 o superior** (incluye `node:sqlite`; probado en Node 24). Sin compiladores ni dependencias nativas.

## Cómo ejecutar

Desde la carpeta `cerebro-quiz`:

```bash
npm install      # solo la primera vez
npm run dev      # backend SQLite (:3001) + cliente Vite (:80)
```

Abre **http://studycore.localhost** (o `http://localhost`; usa `http://localhost` si vas a probar el login con Google). Vite reenvía las llamadas `/api` al backend.

> En este equipo Node no está en el PATH; vive en `C:\Program Files\nodejs` (invocar por ruta absoluta o `npm.cmd`).

Variables de entorno opcionales en `.env` (copia `.env.example`): `VITE_GOOGLE_CLIENT_ID` para activar el botón "Iniciar sesión con Google".

Otros scripts:

```bash
npm run server   # solo el backend (API SQLite en :3001)
npm run build    # compila el frontend a dist/
npm run preview  # sirve la versión compilada
```

## Acceso y datos

- Al abrir la app, **inicia sesión (con contraseña o Google), crea una cuenta o entra como invitado**.
- Las cuentas **empiezan vacías**: cada quien crea o importa su contenido. El auto-import de `data/json` al arrancar está **desactivado** (los JSON solo sirven como formato de import/export manual).
- Todo el contenido está **aislado por usuario**; los grupos de estudio comparten su contenido entre sus miembros.

### Formato de import/export (JSON)

- **Materia(s)**: `{ "materias": [ { "nombre", "icono", "temas": [ { "nombre", "preguntas": [...] } ] } ] }`
- **Carpeta**: `{ "carpeta": "Nombre", "materias": [...] }`
- **Varias carpetas**: `{ "carpetas": [ { "carpeta": "Nombre", "materias": [...] } ] }`

Una pregunta tiene `{ "pregunta", "opciones": ["A","B",...], "respuestaCorrecta": 0, "explicacion": "..." }`. Si `opciones` va vacío y hay `explicacion`, se importa como **flashcard** (la explicación es el reverso). Lo que exportas se puede reimportar tal cual (materias con "Importar materias", carpetas con "Importar carpeta").

### Importar preguntas desde PDF/Word/TXT o texto pegado

```
Enunciado de la pregunta
A) Opción     (o "A.")
B) Opción
Respuesta: B   (o "Respuesta correcta: B")
Explicación (opcional)
```

Separa cada pregunta con un **renglón en blanco**. También flashcards (`Frente` / `Reverso:`). El modal incluye **prompts listos para copiar** (caso clínico, flashcards) y la opción de **pegar el texto directamente** sin guardar un archivo.

## Arquitectura

```
cerebro-quiz/
├── server/                 # Backend Node (Express + SQLite)
│   ├── env.js              # carga .env en desarrollo (no-op en producción)
│   ├── db/schema.js        # node:sqlite + esquema y migraciones
│   ├── services/authService.js   # cuentas, scrypt, Google, tokens, cookies, requireAuth, invitados
│   ├── index.js            # construye la app y monta los routers (auth, perfil, amigos, grupos, salas, contenido, import/export)
│   └── importar/{extraer,parsear}.js   # importación de archivos/texto por patrones
├── data/
│   ├── json/               # formato de import/export manual (no se auto-importa)
│   └── cerebro.db          # base SQLite (se crea sola; no se versiona)
└── src/                    # Frontend React
    ├── App.jsx, api.js, useContenido.js, index.css
    └── components/         # AuthScreen, Sidebar, Avatar, CuentaScreen, AmigosScreen,
                            # GruposScreen, GrupoScreen, PermisoSelector,
                            # MultijugadorScreen, SalaScreen, HomeScreen, QuizScreen, ...
```

La API REST y el esquema completo están documentados en **`CLAUDE.md`** (§5 y §11). Puntos clave de diseño:

- **Auth** por cookie httpOnly (`sc_token`); contraseñas con scrypt; en la base solo el `sha256` del token; login con Google opcional vía Google Identity Services. `COOKIE_SECURE=1` para HTTPS.
- **Aislamiento por contexto**: `carpetas`/`materias` llevan `usuario_id` y `grupo_id` (NULL = personal).
- **Multijugador en memoria** (sincronizado por sondeo ~1s) ⇒ una sola instancia del backend; un reinicio pierde las salas activas.
- **Dedup** de preguntas por `hash = sha256(tema_id + texto normalizado)`.

## URL y red

La app abre en **`http://studycore.localhost`** (Vite en IPv4 puerto 80; los navegadores resuelven `*.localhost` a la máquina, sin editar el archivo `hosts`). Ese nombre es **solo local**: desde otros dispositivos hay que usar la IP del equipo. Para acceso desde cualquier lugar hay que **hostear** la app (ver `CLAUDE.md` §15).

## Documentación del proyecto

- **`CLAUDE.md`** — contexto canónico: objetivo, arquitectura, esquema de base, endpoints, decisiones y límites.
- **`TASKS.md`** — pendientes, en progreso y completadas.
