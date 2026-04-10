import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,      // required for hot-reload inside Docker on Windows
      interval: 3000,        // 3s instead of default 100ms — prevents spurious reloads from Docker volume events
      binaryInterval: 3000,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
})
