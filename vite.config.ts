import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath, URL } from 'node:url'

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
    // Ako HMR ne “pogađa” mobitel, odkomentiraj i upiši svoj LAN IP:
    // hmr: { host: '192.168.50.114', protocol: 'ws', port: 5177 },
  },
  preview: {
    host: true,
    port: 5177,
    strictPort: true,
  },
})