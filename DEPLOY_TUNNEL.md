# Publicar con Cloudflare Quick Tunnel

Expone la API y la demo React desde tu PC con **una sola URL pública**, sin cuenta de Cloudflare.

```
Internet ──► https://xxxx.trycloudflare.com
                │  (cloudflared)
                ▼
         vite preview :4173  ── sirve el build de demo/faceid-react
                │  /api/*  (proxy, se quita el prefijo /api)
                ▼
         uvicorn app.main:app  127.0.0.1:8000  (--workers 1)
```

El backend escucha solo en `127.0.0.1`: desde afuera únicamente se llega a él a través de `/api` en el frontend.

## Avisos importantes

- **La URL cambia en cada reinicio.** Los Quick Tunnels generan un subdominio aleatorio de `trycloudflare.com` cada vez que arranca `cloudflared`. Si necesitás una URL fija, hace falta un túnel con nombre (requiere cuenta y dominio).
- **La PC tiene que estar prendida** (y sin suspenderse) con el script corriendo. Si se apaga, se duerme o se corta Internet, el sitio deja de responder.
- **La API key queda visible en el frontend.** `VITE_API_KEY` se incrusta en el JavaScript compilado y cualquiera que abra la página puede leerla con las herramientas del navegador. Usá una key exclusiva para esta demo, no la reutilices en otro lado y cambiala (en los dos `.env`) cuando termines de compartir el link.
- Los Quick Tunnels están pensados para pruebas y demos: no tienen SLA ni garantías de disponibilidad.

## Requisitos

- Python 3.11 con el virtualenv del proyecto (`.venv`) y `pip install -r requirements.txt`.
- Node.js 20+ y npm (`npm ci` en `demo/faceid-react`; el script lo hace si falta `node_modules`).
- Unos 3–4 GB de RAM libres para DeepFace.
- `cloudflared`:

| Sistema | Instalación |
|---|---|
| macOS | `brew install cloudflared` |
| Windows | `winget install --id Cloudflare.cloudflared` (cerrá y abrí la terminal después) |
| Linux (Debian/Ubuntu) | descargá el `.deb` de <https://github.com/cloudflare/cloudflared/releases/latest> y `sudo dpkg -i cloudflared-linux-amd64.deb` |

Verificá con `cloudflared --version`.

## Configuración de los `.env`

Las dos keys **tienen que ser iguales**: el frontend manda `VITE_API_KEY` en el header `X-API-Key` y el backend la compara con `API_KEY`.

1. Generá una key propia (no uses `changeme`):

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. Backend — `.env` en la raíz del repo (copiá `.env.example`):

   ```env
   API_KEY=<tu-key>
   ADMIN_API_KEY=<otra-key-distinta>
   ```

   `ADMIN_API_KEY` habilita el backoffice. Tiene que ser **distinta** de `API_KEY` y **no** va en el `.env` del frontend: se ingresa a mano en la pantalla de login. Si la dejás vacía, el backoffice queda deshabilitado.

3. Frontend — `demo/faceid-react/.env` (copiá `demo/faceid-react/.env.example`):

   ```env
   VITE_API_URL=/api
   VITE_API_KEY=<tu-key>
   ```

   El script compila igual con `VITE_API_URL=/api` aunque el `.env` diga otra cosa, pero dejarlo así evita confusiones.

### Hosts permitidos

`vite preview` solo acepta requests cuyo `Host` esté permitido. `*.trycloudflare.com` ya está incluido en `vite.config.ts`. Si querés sumar otros (por ejemplo un dominio propio), pasalos separados por coma:

```bash
ALLOWED_HOSTS=demo.midominio.com,otro.host ./scripts/tunnel.sh
```

## Arrancar

### macOS / Linux / Git Bash en Windows

```bash
./scripts/tunnel.sh
```

El script:

1. levanta el backend en `127.0.0.1:8000` con 1 worker;
2. compila el frontend con `VITE_API_URL=/api`;
3. sirve el build con `vite preview` en el puerto 4173;
4. espera a que `/health` responda (el primer arranque puede tardar porque DeepFace descarga y carga los modelos);
5. abre el túnel e imprime la URL pública.

Los logs quedan en `logs/backend.log`, `logs/frontend.log` y `logs/tunnel.log`. Con **Ctrl+C** se cortan todos los procesos.

### Windows (PowerShell)

Abrí **tres terminales** en la raíz del repo.

Terminal 1 — backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Terminal 2 — frontend (esperá a que el backend muestre `Application startup complete`):

```powershell
cd demo\faceid-react
$env:VITE_API_URL = '/api'
npm run build
npx vite preview --port 4173 --strictPort
```

Para hosts extra: `$env:ALLOWED_HOSTS = 'demo.midominio.com'` antes de `npx vite preview`.

Terminal 3 — verificar y abrir el túnel:

```powershell
Invoke-RestMethod http://127.0.0.1:4173/api/health   # debe devolver status = ok
cloudflared tunnel --no-autoupdate --url http://localhost:4173
```

`cloudflared` imprime la URL (`https://<algo>.trycloudflare.com`) en un recuadro. Para cortar, Ctrl+C en cada terminal.

## Verificar

```bash
curl https://<tu-subdominio>.trycloudflare.com/api/health
# {"status":"ok"}
```

Después abrí la URL en el navegador. La cámara funciona porque el túnel sirve por HTTPS.

## Backoffice

`https://<tu-subdominio>.trycloudflare.com/back` muestra los usuarios registrados (foto, nombre, email, ID externo, estado y fecha), con búsqueda y paginado. No aparece en el menú de la demo. Pide la `ADMIN_API_KEY`, que queda guardada solo en esa pestaña del navegador hasta que la cierres o toques "Salir".
