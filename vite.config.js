import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // La app abre en http://studycore.localhost (los navegadores resuelven
    // cualquier *.localhost al equipo, sin tocar el archivo hosts).
    // Se fija a IPv4 loopback para que coincida con cómo el navegador resuelve
    // *.localhost (127.0.0.1).
    host: '127.0.0.1',
    port: 80,
    allowedHosts: ['studycore.localhost'],
    // Reenvía las llamadas a la API hacia el backend SQLite (server/index.js).
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
