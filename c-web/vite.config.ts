import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Reuse the shared Laravel environment where the existing browser-restricted
  // Google Maps key is configured. Vite exposes only variables prefixed VITE_.
  envDir: '../server-app',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
