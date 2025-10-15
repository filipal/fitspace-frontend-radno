import { useAuth } from "react-oidc-context"
import { useEffect, useState } from "react"
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import styles from './AuthCallback.module.scss'

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
      
      // Add a small delay to ensure tokens are stored
      setHasRedirected(true)
      setTimeout(() => {
        console.log('Redirecting to /logged-in')
        window.location.replace('/logged-in')
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