import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import oidcConfig from './oidcConfig'
import { DEFAULT_POST_LOGIN_ROUTE, POST_LOGIN_REDIRECT_KEY } from './config/authRedirect'
import './index.css'
import App from './App.tsx'

// DEV: osiguraj da nijedan postojeći SW ne ostane aktivan u dev okruženju
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


const extractRedirectFromState = (state: unknown): string | null => {
  if (!state) {
    return null
  }

  if (typeof state === 'string') {
    return state
  }

  if (typeof state === 'object') {
    const maybeReturnUrl = (state as { returnUrl?: unknown }).returnUrl
    if (typeof maybeReturnUrl === 'string') {
      return maybeReturnUrl
    }

    const maybePath = (state as { path?: unknown }).path
    if (typeof maybePath === 'string') {
      return maybePath
    }
  }

  return null
}

const consumeStoredRedirect = () => {
  try {
    const stored = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (stored) {
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
      return stored
    }
  } catch (error) {
    console.warn('Unable to access sessionStorage for post-login redirect', error)
  }

  return null
}

const onSigninCallback = (user?: unknown) => {
  const redirectFromState = extractRedirectFromState((user as { state?: unknown } | null | undefined)?.state)
  const storedRedirect = consumeStoredRedirect()
  const target = redirectFromState || storedRedirect || DEFAULT_POST_LOGIN_ROUTE

  window.history.replaceState({}, document.title, window.location.pathname)
  window.location.replace(target)
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
