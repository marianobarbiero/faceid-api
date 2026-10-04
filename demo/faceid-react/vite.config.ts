import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// Headers required for SharedArrayBuffer (MediaPipe WASM)
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
  css: { devSourcemap: false },
  server: {
    host: true,
    allowedHosts,
    headers: crossOriginHeaders,
    proxy: apiProxy,
  },
  preview: {
    host: true,
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
