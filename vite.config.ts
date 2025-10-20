// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath, URL } from 'node:url'

const DEV_HOST = process.env.VITE_DEV_HOST

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },

  // ⬅︎ OVDJE ostavi svoj postojeći css blok ako ga koristiš
  // css: { ... },

  server: {
    host: true,
    port: 5177,
    strictPort: true,
    allowedHosts: true, // dopušta bilo koji quick-tunnel host u devu
    hmr: DEV_HOST ? { host: DEV_HOST, protocol: 'ws', port: 5177 } : undefined,

    // Proxy: front → https://<tunnel>/api → http://localhost:8080/api
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  preview: { host: true, port: 5177, strictPort: true },
})
