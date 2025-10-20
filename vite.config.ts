// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath, URL } from 'node:url'

const DEV_HOST = process.env.VITE_DEV_HOST

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  css: { /* ...tvoj postojeći css blok... */ },
  server: {
    host: true,
    port: 5177,
    strictPort: true,
    allowedHosts: true,                 // ⬅︎ dopušta quick-tunnel host bez editiranja env-a
    hmr: DEV_HOST ? { host: DEV_HOST, protocol: 'ws', port: 5177 } : undefined,
  },
  preview: { host: true, port: 5177, strictPort: true },
})
