import { useCallback, useEffect, useRef } from 'react'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import { useInstanceManagement } from '../context/InstanceManagementContext'

/**
 * Custom hook that manages WebSocket connection to the pixel streaming server
 * This integrates the instance management with pixel streaming connection
 */
export function usePixelStreamingConnection() {
  const pixelStreaming = usePixelStreaming()
  const instanceManagement = useInstanceManagement()
  const connectionAttemptRef = useRef(false)
  const lastAttemptedUrlRef = useRef<string | null>(null)
  
  const {
    connect: connectPixelStreaming,
    disconnect: disconnectPixelStreaming,
    updateSettings,
    connectionState,
    connectionError,
    debugMode,
    setDebugSettings
  } = pixelStreaming
  
  const {
    instanceData,
    isReady,
    addDebugMessage
  } = instanceManagement
  
  // Connect to WebSocket using the URL from instance data
  const connectToInstance = useCallback(async () => {
    console.log('🔗 connectToInstance called:', { isReady, url: instanceData?.url })
    
    if (!isReady || !instanceData?.url) {
      console.log('❌ Cannot connect - conditions not met')
      addDebugMessage('❌ Cannot connect - instance not ready or URL missing')
      return false
    }

    // Prevent multiple concurrent connection attempts
    if (connectionAttemptRef.current) {
      console.log('🚫 Connection attempt already in progress, skipping...')
      addDebugMessage('🚫 Connection attempt already in progress, skipping...')
      return false
    }

    // Check if we're already trying to connect to the same URL
    if (lastAttemptedUrlRef.current === instanceData.url && 
        (connectionState === 'connecting' || connectionState === 'connected')) {
      console.log('🚫 Already connected/connecting to this URL, skipping...')
      addDebugMessage(`🚫 Already ${connectionState} to this URL, skipping...`)
      return false
    }
    
    try {
      connectionAttemptRef.current = true
      lastAttemptedUrlRef.current = instanceData.url
      
      console.log(`🔗 Connecting to WebSocket: ${instanceData.url}`)
      addDebugMessage(`🔗 Connecting to WebSocket: ${instanceData.url}`)
      
      // Update pixel streaming settings with the new URL
      const newSettings = {
        ss: instanceData.url,
        AutoConnect: false // We control the connection manually
      }
      
      console.log('⚙️ Updating pixel streaming settings:', newSettings)
      
      if (debugMode) {
        console.log('🐛 Using debug mode settings')
        // If in debug mode, update debug settings
        setDebugSettings(newSettings)
      } else {
        console.log('📺 Using main settings')
        // Update main settings
        updateSettings(newSettings)
      }
      
      addDebugMessage('⚙️ Updated pixel streaming settings with instance URL')
      
      // Connect to pixel streaming with URL override to avoid timing issues
      console.log('🔌 Calling connectPixelStreaming with URL override:', instanceData.url)
      addDebugMessage(`🔌 Attempting connection with URL: ${instanceData.url}`)
      await connectPixelStreaming(instanceData.url)
      
      console.log('✅ Pixel streaming connection initiated')
      addDebugMessage('✅ Pixel streaming connection initiated')
      return true
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      console.error('❌ Connection error:', error)
      addDebugMessage(`❌ Connection failed: ${errorMessage}`)
      return false
    } finally {
      // Reset the connection attempt flag after a delay to allow for retry if needed
      setTimeout(() => {
        connectionAttemptRef.current = false
      }, 5000) // Wait 5 seconds before allowing another attempt
    }
  }, [
    isReady, 
    instanceData, 
    addDebugMessage, 
    connectPixelStreaming, 
    updateSettings, 
    setDebugSettings, 
    debugMode
  ])
  
  // Auto-connect when instance becomes ready (only once per URL)
  useEffect(() => {
    console.log('🔍 usePixelStreamingConnection useEffect triggered:', {
      isReady,
      hasUrl: Boolean(instanceData?.url),
      url: instanceData?.url,
      connectionState,
      lastAttemptedUrl: lastAttemptedUrlRef.current,
      connectionAttemptInProgress: connectionAttemptRef.current
    })
    
    // Only attempt connection if:
    // 1. Instance is ready and has URL
    // 2. We haven't already attempted this URL
    // 3. We're not currently connecting or connected
    // 4. No connection attempt is in progress
    if (isReady && 
        instanceData?.url && 
        lastAttemptedUrlRef.current !== instanceData.url &&
        connectionState === 'disconnected' &&
        !connectionAttemptRef.current) {
      
      addDebugMessage(`🚀 Instance ready, auto-connecting to WebSocket: ${instanceData.url}`)
      console.log('🔗 About to call connectToInstance...')
      connectToInstance()
    } else {
      console.log('🚫 Not connecting yet:', {
        isReady,
        hasUrl: Boolean(instanceData?.url),
        connectionState,
        sameUrl: lastAttemptedUrlRef.current === instanceData?.url,
        attemptInProgress: connectionAttemptRef.current
      })
    }
  }, [isReady, instanceData?.url, connectionState, addDebugMessage])

  // Reset connection attempt flag when connection succeeds or fails definitively
  useEffect(() => {
    if (connectionState === 'connected' || connectionState === 'error') {
      console.log(`🔄 Connection state changed to ${connectionState}, resetting attempt flag`)
      connectionAttemptRef.current = false
    }
  }, [connectionState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionAttemptRef.current = false
      lastAttemptedUrlRef.current = null
    }
  }, [])
  
  // Disconnect from pixel streaming
  const disconnectFromInstance = useCallback(() => {
    addDebugMessage('🔌 Disconnecting from pixel streaming...')
    disconnectPixelStreaming()
  }, [disconnectPixelStreaming, addDebugMessage])

  // Manual retry function that resets the attempt tracking
  const retryConnection = useCallback(() => {
    console.log('🔄 Manual retry requested')
    addDebugMessage('🔄 Manual connection retry requested')
    
    // Reset tracking to allow a new attempt
    connectionAttemptRef.current = false
    lastAttemptedUrlRef.current = null
    
    // Attempt connection if conditions are met
    if (isReady && instanceData?.url) {
      connectToInstance()
    } else {
      addDebugMessage('❌ Cannot retry - instance not ready or URL missing')
    }
  }, [isReady, instanceData?.url, addDebugMessage])
  
  // Check if we can connect (instance is ready and has URL)
  const canConnect = isReady && Boolean(instanceData?.url)
  
  // Check if currently connected to the instance
  const isConnectedToInstance = connectionState === 'connected' && 
    instanceData?.url && 
    (debugMode ? 
      pixelStreaming.debugSettings?.ss === instanceData.url : 
      pixelStreaming.settings.ss === instanceData.url
    )
  
  return {
    // Connection status
    connectionState,
    connectionError,
    isConnectedToInstance,
    canConnect,
    
    // Actions
    connectToInstance,
    disconnectFromInstance,
    retryConnection,
    
    // Instance data
    instanceUrl: instanceData?.url,
    instanceId: instanceData?.instanceId,
    publicIp: instanceData?.publicIp
  }
}