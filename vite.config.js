import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || (() => {
    try {
      return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim()
    } catch {
      return 'local'
    }
  })()

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      devOptions: {
        enabled: false // Disabled: Dev mode uses unbundled ES modules which cannot be reliably cached offline.
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mjs}']
      },
      manifest: {
        name: 'Garder: Offline Reading & Book Tracking',
        short_name: 'Garder',
        description: 'A quiet, offline-first PWA for reading EPUB/PDFs and tracking your physical book collection.',
        theme_color: '#F5F1E8',
        background_color: '#FFFFFF',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
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

