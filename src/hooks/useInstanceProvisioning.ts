import { useEffect, useRef, useCallback } from 'react'
import { useInstanceManagement } from '../context/InstanceManagementContext'
import { useAuthData } from './useAuthData'

/**
 * Custom hook that manages EC2 instance provisioning workflow
 * This handles the complete flow from initial lambda call through polling to ready state
 */
export function useInstanceProvisioning() {
  const instanceManagement = useInstanceManagement()
  const authData = useAuthData()
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)
  
  const {
    instanceData,
    isProvisioning,
    isReady,
    isError,
    startProvisioning,
    pollInstanceStatus,
    addDebugMessage
  } = instanceManagement
  
  // Start the complete provisioning workflow
  const startProvisioningWorkflow = useCallback(async () => {
    try {
      console.log('🔄 useInstanceProvisioning: startProvisioningWorkflow called')
      addDebugMessage('🔄 Starting provisioning workflow...')
      
      if (!authData.isAuthenticated) {
        console.error('❌ User not authenticated')
        throw new Error('User must be authenticated to start provisioning')
      }
      
      console.log('✅ User authenticated, proceeding with provisioning')
      
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        console.log('🧹 Clearing existing polling interval')
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      
      // Start the provisioning
      console.log('🚀 About to call startProvisioning from context...')
      await startProvisioning(authData)
      console.log('✅ startProvisioning completed')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ startProvisioningWorkflow error:', error)
      addDebugMessage(`❌ Failed to start provisioning: ${errorMessage}`)
      throw error
    }
  }, [authData, startProvisioning, addDebugMessage])
  
  // Setup polling when instance is in CREATING state
  useEffect(() => {
    if (isProvisioning && !isPollingRef.current) {
      console.log('⏰ Instance is in CREATING state, setting up immediate polling...')
      addDebugMessage('⏰ Starting polling immediately every 3 seconds...')
      isPollingRef.current = true
      
      // Start polling immediately every 3 seconds
      console.log('⏰ Starting regular polling every 3 seconds...')
      pollingIntervalRef.current = setInterval(async () => {
        console.log('🔄 Regular poll triggered (3 second interval)')
        try {
          await pollInstanceStatus(authData)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Polling error'
          console.error('❌ Regular poll failed:', error)
          addDebugMessage(`❌ Polling failed: ${errorMessage}`)
        }
      }, 3000)
    }
    
    // Stop polling when instance is ready or error
    if ((isReady || isError) && pollingIntervalRef.current) {
      console.log('⏹️ Stopping polling - instance status resolved:', { isReady, isError })
      addDebugMessage('⏹️ Stopping polling - instance status resolved')
      clearTimeout(pollingIntervalRef.current)
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      isPollingRef.current = false
    }
    
    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        console.log('🧹 Cleaning up polling on unmount')
        clearTimeout(pollingIntervalRef.current)
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        isPollingRef.current = false
      }
    }
  }, [isProvisioning, isReady, isError, pollInstanceStatus, addDebugMessage])
  
  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      isPollingRef.current = false
      addDebugMessage('⏹️ Polling stopped manually')
    }
  }, [addDebugMessage])
  
  // Get progress percentage for loading screen
  const getProgressData = useCallback(() => {
    if (!instanceData) {
      return { progress: 0, stage: 'Initializing...' }
    }
    
    switch (instanceData.status) {
      case 'CREATING':
        // Calculate progress based on time elapsed (rough estimation)
        const elapsed = Date.now() - instanceData.lastUpdated.getTime()
        const estimatedProgress = Math.min(90, Math.floor(elapsed / 1000) * 2) // 2% per second, max 90%
        return { progress: 30 + estimatedProgress, stage: 'Provisioning EC2 instance...' }
      
      case 'READY':
        return { progress: 100, stage: 'Instance ready! Connecting...' }
      
      case 'ERROR':
        return { progress: 0, stage: 'Error occurred' }
      
      default:
        return { progress: 10, stage: 'Starting provisioning...' }
    }
  }, [instanceData])
  
  return {
    // Status
    instanceData,
    isProvisioning,
    isReady,
    isError,
    
    // Actions
    startProvisioningWorkflow,
    stopPolling,
    
    // Helpers
    getProgressData,
    
    // Debug data
    debugMessages: instanceManagement.debugMessages,
    clearDebugMessages: instanceManagement.clearDebugMessages,
    
    // Error
    error: instanceManagement.error
  }
}