import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useInstanceManagement } from '../../context/InstanceManagementContext'

// Stranice na kojima NE želimo prikazati beforeunload prompt
const EXCLUDED_PATHS = ['/login', '/auth/callback', '/exit-guest-user']

const LAMBDA_CLOSE_URL = 'https://hfijogsomw73ojgollhdr75oqq0osdlq.lambda-url.eu-central-1.on.aws/'

/**
 * Logika koja se izvršava kada user pritisne "Leave" i napušta stranicu.
 * Koristi sendBeacon za garantovano slanje podataka čak i kada se stranica zatvara.
 */
const executeOnLeave = (instanceId?: string) => {
  console.log('🚪 User is leaving the site...')
  
  if (!instanceId) {
    console.log('No instance ID found - skipping close signal')
    return
  }

  // Lambda očekuje samo { "instanceId": "i-xxx..." }
  const payload = JSON.stringify({ 
    instanceId
  })

  // Pokušaj 1: sendBeacon (BEST PRACTICE - browser garantuje slanje)
  const blob = new Blob([payload], { type: 'application/json' })
  const beaconSuccess = navigator.sendBeacon(LAMBDA_CLOSE_URL, blob)
  
  if (beaconSuccess) {
    console.log('✅ Close signal sent via sendBeacon')
  } else {
    // Pokušaj 2: Fallback na fetch sa keepalive
    console.warn('⚠️ sendBeacon failed, trying fetch with keepalive...')
    fetch(LAMBDA_CLOSE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch((error) => {
      console.error('❌ Failed to send close signal:', error)
    })
  }
}

export default function BeforeUnloadHandler() {
  const location = useLocation()
  const { instanceData } = useInstanceManagement()
  
  useEffect(() => {
    const shouldShowPrompt = !EXCLUDED_PATHS.includes(location.pathname)
    
    if (!shouldShowPrompt) {
      return undefined
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Prikaži prompt
      event.preventDefault()
      event.returnValue = ''
      
      // NAPOMENA: executeOnLeave() će se pozvati bez obzira da li user pritisne Leave ili Cancel
      // Nema način da se detektuje izbor korisnika u beforeunload eventu
    }

    // pagehide event se aktivira SAMO kada stranica zaista nestaje
    // (kada user pritisne Leave ili direktno zatvori tab)
    const handlePageHide = () => {
      executeOnLeave(instanceData?.instanceId)
    }

    // window.addEventListener('beforeunload', handleBeforeUnload)
    // window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [location.pathname, instanceData?.instanceId])

  return null
}