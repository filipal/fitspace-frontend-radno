import { useAuth } from 'react-oidc-context'
import { useSearchParams } from 'react-router-dom'
import { loginWithGoogle /* , loginWithApple, loginWithFacebook */ } from '../utils/authHelpers'
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import exitIcon from '../assets/exit.svg'
import googleLogo from '../assets/google-logo.svg'
// import appleLogo from '../assets/apple-logo.svg'
// import facebookLogo from '../assets/facebook-logo.svg'
import styles from './LoginPage.module.scss'

export default function LoginPage() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')

  // spriječi dvostruke klikove tijekom redirecta
  const isBusy = auth.isLoading || auth.activeNavigator === 'signinRedirect'

  // (opcionalno) kamo se vraćamo nakon login-a
  const returnUrlState = { state: { returnUrl: '/logged-in' } }

  // GOOGLE — koristi helper (koji interno radi auth.signinRedirect).
  const handleGoogle = () =>
    loginWithGoogle(auth, returnUrlState).catch((e) => {
      console.error('Google signin failed:', e)
      // pokaži banner preko ?error=1
      const url = new URL(window.location.href)
      url.searchParams.set('error', '1')
      window.history.replaceState({}, '', url.toString())
    })

  // // ostavi za kasnije
  // const handleApple = () => loginWithApple(auth, returnUrlState)
  // const handleFacebook = () => loginWithFacebook(auth, returnUrlState)

  // Ako želiš auto-redirect kad je user već ulogiran, otkomentiraj:
  // useEffect(() => {
  //   if (auth.isAuthenticated) {
  //     window.location.href = '/logged-in'
  //   }
  // }, [auth.isAuthenticated])

  return (
    <div className={styles.loginPage}>
      <div className={styles.canvas}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => (window.location.href = '/')}
        >
          <img src={exitIcon} alt="Exit" className={styles.exitIcon} />
        </button>

        <img src={logo} alt="Fitspace" className={styles.logo} />

        {/* Error Banner (kolegina novina) */}
        {errorParam && (
          <div className={styles.errorBanner}>
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorText}>
              Authentication failed. Please try again.
            </span>
          </div>
        )}

        <div className={styles.webPanel}>
          <div className={styles.loginBg} />

          <button
            type="button"
            className={styles.createButton}
            onClick={() => (window.location.href = '/avatar-info')}
          >
            Create Your Digital Twin
          </button>

          <div className={styles.loginFormSection}>
            <span className={styles.introText}>
              If you already have a Fitspace avatar, log in to load it:
            </span>

            <div className={styles.loginForm}>
              <button
                type="button"
                className={styles.socialButton}
                onClick={handleGoogle}
                disabled={isBusy}
                aria-busy={isBusy}
              >
                <img src={googleLogo} alt="Google" className={styles.socialIcon} />
                <span className={styles.socialLabel}>Log in with Google</span>
              </button>

              {/*
              <button
                type="button"
                className={styles.socialButton}
                onClick={handleApple}
                disabled={isBusy}
              >
                <img src={appleLogo} alt="Apple" className={styles.socialIconApple} />
                <span className={styles.socialLabel}>Log in with Apple</span>
              </button>

              <button
                type="button"
                className={`${styles.socialButton} ${styles.socialButtonLast}`}
                onClick={handleFacebook}
                disabled={isBusy}
              >
                <img src={facebookLogo} alt="Facebook" className={styles.socialIcon} />
                <span className={styles.socialLabel}>Log in with Facebook</span>
              </button>
              */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
