import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from 'react-oidc-context'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import exitIcon from '../assets/exit.svg'
import googleLogo from '../assets/google-logo.svg'
// import appleLogo from '../assets/apple-logo.svg'
// import facebookLogo from '../assets/facebook-logo.svg'
import ResponsivePage from '../components/ResponsivePage/ResponsivePage'
import styles from './LoginPage.module.scss'
import { DEFAULT_POST_LOGIN_ROUTE, POST_LOGIN_REDIRECT_KEY } from '../config/authRedirect'

const MOBILE_DESIGN_HEIGHT = 932
const MOBILE_SAFE_VISIBLE_HEIGHT = 658
const MIN_DENSITY_SCALE = 0.55
const MIN_GAP_SCALE = 0.55
const MIN_TOP_SCALE = 0.65
const MIN_BG_SCALE = 0.6

interface ViewportSize {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type LoginPageCssVars = CSSProperties & {
  '--fs-design-height'?: string
  '--fs-design-safe-height'?: string
  '--login-density'?: string
  '--login-gap-scale'?: string
  '--login-top-scale'?: string
  '--login-bg-scale'?: string
}

function readViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 430, height: MOBILE_SAFE_VISIBLE_HEIGHT }
  }

  const viewport = window.visualViewport
  if (viewport) {
    return { width: viewport.width, height: viewport.height }
  }

  return { width: window.innerWidth, height: window.innerHeight }
}

export default function LoginPage() {
  const [{ height: viewportHeight }, setViewportSize] = useState<ViewportSize>(
    () => readViewportSize()
  )
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const error = searchParams.get('error')
  const locationState = location.state as { allowAuthenticated?: boolean } | null
  const allowAuthenticatedAccess = Boolean(locationState?.allowAuthenticated)

  // If user is already authenticated, redirect them
  // useEffect(() => {
  //   if (auth.isAuthenticated) {
  //     window.location.href = '/logged-in'
  //   }
  // }, [auth.isAuthenticated])
  useEffect(() => {
    const handleResize = () => {
      setViewportSize(readViewportSize())
    }

    window.addEventListener('resize', handleResize)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      viewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  const layoutVars = useMemo<LoginPageCssVars>(() => {
    const densityBase = viewportHeight / MOBILE_SAFE_VISIBLE_HEIGHT
    const density = clamp(densityBase, MIN_DENSITY_SCALE, 1)
    const gapScale = clamp(density, MIN_GAP_SCALE, 1)
    const topScale = clamp(density + 0.08, MIN_TOP_SCALE, 1)
    const bgScale = clamp(density + 0.1, MIN_BG_SCALE, 1)

    const designSafeHeight = MOBILE_SAFE_VISIBLE_HEIGHT / density

    return {
      '--fs-design-height': `${MOBILE_DESIGN_HEIGHT}px`,
      '--fs-design-safe-height': `${designSafeHeight.toFixed(2)}px`,
      '--login-density': density.toFixed(3),
      '--login-gap-scale': gapScale.toFixed(3),
      '--login-top-scale': topScale.toFixed(3),
      '--login-bg-scale': bgScale.toFixed(3)
    }
  }, [viewportHeight])

  useEffect(() => {
    if (allowAuthenticatedAccess) {
      return
    }

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
  }, [allowAuthenticatedAccess, auth.isAuthenticated, auth.isLoading, navigate])

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
      style={layoutVars}
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