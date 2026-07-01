import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'd238-196-229-18-5.ngrok-free.app',
      'a1e7-196-229-18-5.ngrok-free.app',
      '.ngrok-free.app',
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})
