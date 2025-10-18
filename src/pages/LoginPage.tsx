import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import exitIcon from '../assets/exit.svg'
import googleLogo from '../assets/google-logo.svg'
// import appleLogo from '../assets/apple-logo.svg'
// import facebookLogo from '../assets/facebook-logo.svg'
import ResponsivePage from '../components/ResponsivePage/ResponsivePage'
import styles from './LoginPage.module.scss'
import { DEFAULT_POST_LOGIN_ROUTE, POST_LOGIN_REDIRECT_KEY } from '../config/authRedirect'

export default function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')

  // If user is already authenticated, redirect them
  // useEffect(() => {
  //   if (auth.isAuthenticated) {
  //     window.location.href = '/logged-in'
  //   }
  // }, [auth.isAuthenticated])

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated) {
      return
    }

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

    navigate(redirectTarget, { replace: true })
  }, [auth.isAuthenticated, auth.isLoading, navigate])

  const loginWithGoogle = () => {
    auth.signinRedirect({
      extraQueryParams: {
        identity_provider: 'Google' 
      }
    }).catch((error: unknown) => {
      console.error('Google signin failed:', error)
    })
  }

  // const loginWithApple = () => {
  //   auth.signinRedirect({
  //     extraQueryParams: { 
  //       identity_provider: 'SignInWithApple' 
  //     }
  //   }).catch((error: unknown) => {
  //     console.error('Apple signin failed:', error)
  //   })
  // }

  // const loginWithFacebook = () => {
  //   auth.signinRedirect({
  //     extraQueryParams: { 
  //       identity_provider: 'Facebook' 
  //     }
  //   }).catch((error: unknown) => {
  //     console.error('Facebook signin failed:', error)
  //   })
  // }

  return (
    <ResponsivePage
      className={styles.page}
      bodyClassName={styles.body}
      contentClassName={styles.loginPage}
      header={
        <div className={styles.chromeBar}>
          <button className={styles.backButton} onClick={() => (window.location.href = '/')}>
            <img src={exitIcon} alt="Exit" className={styles.exitIcon} />
          </button>
          <img src={logo} alt="Fitspace" className={styles.logo} />
        </div>
      }
    >
      <div className={styles.canvas}>
        {/* Error banner ostaje u canvasu */}
        {error && (
          <div className={styles.errorBanner}>
            <span className={styles.errorIcon}>⚠️</span>
            <span className={styles.errorText}>Authentication failed. Please try again.</span>
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
              <button type="button" className={styles.socialButton} onClick={loginWithGoogle}>
                <img src={googleLogo} alt="Google" className={styles.socialIcon} />
                <span className={styles.socialLabel}>Log in with Google</span>
              </button>

              {/* privremeni spacer */}
              <div className={styles.futureButtonsSpacer} aria-hidden="true" />
         
              {/* <button 
                type="button" 
                className={styles.socialButton} 
                onClick={loginWithApple}
              >
                <img src={appleLogo} alt="Apple" className={styles.socialIconApple} />
                <span className={styles.socialLabel}>Log in with Apple</span>
              </button>
              
              <button
                type="button"
                className={`${styles.socialButton} ${styles.socialButtonLast}`}
                onClick={loginWithFacebook}
              >
                <img src={facebookLogo} alt="Facebook" className={styles.socialIcon} />
                <span className={styles.socialLabel}>Log in with Facebook</span>
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </ResponsivePage>
  )
}