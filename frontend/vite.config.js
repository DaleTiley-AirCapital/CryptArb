import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/status': 'http://localhost:8000',
      '/start': 'http://localhost:8000',
      '/stop': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/floats': 'http://localhost:8000',
      '/config': 'http://localhost:8000',
      '/health': 'http://localhost:8000'
    }
  }
})
