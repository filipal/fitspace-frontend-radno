import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useInstanceProvisioning } from '../hooks/useInstanceProvisioning'
import { usePixelStreamingConnection } from '../hooks/usePixelStreamingConnection'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import fitspaceLogo from '../assets/fitspace-logo-gradient-nobkg.svg'
import styles from './LoadingScreen.module.scss'

export default function LoadingScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = searchParams.get('destination') || 'unreal-measurements' // Default to unreal-measurements
  // const [progress, setProgress] = useState(0)
  // const [showDebugMessages, setShowDebugMessages] = useState(false)
  const [connectionTimeout, setConnectionTimeout] = useState(false)
  const hasStartedProvisioning = useRef(false)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { devMode } = usePixelStreaming()
  
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
      
      // Check if dev mode is enabled
      if (devMode === 'dev') {
        console.log(`🔧 LoadingScreen: Dev mode enabled, skipping lambda calls and redirecting to /${destination}`)
        // setProgress(100)
        
        // Simulate loading for visual feedback
        setTimeout(() => {
          navigate(`/${destination}`)
        }, 1500)
        return
      }
      
      // Check if localhost mode is enabled
      if (devMode === 'localhost') {
        console.log(`🔧 LoadingScreen: Localhost mode enabled, skipping lambda calls and redirecting to /${destination}`)
        // setProgress(100)
        
        // Simulate loading for visual feedback
        setTimeout(() => {
          navigate(`/${destination}`)
        }, 1500)
        return
      }
      
      console.log('🚀 LoadingScreen: About to call startProvisioningWorkflow (first time)')
      
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
  }, [devMode, navigate, destination, startProvisioningWorkflow]) // Added devMode, navigate and destination to dependencies
  
  // Update progress based on provisioning status
  useEffect(() => {
    // Skip normal progress updates in dev mode or localhost mode
    if (devMode === 'dev' || devMode === 'localhost') {
      return
    }
    
    // const progressData = getProgressData()
    // setProgress(progressData.progress)
    
    // Navigate when fully connected
    if (isConnectedToInstance && connectionState === 'connected') {
      setTimeout(() => {
        navigate(`/${destination}`)
      }, 1000) // Small delay to show completion
    }
  }, [devMode, isConnectedToInstance, connectionState, navigate, destination])
  
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
  const currentStage = devMode === 'dev' ? `Dev Mode: Redirecting to ${destination}...` : 
                      devMode === 'localhost' ? `Localhost Mode: Redirecting to ${destination}...` : 
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
            {devMode === 'dev' ? `Dev Mode: Redirecting to ${destination}...` : 
             devMode === 'localhost' ? `Localhost Mode: Redirecting to ${destination}...` : 
             loadingMessages[currentMessageIndex]}
          </div>
        </div>
        
        {/* Connection Status */}
        <div className={styles.statusInfo}>
          {devMode === 'dev' && (
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