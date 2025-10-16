import { useAuth } from "react-oidc-context"
import { useEffect, useState } from "react"
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import styles from './AuthCallback.module.scss'
import {
  DEFAULT_POST_LOGIN_ROUTE,
  GUEST_AVATAR_NAME_KEY,
  POST_LOGIN_REDIRECT_KEY,
} from '../config/authRedirect'

export default function AuthCallback() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // Wait for auth to finish loading
    if (auth.isLoading) {
      console.log('Auth is still loading...')
      return
    }

    // If authentication is successful AND we haven't redirected yet
    if (auth.isAuthenticated && !hasRedirected) {
      console.log('Authentication successful!')
      console.log('User:', auth.user)

      let redirectTarget = DEFAULT_POST_LOGIN_ROUTE

      try {
        const storedRedirect = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)
        if (storedRedirect) {
          redirectTarget = storedRedirect
          sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
        }
      } catch (err) {
        console.warn('Failed to read stored redirect target', err)
      }

      try {
        const savedName = sessionStorage.getItem(GUEST_AVATAR_NAME_KEY)?.trim()
        if (savedName) {
          const pendingRaw = localStorage.getItem('pendingAvatarData')
          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw) as {
              type?: string
              data?: { avatarName?: string }
            } | null
            if (pending?.type === 'createAvatar' && pending.data && typeof pending.data === 'object') {
              const updated = { ...pending, data: { ...pending.data, avatarName: savedName } }
              localStorage.setItem('pendingAvatarData', JSON.stringify(updated))
            }
          }
        }
      } catch (err) {
        console.warn('Failed to apply guest avatar name after login', err)
      }

      // Add a small delay to ensure tokens are stored
      setHasRedirected(true)
      setTimeout(() => {
        console.log('Redirecting to', redirectTarget)
        window.location.replace(redirectTarget)
      }, 500) // 500ms delay to ensure storage completes
    }
    
    // If there's an error
    if (auth.error) {
      console.error('Authentication error:', auth.error)
      setError(auth.error.message)
      
      setTimeout(() => {
        window.location.replace('/login?error=auth_failed')
      }, 3000)
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.error, auth.user, hasRedirected])

  // Show error state
  if (error) {
    return (
      <div className={styles.callbackPage}>
        <div className={styles.container}>
          <img src={logo} alt="Fitspace" className={styles.logo} />
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>⚠️</div>
            <h2 className={styles.errorTitle}>Authentication Failed</h2>
            <p className={styles.errorMessage}>{error}</p>
            <p className={styles.redirectMessage}>Redirecting to login page...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state
  return (
    <div className={styles.callbackPage}>
      <div className={styles.container}>
        <img src={logo} alt="Fitspace" className={styles.logo} />
        <div className={styles.spinnerContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Completing sign-in...</p>
          <p className={styles.subText}>Please wait while we log you in</p>
        </div>
      </div>
    </div>
  )
}