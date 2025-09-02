import { useAuth } from "react-oidc-context"
import logo from '../assets/Fitspace-logo-gradient-nobkg.svg'
import exitIcon from '../assets/exit.svg'
import googleLogo from '../assets/google-logo.svg'
import appleLogo from '../assets/apple-logo.svg'
import facebookLogo from '../assets/facebook-logo.svg'
import styles from './LoginPage.module.scss'

export default function LoginPage() {
  const auth = useAuth()
  const params = new URLSearchParams(window.location.search)
  const isCallback = params.has('code') || params.has('error')

  // AuthProvider handles the OIDC redirect callback via onSigninCallback in src/main.tsx.
  // If Cognito omits the `state` parameter, signin processing will fail with "No state in response".


  if (isCallback) {
    // Temporary debug UI to inspect callback params and auth state
    const debugInfo = (() => {
      try {
        const authInfo = {
          isLoading: auth?.isLoading,
          isAuthenticated: auth?.isAuthenticated,
          error: auth?.error ? auth.error.message : null,
          // don't expand full user object to avoid leaking tokens
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          user: auth?.user ? { id: (auth.user as any)?.profile?.sub ?? (auth.user as any)?.id ?? null, profile: (auth.user as any)?.profile ?? null } : null,
        }

        return JSON.stringify({ href: window.location.href, params: Object.fromEntries(params.entries()), auth: authInfo }, null, 2)
      } catch (e) {
        return `debug stringify error: ${String(e)}`
      }
    })()

    return (
      <div>
        <p>Processing login...</p>
        <div style={{ marginTop: 12 }}>
          <strong>Debug</strong>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12, borderRadius: 6, maxHeight: 400, overflow: 'auto' }}>{debugInfo}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.loginPage}>
      <button className={styles.backButton} onClick={() => window.location.href = '/'}>
        <img src={exitIcon} alt="Exit" className={styles.exitIcon} />
      </button>

      <img src={logo} alt="Fitspace" className={styles.logo} />

      <div className={styles.webPanel}>
        <div className={styles.loginBg} />

        <button
          type="button"
          className={styles.createButton}
          onClick={() => window.location.href = '/avatar-info'}
        >
          Create Your Digital Twin
        </button>

        <div className={styles.loginFormSection}>
          <span className={styles.introText}>
            If you already have a Fitspace avatar, log in to load it:
          </span>

          <div className={styles.loginForm}>
            <button type="button" className={styles.socialButton} onClick={() =>
              (auth.signinRedirect ? auth.signinRedirect().catch(e => console.error('signinRedirect failed', e)) : console.warn('signinRedirect not available', auth))
            }>
              <img src={googleLogo} alt="Google" className={styles.socialIcon} />
              <span className={styles.socialLabel}>Log in with Google</span>
            </button>
            <button type="button" className={styles.socialButton} onClick={() =>
              (auth.signinRedirect ? auth.signinRedirect().catch(e => console.error('signinRedirect failed', e)) : console.warn('signinRedirect not available', auth))
            }>
              <img src={appleLogo} alt="Apple" className={styles.socialIconApple} />
              <span className={styles.socialLabel}>Log in with Apple</span>
            </button>
            <button
              type="button"
              className={`${styles.socialButton} ${styles.socialButtonLast}`}
              onClick={() =>
                (auth.signinRedirect ? auth.signinRedirect().catch(e => console.error('signinRedirect failed', e)) : console.warn('signinRedirect not available', auth))
              }
            >
              <img src={facebookLogo} alt="Facebook" className={styles.socialIcon} />
              <span className={styles.socialLabel}>Log in with Facebook</span>
            </button>
          </div>
          {auth.isLoading && <p>Učitavanje...</p>}
          {auth.error && <p style={{ color: "red" }}>Greška: {auth.error.message}</p>}
        </div>
      </div>
    </div>
  )
}