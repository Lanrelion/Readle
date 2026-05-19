import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      'pdfjs-dist/build/pdf.worker.min.js': path.resolve(
        'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
})

