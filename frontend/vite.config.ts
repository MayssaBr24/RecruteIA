import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// Configuration Vite avec proxy vers le backend Django
export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 3000,
        // Proxy pour éviter les problèmes CORS en développement
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',                changeOrigin: true,
                secure: false,
            }
        }
    }
})
