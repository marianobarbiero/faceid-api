import { readFileSync } from 'node:fs'
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// The MediaPipe WASM must match the JS bundled from node_modules; an unversioned CDN URL
// serves the latest release and breaks with a LinkError whenever MediaPipe publishes one
const mediapipeVersion: string = JSON.parse(
  readFileSync(new URL('./node_modules/@mediapipe/tasks-vision/package.json', import.meta.url), 'utf8'),
).version

// Headers required for SharedArrayBuffer (MediaPipe WASM)
// Optional HTTPS for `vite preview` (scripts/tunnel.sh LAN=1 sets these to a self-signed cert):
// phones only allow camera access on secure origins
const https =
  process.env.HTTPS_KEY && process.env.HTTPS_CERT
    ? { key: readFileSync(process.env.HTTPS_KEY), cert: readFileSync(process.env.HTTPS_CERT) }
    : undefined

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const apiProxy: Record<string, ProxyOptions> = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        const apiKey = req.headers['x-api-key'];
        if (apiKey) proxyReq.setHeader('x-api-key', apiKey);
      });
    },
  },
}

// Cloudflare Quick Tunnel hosts plus any extra hosts from ALLOWED_HOSTS (comma-separated)
const allowedHosts = [
  '.trycloudflare.com',
  ...(process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __MEDIAPIPE_VERSION__: JSON.stringify(mediapipeVersion) },
  css: { devSourcemap: false },
  server: {
    host: true,
    allowedHosts,
    headers: crossOriginHeaders,
    proxy: apiProxy,
  },
  preview: {
    host: true,
    https,
    allowedHosts,
    headers: crossOriginHeaders,
    proxy: apiProxy,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  build: {
    sourcemap: false,
  },
})
