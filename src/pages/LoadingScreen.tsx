import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInstanceProvisioning } from '../hooks/useInstanceProvisioning'
import { usePixelStreamingConnection } from '../hooks/usePixelStreamingConnection'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import styles from './LoadingScreen.module.scss'

export default function LoadingScreen() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(0)
  const [showDebugMessages, setShowDebugMessages] = useState(false)
  const hasStartedProvisioning = useRef(false)
  const { devMode } = usePixelStreaming()
  
  const {
    startProvisioningWorkflow,
    isReady,
    isError,
    getProgressData,
    debugMessages,
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
      if (devMode) {
        console.log('🔧 LoadingScreen: Dev mode enabled, skipping lambda calls and redirecting to /virtual-try-on')
        setProgress(100)
        
        // Simulate loading for visual feedback
        setTimeout(() => {
          navigate('/virtual-try-on')
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
  }, [devMode, navigate]) // Added devMode and navigate to dependencies
  
  // Update progress based on provisioning status
  useEffect(() => {
    // Skip normal progress updates in dev mode
    if (devMode) {
      return
    }
    
    const progressData = getProgressData()
    setProgress(progressData.progress)
    
    // Navigate when fully connected
    if (isConnectedToInstance && connectionState === 'connected') {
      setTimeout(() => {
        navigate('/unreal-measurements')
      }, 1000) // Small delay to show completion
    }
  }, [devMode, getProgressData, isConnectedToInstance, connectionState, navigate])
  
  // Auto-show debug messages on error
  useEffect(() => {
    if (isError || error) {
      setShowDebugMessages(true)
    }
  }, [isError, error])

  const handleExit = () => {
    navigate('/')
  }
  
  const toggleDebugMessages = () => {
    setShowDebugMessages(!showDebugMessages)
  }
  
  const progressData = getProgressData()
  const currentStage = devMode ? 'Dev Mode: Redirecting to Virtual Try-On...' : progressData.stage

  return (
    <div className={styles.loadingScreenPage}>
      <button className={styles.exitButton} onClick={handleExit} type="button">
        ✕
      </button>
      <div className={styles.loadingContent}>
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.loadingText}>
            {currentStage}
          </div>
          <div className={styles.progressPercent}>
            {progress}%
          </div>
        </div>
        
        {/* Connection Status */}
        <div className={styles.statusInfo}>
          {devMode && (
            <div className={styles.successStatus}>
              🔧 Dev Mode Active: Skipping provisioning workflow
            </div>
          )}
          
          {!devMode && isError && (
            <div className={styles.errorStatus}>
              ❌ Error: {error || 'Unknown error occurred'}
            </div>
          )}
          
          {!devMode && isReady && !isConnectedToInstance && connectionState === 'error' && (
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
          
          {!devMode && isReady && !isConnectedToInstance && connectionState !== 'error' && (
            <div className={styles.connectingStatus}>
              🔗 Instance ready, establishing connection...
            </div>
          )}
          
          {!devMode && isConnectedToInstance && (
            <div className={styles.successStatus}>
              ✅ Connected! Redirecting...
            </div>
          )}
        </div>
        
        {/* Debug Controls */}
        <div className={styles.debugControls}>
          <button 
            className={styles.debugToggle}
            onClick={toggleDebugMessages}
            type="button"
          >
            {showDebugMessages ? 'Hide Debug' : 'Show Debug'} ({debugMessages.length})
          </button>
        </div>
        
        {/* Debug Messages */}
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
      </div>
    </div>
  )
}