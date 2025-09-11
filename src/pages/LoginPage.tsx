import { useAuth } from "react-oidc-context"
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import exitIcon from '../assets/exit.svg'
import googleLogo from '../assets/google-logo.svg'
import appleLogo from '../assets/apple-logo.svg'
import facebookLogo from '../assets/facebook-logo.svg'
import styles from './LoginPage.module.scss'

export default function LoginPage() {
  const auth = useAuth()
  // AuthProvider handles the OIDC redirect callback via onSigninCallback in src/main.tsx.

  return (
    <div className={styles.loginPage}>
      <div className={styles.canvas}>
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
          </div>
        </div>
      </div>
    </div>
  )
}
