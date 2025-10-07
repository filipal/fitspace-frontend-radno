import { useEffect, useRef } from 'react'
import { useInstanceManagement } from '../../context/InstanceManagementContext'

const CLOSE_INSTANCE_LAMBDA_URL =
  'https://hfijogsomw73ojgollhdr75oqq0osdlq.lambda-url.eu-central-1.on.aws/'

export default function BeforeUnloadHandler() {
  const { instanceData } = useInstanceManagement()
  const sentRef = useRef(false)

  useEffect(() => {
    sentRef.current = false

    const sendCloseSignal = () => {
      if (sentRef.current) return
      sentRef.current = true

      const id = instanceData?.instanceId
      if (!id) return

      const body = JSON.stringify({ instanceId: id })
      // sendBeacon preferirano za lifecycle završetke
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(CLOSE_INSTANCE_LAMBDA_URL, blob)

      if (!ok) {
        // Fallback ako sendBeacon vrati false
        fetch(CLOSE_INSTANCE_LAMBDA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch((error) => {
          console.error('Failed to send close instance request:', error)
        })
      }
    }

    // (Opcionalno) potvrda izlaska – ne radi custom tekst u modernim browserima
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Ako ti uopće treba prompt; inače slobodno izbaci cijeli beforeunload
      event.preventDefault()
      event.returnValue = '' // generička poruka
      // Ne šaljemo mrežne zahtjeve ovdje
    }

    // Zamjena za 'unload': radi i kod navigacije i kod bfcache
    const handlePageHide = () => {
      sendCloseSignal()
    }

    // Dodatni osigurač (npr. neki WebKit slučajevi)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendCloseSignal()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [instanceData?.instanceId])

  return null
}
