# Desplegar Study Core en Railway — guía paso a paso

App de **una sola instancia** (salas de multijugador en memoria + SQLite de un
escritor). En código ya está todo listo (Fase 7): Express sirve el build, `trust
proxy`, pragmas, apagado limpio, ruta de BD por env y `railway.json` con
`numReplicas: 1`. Aquí van los pasos manuales.

---

## 0. Antes de empezar

- Cuenta en **https://railway.app** (con GitHub conectado, recomendado).
- El proyecto ya trae:
  - `railway.json` → build `npm run build`, start `npm start`, **1 réplica**.
  - `package.json` → `"engines": { "node": ">=22.5.0" }` (clave: `node:sqlite`
    necesita Node ≥ 22.5; sin esto el deploy falla).
  - Express sirve `dist/` si existe (lo genera `npm run build`).

---

## 1. Subir el código a GitHub (recomendado)

El repo local aún **no** es un repositorio git. Desde `cerebro-quiz/`:

```bash
git init
git add .
git commit -m "Study Core listo para producción (Fase 7)"
# crea un repo vacío en github.com (p. ej. study-core) y luego:
git remote add origin https://github.com/<tu-usuario>/study-core.git
git branch -M main
git push -u origin main
```

`.gitignore` ya excluye `node_modules/`, `dist/` y la base `data/cerebro.db`
(no se sube tu BD local; producción arranca con BD propia — ver paso 6).

> **Alternativa sin GitHub (Railway CLI):** instala `npm i -g @railway/cli`,
> luego `railway login`, `railway init` y `railway up` desde la carpeta. El resto
> de pasos (volumen, variables, dominio) es igual desde el panel.

---

## 2. Crear el proyecto en Railway

1. Railway → **New Project** → **Deploy from GitHub repo**.
2. Elige el repo. Railway detecta Node (Nixpacks) y lee `railway.json`.
3. El primer build correrá `npm install` → `npm run build` → `npm start`.
   (Puede fallar la primera vez hasta poner las variables del paso 3; normal.)

---

## 3. Variables de entorno

En el servicio → pestaña **Variables** → añade:

| Variable | Valor | Para qué |
|---|---|---|
| `COOKIE_SECURE` | `1` | Cookie de sesión `Secure` (HTTPS) |
| `DATA_DIR` | `/data` | Carpeta de la BD en el volumen (paso 5) |
| `NODE_ENV` | `production` | Modo producción de Express |
| `NPM_CONFIG_PRODUCTION` | `false` | **Importante**: que se instalen las devDeps (Vite) para poder hacer el build |

No definas `PORT`: Railway lo inyecta solo y el server ya usa `process.env.PORT`.

> Si el build se quejara de la versión de Node, añade también
> `NIXPACKS_NODE_VERSION=22` (o `24`).

---

## 4. Una sola instancia

Ya viene en `railway.json` (`numReplicas: 1`). Verifícalo en
**Settings → Deploy → Replicas = 1**. **No** lo subas: las salas viven en memoria
y SQLite admite un solo escritor; con 2+ réplicas se rompería.

---

## 5. Volumen persistente para SQLite

Sin volumen, la BD se borra en cada deploy. 

1. Servicio → **Variables/Settings → Volumes** → **New Volume**.
2. **Mount path**: `/data` (debe coincidir con `DATA_DIR`).
3. Guarda. La BD vivirá en `/data/cerebro.db` y sobrevive a deploys/reinicios.

---

## 6. Datos: empieza vacío (o migra los tuyos)

- **Por defecto**: producción arranca con una BD nueva y vacía. Crea tus cuentas
  de nuevo desde la app. Lo más simple.
- **(Avanzado) Migrar tu BD local**: en tu equipo, con el server **detenido**,
  copia `data/cerebro.db` al volumen. Vía CLI:
  ```bash
  railway link        # enlaza la carpeta al proyecto/servicio
  # sube el archivo al volumen montado en /data (p. ej. con un shell del servicio
  # o una tarea temporal). Copia cerebro.db; el -wal/-shm no hacen falta si
  # cerraste el server (hace checkpoint del WAL al apagar).
  ```

---

## 7. Dominio y HTTPS

1. Servicio → **Settings → Networking → Generate Domain**.
2. Te da `https://<algo>.up.railway.app` con HTTPS automático.
3. Como `COOKIE_SECURE=1` + `trust proxy` ya están, la sesión funciona sobre HTTPS.
4. (Opcional) **Custom Domain** para tu dominio propio (añade el CNAME que indique).

---

## 8. Desplegar y verificar

1. **Deploy** (se dispara solo al hacer push, o **Deploy** manual).
2. Mira **Deploy Logs**; debe aparecer:
   ```
   [Study Core] Sirviendo build del frontend desde dist/.
   [Study Core] API SQLite escuchando en http://localhost:<PORT>
   ```
3. Abre el dominio. Comprueba: registro/login, crear carpeta/materia/tema/pregunta,
   un quiz, proyectos y una sala de multijugador.

---

## 9. Actualizaciones

Con GitHub: cada `git push` a `main` redepliega. Railway hace el build nuevo,
manda **SIGTERM** al proceso viejo (apagado limpio: cierra la BD con checkpoint)
y arranca el nuevo. La BD persiste en el volumen.

---

## 10. Respaldo de la base (pendiente, recomendado)

La BD vive solo en el volumen. Opciones:
- Descarga periódica de `/data/cerebro.db` (shell del servicio o tarea cron).
- Job que copie el `.db` a un almacenamiento externo (S3, etc.).

---

## Solución de problemas

- **El build falla con "vite: not found"** → falta `NPM_CONFIG_PRODUCTION=false`
  (con `NODE_ENV=production`, npm omite las devDeps donde está Vite).
- **`DatabaseSync is not a constructor` / error de `node:sqlite`** → Node < 22.5.
  Revisa `engines` y/o pon `NIXPACKS_NODE_VERSION=22`.
- **Login no mantiene sesión** → falta `COOKIE_SECURE=1` o el dominio no es HTTPS;
  `trust proxy` ya está en el código.
- **Datos se borran en cada deploy** → falta el **volumen** o `DATA_DIR` no apunta
  a su mount path.
- **Errores raros de concurrencia / `SQLITE_BUSY`** → asegúrate de **1 réplica**.
- **Las salas desaparecen** → es esperado: están en memoria y se pierden en cada
  deploy/reinicio (no se persisten a propósito).
