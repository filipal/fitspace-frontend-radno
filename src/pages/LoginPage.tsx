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

const MOBILE_DESIGN_WIDTH = 430
const MOBILE_DESIGN_HEIGHT = 932
const TOP_SPACER_HEIGHT = 60
const GAP_SEGMENTS_HEIGHT = 18 + 35 + 28 + 15 + 15 + 142 + 21
const BACKGROUND_SEGMENT_HEIGHT = 386
// Sum of all “compressible” vertical segments (spacings, loginBg, etc.)
const FLEXIBLE_DESIGN_HEIGHT =
  TOP_SPACER_HEIGHT + GAP_SEGMENTS_HEIGHT + BACKGROUND_SEGMENT_HEIGHT
const STATIC_DESIGN_HEIGHT = MOBILE_DESIGN_HEIGHT - FLEXIBLE_DESIGN_HEIGHT
const MIN_DENSITY_SCALE = 0.55
const MIN_GAP_SCALE = 0.6
const MIN_TOP_SCALE = 0.7
const MIN_BG_SCALE = 0.6
const MOBILE_SAFE_VISIBLE_HEIGHT =
  STATIC_DESIGN_HEIGHT +
  TOP_SPACER_HEIGHT * MIN_TOP_SCALE +
  GAP_SEGMENTS_HEIGHT * MIN_GAP_SCALE +
  BACKGROUND_SEGMENT_HEIGHT * MIN_BG_SCALE

interface ViewportSize {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

type SegmentKey = 'top' | 'gap' | 'bg'

interface SegmentDefinition {
  key: SegmentKey
  base: number
  minScale: number
  shrinkWeight: number
}

interface SegmentState extends SegmentDefinition {
  scale: number
}

interface LayoutMetrics {
  topScale: number
  gapScale: number
  bgScale: number
  designHeight: number
}

const FLEXIBLE_SEGMENTS: readonly SegmentDefinition[] = [
  { key: 'top', base: TOP_SPACER_HEIGHT, minScale: MIN_TOP_SCALE, shrinkWeight: 0.9 },
  { key: 'gap', base: GAP_SEGMENTS_HEIGHT, minScale: MIN_GAP_SCALE, shrinkWeight: 1 },
  {
    key: 'bg',
    base: BACKGROUND_SEGMENT_HEIGHT,
    minScale: MIN_BG_SCALE,
    shrinkWeight: 1.2
  }
]

const FULL_FLEXIBLE_HEIGHT = FLEXIBLE_SEGMENTS.reduce(
  (sum, segment) => sum + segment.base,
  0
)

const MIN_FLEXIBLE_HEIGHT = FLEXIBLE_SEGMENTS.reduce(
  (sum, segment) => sum + segment.base * segment.minScale,
  0
)

function computeLayoutMetrics(viewportHeight: number): LayoutMetrics {
  const targetFlexibleHeight = clamp(
    viewportHeight - STATIC_DESIGN_HEIGHT,
    MIN_FLEXIBLE_HEIGHT,
    FULL_FLEXIBLE_HEIGHT
  )

  const workingSegments: SegmentState[] = FLEXIBLE_SEGMENTS.map((segment) => ({
    ...segment,
    scale: 1
  }))

  let currentFlexibleHeight = FULL_FLEXIBLE_HEIGHT

  for (let iteration = 0; iteration < 8; iteration += 1) {
    if (currentFlexibleHeight <= targetFlexibleHeight + 0.01) {
      break
    }

    const shrinkable = workingSegments.filter(
      (segment) => segment.scale > segment.minScale + 0.0001
    )

    if (shrinkable.length === 0) {
      break
    }

    const totalWeightedCapacity = shrinkable.reduce((sum, segment) => {
      const capacity = (segment.scale - segment.minScale) * segment.base
      return sum + capacity * segment.shrinkWeight
    }, 0)

    if (totalWeightedCapacity <= 0) {
      break
    }

    const excess = currentFlexibleHeight - targetFlexibleHeight
    let consumedHeight = 0

    shrinkable.forEach((segment) => {
      const capacity = (segment.scale - segment.minScale) * segment.base
      if (capacity <= 0) {
        return
      }

      const weightedCapacity = capacity * segment.shrinkWeight
      const shrinkHeight = Math.min(
        capacity,
        (excess * weightedCapacity) / totalWeightedCapacity
      )

      if (shrinkHeight <= 0) {
        return
      }

      segment.scale -= shrinkHeight / segment.base
      consumedHeight += shrinkHeight
    })

    if (consumedHeight <= 0.001) {
      break
    }

    currentFlexibleHeight -= consumedHeight
  }

  let flexibleHeight = 0
  let topScale = MIN_TOP_SCALE
  let gapScale = MIN_GAP_SCALE
  let bgScale = MIN_BG_SCALE

  workingSegments.forEach((segment) => {
    const finalScale = clamp(segment.scale, segment.minScale, 1)
    flexibleHeight += segment.base * finalScale

    switch (segment.key) {
      case 'top':
        topScale = finalScale
        break
      case 'gap':
        gapScale = finalScale
        break
      case 'bg':
        bgScale = finalScale
        break
    }
  })

  const designHeight = STATIC_DESIGN_HEIGHT + flexibleHeight

  return {
    topScale,
    gapScale,
    bgScale,
    designHeight
  }
}

type LoginPageCssVars = CSSProperties & {
  '--fs-design-height'?: string
  '--fs-design-safe-height'?: string
  '--fs-viewport-height'?: string
  '--fs-scale-width'?: string
  '--fs-scale-height'?: string
  '--fs-scale'?: string
  '--fs-canvas-width'?: string
  '--fs-canvas-height'?: string
  '--fs-page-max-height'?: string
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
  const [viewportSize, setViewportSize] = useState<ViewportSize>(() => readViewportSize())
  const { width: viewportWidth, height: viewportHeight } = viewportSize
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

  const { cssVars: layoutVars, canvasHeight } = useMemo(() => {
    const { topScale, gapScale, bgScale, designHeight } = computeLayoutMetrics(
      viewportHeight
    )

    const density = clamp(
      viewportHeight / MOBILE_SAFE_VISIBLE_HEIGHT,
      MIN_DENSITY_SCALE,
      1
    )

    const scaleWidth = clamp(
      viewportWidth / MOBILE_DESIGN_WIDTH,
      0,
      Number.POSITIVE_INFINITY
    )

    const scaleHeight = designHeight > 0
      ? clamp(viewportHeight / designHeight, 0, Number.POSITIVE_INFINITY)
      : 1

    const viewportScale = Math.min(scaleWidth, scaleHeight, 1)
    const canvasWidth = MOBILE_DESIGN_WIDTH * viewportScale
    const canvasHeight = designHeight * viewportScale
    const pageMaxHeight = Math.min(canvasHeight, viewportHeight)
  
    const cssVars: LoginPageCssVars = {
      '--fs-design-height': `${designHeight.toFixed(3)}px`,
      '--fs-design-safe-height': `${designHeight.toFixed(3)}px`,
      '--fs-viewport-height': `${viewportHeight.toFixed(3)}px`,
      '--fs-scale-width': scaleWidth.toFixed(5),
      '--fs-scale-height': scaleHeight.toFixed(5),
      '--fs-scale': viewportScale.toFixed(5),
      '--fs-canvas-width': `${canvasWidth.toFixed(3)}px`,
      '--fs-canvas-height': `${canvasHeight.toFixed(3)}px`,
      '--fs-page-max-height': `${pageMaxHeight.toFixed(3)}px`,
      '--login-density': density.toFixed(3),
      '--login-gap-scale': gapScale.toFixed(3),
      '--login-top-scale': topScale.toFixed(3),
      '--login-bg-scale': bgScale.toFixed(3)
    }

    return { cssVars, canvasHeight }
  }, [viewportHeight, viewportWidth])

  const needsScroll = canvasHeight > viewportHeight + 0.5
  const pageClassName = needsScroll
    ? `${styles.page} ${styles.pageScrollable}`
    : styles.page
  
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
      className={pageClassName}
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