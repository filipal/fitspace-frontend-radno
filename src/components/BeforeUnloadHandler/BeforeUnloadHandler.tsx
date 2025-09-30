import { useEffect } from 'react'
import { useInstanceManagement } from '../../context/InstanceManagementContext'

const CLOSE_INSTANCE_LAMBDA_URL = 'https://hfijogsomw73ojgollhdr75oqq0osdlq.lambda-url.eu-central-1.on.aws/'

export default function BeforeUnloadHandler() {
  const { instanceData } = useInstanceManagement()

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Show confirmation dialog
      event.preventDefault()
      event.returnValue = 'Are you sure you want to quit your session?'
      
      // If we have an instance ID, send the close request
      if (instanceData?.instanceId) {
        const body = JSON.stringify({ 
          instanceId: instanceData.instanceId 
        })
        
        // Use sendBeacon for reliable delivery when page unloads
        navigator.sendBeacon(CLOSE_INSTANCE_LAMBDA_URL, body)
        
        console.log('🔄 Sent close instance request for:', instanceData.instanceId)
      }
      
      return 'Are you sure you want to quit your session?'
    }

    const handleUnload = () => {
      // Fallback using fetch with keepalive if sendBeacon didn't work
      if (instanceData?.instanceId) {
        const body = JSON.stringify({ 
          instanceId: instanceData.instanceId 
        })
        
        fetch(CLOSE_INSTANCE_LAMBDA_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: body,
          keepalive: true
        }).catch(error => {
          console.error('Failed to send close instance request:', error)
        })
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleUnload)
    }
  }, [instanceData?.instanceId])

  // This component doesn't render anything
  return null
}