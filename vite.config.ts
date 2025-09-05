import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath, URL } from 'node:url'

// LAN HMR pomoc: postavi VITE_DEV_HOST=192.168.x.x prije pokretanja `npm run dev`
// kako bi mobitel mogao stabilno uspostaviti HMR websocket.
const DEV_HOST = process.env.VITE_DEV_HOST

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName:
        process.env.NODE_ENV === 'production'
          ? '[hash:base64:7]'
          : '[name]__[local]__[hash:base64:5]',
    },
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "@/styles" as *;
        `,
      },
    },
  },
  server: {
    host: true,        // sluša na 0.0.0.0 → dostupno s mobitela u istoj mreži
    port: 5177,
    strictPort: true,  // ako je port zauzet, baci grešku (ne mijenja broj porta)
    hmr: DEV_HOST
      ? { host: DEV_HOST, protocol: 'ws', port: 5177 }
      : undefined,
  },
  preview: {
    host: true,
    port: 5177,
    strictPort: true,
  },
})
