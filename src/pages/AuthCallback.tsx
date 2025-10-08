// src/pages/AuthCallback.tsx
import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import styles from './AuthCallback.module.scss'

export default function AuthCallback() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // 1) Pričekaj da završi OIDC handshake
    if (auth.isLoading) return

    // 2) Uspjeh → kratka odgoda da storage sigurno upiše tokene, pa hard-redirect
    if (auth.isAuthenticated && !hasRedirected) {
      setHasRedirected(true)
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.replace('/logged-in')
        }
      }, 500)
      return
    }

    // 3) Greška → pokaži poruku i vrati na /login
    if (auth.error) {
      setError(auth.error.message || 'Authentication failed.')
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.replace('/login?error=auth_failed')
        }
      }, 3000)
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error, hasRedirected])

  // ——— UI: error state ———
  if (error) {
    return (
      <div className={styles.callbackPage}>
        <div className={styles.container} role="status" aria-live="polite" aria-busy="true">
          <img src={logo} alt="Fitspace" className={styles.logo} />
          <div className={styles.card}>
            <div className={styles.errorIcon} aria-hidden="true">⚠️</div>
            <h2 className={styles.title}>Authentication Failed</h2>
            <p className={styles.message}>{error}</p>
            <p className={styles.subtle}>Redirecting to login…</p>
          </div>
        </div>
      </div>
    )
  }

  // ——— UI: loading state ———
  return (
    <div className={styles.callbackPage}>
      <div className={styles.container} role="status" aria-live="polite" aria-busy="true">
        <img src={logo} alt="Fitspace" className={styles.logo} />
        <div className={styles.card}>
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.title}>Completing sign-in…</p>
          <p className={styles.subtle}>Please wait while we log you in</p>
        </div>
      </div>
    </div>
  )
}
