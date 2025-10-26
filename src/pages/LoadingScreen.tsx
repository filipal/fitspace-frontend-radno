import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useInstanceProvisioning } from '../hooks/useInstanceProvisioning'
import { usePixelStreamingConnection } from '../hooks/usePixelStreamingConnection'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import fitspaceLogo from '../assets/fitspace-logo-gradient-nobkg.svg'
import styles from './LoadingScreen.module.scss'
import { useAuthData } from '../hooks/useAuthData'

export default function LoadingScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const destination = searchParams.get('destination') || 'unreal-measurements' // Default to unreal-measurements
  // const [progress, setProgress] = useState(0)
  // const [showDebugMessages, setShowDebugMessages] = useState(false)
  const resolvedDestination = destination.startsWith('/') ? destination : `/${destination}`
  const [connectionTimeout, setConnectionTimeout] = useState(false)
  const hasStartedProvisioning = useRef(false)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { devMode, clearIntentionalDisconnect } = usePixelStreaming()
  
  const authData = useAuthData()
  const [allowGuestFlow, setAllowGuestFlow] = useState<boolean | null>(null)

  useEffect(() => {
    console.log('🔍 LoadingScreen: Auth check - isAuthenticated:', authData.isAuthenticated)
    
    // If user is authenticated, they're not a guest - disable guest flow
    if (authData.isAuthenticated) {
      console.log('✅ LoadingScreen: User authenticated, disabling guest flow')
      setAllowGuestFlow(false)
      return
    }

    // For unauthenticated users, check if they have guest boot data
    let hasGuestBootData = false
    if (typeof window !== 'undefined') {
      try {
        const pendingData = window.localStorage.getItem('pendingAvatarData')
        const pendingId = window.localStorage.getItem('pendingAvatarId')
        hasGuestBootData = Boolean(pendingData || pendingId)
        console.log('🔍 LoadingScreen: Guest boot data check:', { pendingData: !!pendingData, pendingId: !!pendingId, hasGuestBootData })
      } catch (error) {
        console.warn('Failed to inspect pending avatar data for guest flow', error)
      }
    }

    if (!hasGuestBootData) {
      console.log('❌ LoadingScreen: No guest boot data, redirecting to login')
      setAllowGuestFlow(false)
      navigate('/login', { replace: true, state: { from: location } })
      return
    }

    console.log('✅ LoadingScreen: Guest flow enabled')
    setAllowGuestFlow(true)
  }, [authData.isAuthenticated, navigate, location])

  // Spinner and loading messages
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const loadingMessages = [
    'Obtaining your instances...',
    'Preparing your virtual space...',
    'Connecting to servers...'
  ]
  
  // Rotate loading messages every 2 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length)
    }, 2000)
    
    return () => clearInterval(messageInterval)
  }, [loadingMessages.length])
  
  const {
    startProvisioningWorkflow,
    isReady,
    isError,
    /* getProgressData, */
    // debugMessages,
    error
  } = useInstanceProvisioning()
  
  const {
    connectionState,
    connectionError,
    isConnectedToInstance,
    retryConnection
  } = usePixelStreamingConnection()
  
  // Start provisioning on component mount (only once)
  useEffect(() => {
    const initProvisioning = async () => {
      if (hasStartedProvisioning.current) {
        console.log('🚫 LoadingScreen: Provisioning already started, skipping...')
        return
      }
      
      hasStartedProvisioning.current = true
      
      console.log('🔍 LoadingScreen: Initialization debug info:', {
        isAuthenticated: authData.isAuthenticated,
        allowGuestFlow,
        devMode,
        skipProvisioning: location.state?.skipProvisioning,
        locationState: location.state,
        destination: resolvedDestination
      })
      
      // Check for explicit skipProvisioning flag from navigation state (for debug/dev purposes)
      const skipProvisioning = location.state?.skipProvisioning === true
      
      if (skipProvisioning) {
        console.log(`🔧 LoadingScreen: skipProvisioning flag detected, redirecting to ${resolvedDestination}`)
        setTimeout(() => {
          navigate(resolvedDestination)
        }, 1500)
        return
      }

      if (!authData.isAuthenticated) {
        console.log('🔒 LoadingScreen: User not authenticated, checking guest flow...')
        if (allowGuestFlow !== true) {
          if (allowGuestFlow === false) {
            console.warn('Guest user attempted to load without pending avatar data; staying on login flow')
          }
          return
        }

        console.log(`🧑‍🤝‍🧑 Guest flow detected, skipping provisioning and redirecting to ${resolvedDestination}`)
        setTimeout(() => {
          navigate(resolvedDestination)
        }, 1500)
        return
      }
      
      console.log('✅ LoadingScreen: User is authenticated, proceeding with provisioning...')

      // Check if localhost mode is enabled in devMode setting
      if (devMode === 'localhost') {
        console.log(`🔧 LoadingScreen: Localhost mode enabled, skipping lambda calls and redirecting to ${resolvedDestination}`)
        // setProgress(100)
        
        // Simulate loading for visual feedback
        setTimeout(() => {
          navigate(resolvedDestination)
        }, 1500)
        return
      }

      console.log('🚀 LoadingScreen: About to call startProvisioningWorkflow (first time)')
      
      // Clear intentional disconnect flag before starting new provisioning
      // This allows auto-reconnect when instance is ready
      clearIntentionalDisconnect()
      console.log('🔓 Cleared intentional disconnect flag for new provisioning workflow')
      
      try {
        await startProvisioningWorkflow()
        console.log('✅ LoadingScreen: startProvisioningWorkflow completed')
      } catch (error) {
        console.error('❌ LoadingScreen: Failed to start provisioning:', error)
        // Reset flag on error so it can be retried
        hasStartedProvisioning.current = false
        // Don't navigate away on error, let user see debug messages
      }
    }

    console.log('🔄 LoadingScreen useEffect triggered, hasStarted:', hasStartedProvisioning.current)
    if (!hasStartedProvisioning.current) {
      initProvisioning()
    }
    
    // No cleanup function to prevent re-mounting issues
  }, [
    allowGuestFlow,
    authData.isAuthenticated,
    devMode,
    navigate,
    resolvedDestination,
    startProvisioningWorkflow
  ]) // Added devMode, navigate and destination to dependencies
  
  // Update progress based on provisioning status
  useEffect(() => {
    // Skip normal progress updates only if explicit skipProvisioning or localhost mode
    const skipProvisioning = location.state?.skipProvisioning === true
    if (skipProvisioning || devMode === 'localhost') {
      return
    }
    
    // const progressData = getProgressData()
    // setProgress(progressData.progress)
    
    // Navigate when fully connected
    if (isConnectedToInstance && connectionState === 'connected') {
      setTimeout(() => {
        navigate(resolvedDestination)
      }, 1000) // Small delay to show completion
    }
  }, [location.state, devMode, isConnectedToInstance, connectionState, navigate, resolvedDestination])
  
  // Auto-show debug messages on error
  useEffect(() => {
    if (isError || error || connectionTimeout) {
      // setShowDebugMessages(true)
    }
  }, [isError, error, connectionTimeout])

  // Monitor for connection timeout when instance is ready but connection hangs
  useEffect(() => {
    if (isReady && connectionState === 'connecting' && !connectionTimeoutRef.current) {
      // Start timeout timer when we start connecting
      connectionTimeoutRef.current = setTimeout(() => {
        console.warn('⏰ LoadingScreen: Connection timeout detected after 25 seconds');
        setConnectionTimeout(true);
      }, 25000); // 25 second timeout
    } else if (connectionState === 'connected' || connectionState === 'error') {
      // Clear timeout if connection succeeds or fails
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      setConnectionTimeout(false);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [isReady, connectionState])

  const handleExit = () => {
    navigate('/')
  }
  
  // const toggleDebugMessages = () => {
  //   setShowDebugMessages(!showDebugMessages)
  // }
  
/*   const progressData = getProgressData()
  const currentStage = devMode === 'dev' ? `Dev Mode: Redirecting to ${resolvedDestination}...` :
                      devMode === 'localhost' ? `Localhost Mode: Redirecting to ${resolvedDestination}...` :
                      progressData.stage */

  return (
    <div className={styles.loadingScreenPage}>
      <button className={styles.exitButton} onClick={handleExit} type="button">
        ✕
      </button>
      
      <div className={styles.loadingContent}>
        {/* Fitspace Logo */}
        <div className={styles.logoContainer}>
          <img src={fitspaceLogo} alt="Fitspace" className={styles.logo} />
        </div>
        
        {/* Spinner and Loading Message */}
        <div className={styles.spinnerContainer}>
          <div className={styles.spinner}></div>
          <div className={styles.loadingText}>
            {location.state?.skipProvisioning ? `Dev Mode: Redirecting to ${resolvedDestination}...` :
             devMode === 'localhost' ? `Localhost Mode: Redirecting to ${resolvedDestination}...` :
             loadingMessages[currentMessageIndex]}
          </div>
        </div>
        
        {/* Connection Status */}
        <div className={styles.statusInfo}>
          {location.state?.skipProvisioning && (
            <div className={styles.successStatus}>
              🔧 Dev Mode Active: Skipping provisioning workflow
            </div>
          )}
          
          {devMode === 'localhost' && (
            <div className={styles.successStatus}>
              🔧 Localhost Mode Active: Skipping provisioning workflow
            </div>
          )}
          
          {devMode === 'prod' && isError && (
            <div className={styles.errorStatus}>
              ❌ Error: {error || 'Unknown error occurred'}
            </div>
          )}
          
          {devMode === 'prod' && connectionTimeout && (
            <div className={styles.errorStatus}>
              ⏰ Connection timeout detected - this often happens on mobile networks. 
              Check debug messages for details.
              <button 
                onClick={() => {
                  setConnectionTimeout(false);
                  retryConnection();
                }}
                style={{ 
                  marginLeft: '10px', 
                  padding: '5px 10px', 
                  background: '#007acc', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer' 
                }}
              >
                Retry Connection
              </button>
            </div>
          )}
          
          {devMode === 'prod' && isReady && !isConnectedToInstance && connectionState === 'error' && (
            <div className={styles.errorStatus}>
              ❌ Connection failed: {connectionError || 'WebSocket connection error'}
              <button 
                onClick={retryConnection}
                style={{ 
                  marginLeft: '10px', 
                  padding: '5px 10px', 
                  background: '#007acc', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer' 
                }}
              >
                Retry Connection
              </button>
            </div>
          )}
          
          {devMode === 'prod' && isReady && !isConnectedToInstance && connectionState !== 'error' && (
            <div className={styles.connectingStatus}>
              🔗 Instance ready, establishing connection...
            </div>
          )}
          
          {devMode === 'prod' && isConnectedToInstance && (
            <div className={styles.successStatus}>
              ✅ Connected! Redirecting...
            </div>
          )}
        </div>
        
        {/* Debug Controls - Commented Out */}
        {/* 
        <div className={styles.debugControls}>
          <button 
            className={styles.debugToggle}
            onClick={toggleDebugMessages}
            type="button"
          >
            {showDebugMessages ? 'Hide Debug' : 'Show Debug'} ({debugMessages.length})
          </button>
        </div>
        */}
        
        {/* Debug Messages - Commented Out */}
        {/* 
        {showDebugMessages && (
          <div className={styles.debugMessages}>
            <h4>Debug Messages:</h4>
            <div className={styles.messageList}>
              {debugMessages.map((message, index) => (
                <div key={index} className={styles.debugMessage}>
                  {message}
                </div>
              ))}
              {debugMessages.length === 0 && (
                <div className={styles.noMessages}>No debug messages yet...</div>
              )}
            </div>
          </div>
        )}
        */}
      </div>
    </div>
  )
}