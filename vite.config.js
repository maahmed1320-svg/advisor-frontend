import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // your backend port
        changeOrigin: true,
        timeout: 60000,       // 💡 Wait up to 60s for proxy read
        proxyTimeout: 60000,  // 💡 Wait up to 60s for proxy connection
      }
    },
  },
})