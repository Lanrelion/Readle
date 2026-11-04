import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Automatically unregister stale Service Workers and clear caches in dev mode
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

import { registerSW } from 'virtual:pwa-register'

// Register the PWA Service Worker in production
if (!import.meta.env.DEV) {
  const updateSW = registerSW({
    onNeedRefresh() {
      window.__garderUpdateSW = () => updateSW(true)
      window.dispatchEvent(new CustomEvent('garder-update-ready', {
        detail: { applyUpdate: () => updateSW(true) },
      }))
    },
    onOfflineReady() {
      console.log('[App] App is ready to work offline.')
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return

      const checkForUpdate = () => {
        if (navigator.onLine) registration.update().catch(() => {})
      }
      window.setInterval(checkForUpdate, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
    },
  })
  window.__garderUpdateSW = () => updateSW(true)
}

