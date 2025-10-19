import { useEffect, useRef } from 'react'
import { useAuth } from 'react-oidc-context'
import { logoutToHostedUi, triggerHostedLogoutSilently } from '../../utils/authHelpers'

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minuta

const WINDOW_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'scroll',
  'touchstart',
  'pointerdown',
]

const DOCUMENT_EVENTS: Array<keyof DocumentEventMap> = ['keydown', 'visibilitychange']

/**
 * Globalni handler koji automatski poziva logout nakon neaktivnosti korisnika.
 * Timeout se može podesiti preko VITE_INACTIVITY_LOGOUT_MS env varijable (u ms).
 */
export default function InactivityLogoutHandler() {
  const auth = useAuth()
  const timerRef = useRef<number | undefined>(undefined)
  const hasTriggeredLogoutRef = useRef(false)

  useEffect(() => {
    if (auth.isLoading || auth.activeNavigator || !auth.isAuthenticated) {
      // ako nismo prijavljeni (ili smo usred auth navigacije) ništa ne radimo
      return undefined
    }

    const envTimeout = import.meta.env.VITE_INACTIVITY_LOGOUT_MS
    const parsedTimeout = Number(envTimeout ?? DEFAULT_TIMEOUT_MS)

    if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
      // omogućuje isključivanje time-outa postavljanjem na 0 ili negativnu vrijednost
      return undefined
    }

    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current)
        timerRef.current = undefined
      }
    }

    const scheduleLogout = () => {
      clearTimer()

      timerRef.current = window.setTimeout(() => {
        if (hasTriggeredLogoutRef.current) return
        hasTriggeredLogoutRef.current = true

        const redirectToStart = () => {
          window.location.replace('/')
        }

        const cleanupLocalSession = () => {
          auth
            .removeUser()
            .catch(err => {
              console.error('Greška pri čišćenju lokalne OIDC sesije', err)
            })
        }

        if (import.meta.env.DEV) {
          console.info(
            `[InactivityLogoutHandler] Pokrećem logout nakon ${parsedTimeout} ms neaktivnosti.`
          )
        }

        cleanupLocalSession()

        if (triggerHostedLogoutSilently()) {
          redirectToStart()
          return
        }

        try {
          const result = logoutToHostedUi(auth)
          if (result && typeof result.catch === 'function') {
            result.catch(err => {
              console.error('Neuspješan logoutRedirect nakon neaktivnosti', err)
              redirectToStart()
            })
          }
        } catch (err) {
          console.error('Greška pri pokušaju logouta nakon neaktivnosti', err)
          redirectToStart()
        }
      }, parsedTimeout)
    }

    const handleActivity = () => {
      if (!auth.isAuthenticated) return
      hasTriggeredLogoutRef.current = false
      scheduleLogout()
    }

    scheduleLogout()

    WINDOW_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, handleActivity)
    })

    DOCUMENT_EVENTS.forEach(eventName => {
      document.addEventListener(eventName, handleActivity)
    })

    return () => {
      clearTimer()
      WINDOW_EVENTS.forEach(eventName => {
        window.removeEventListener(eventName, handleActivity)
      })
      DOCUMENT_EVENTS.forEach(eventName => {
        document.removeEventListener(eventName, handleActivity)
      })
    }
  }, [auth])

  return null
}