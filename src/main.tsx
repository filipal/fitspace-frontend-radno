import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import oidcConfig from './oidcConfig'
import './index.css'
import App from './App.tsx'

// DEV: ukloni sve postojeće SW-ove u dev okruženju (spriječi cache/HMR probleme)
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister().catch(() => {}))
  })
}

/**
 * Registriraj Service Worker samo u produkciji i na sigurnom kontekstu.
 * U developmentu SW zna remetiti Vite HMR i uzrokovati zastarjele CSS/JS datoteke.
 */
(function registerSW() {
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  const isLocalhost =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]'
  const isSecure = location.protocol === 'https:' || isLocalhost
  if (!isSecure) return // npr. LAN IP preko http:// neće raditi na Androidu

  const swUrl = `${import.meta.env.BASE_URL}sw.js` // radi i za subpath deploy
  // Pričekaj load da se sve datoteke posluže
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(err => {
      console.error('Service Worker registration failed:', err)
    })
  })
})()

// Minimalni OIDC callback: očisti URL; redirect rješava <AuthCallback />
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
