import { createContext, useState, useCallback, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AuthDataContextType } from './AuthDataContext'

// Instance status from lambda response
export type InstanceStatus = 'CREATING' | 'READY' | 'ERROR' | 'IDLE'

// Lambda response interfaces
export interface InstanceCreatingResponse {
  status: 'CREATING'
  instanceId: string
  sessionId: string
}

export interface InstanceReadyResponse {
  status: 'READY'
  instanceId: string
  publicIp: string
  url: string
  sessionId: string
}

export type InstanceResponse = InstanceCreatingResponse | InstanceReadyResponse

// Instance data stored in context
export interface InstanceData {
  status: InstanceStatus
  instanceId?: string
  publicIp?: string
  url?: string
  sessionId?: string
  lastUpdated: Date
}

// Context interface
export interface InstanceManagementContextType {
  // Instance data
  instanceData: InstanceData | null
  
  // Status helpers
  isProvisioning: boolean
  isReady: boolean
  isError: boolean
  
  // Actions
  startProvisioning: (authData: AuthDataContextType) => Promise<void>
  pollInstanceStatus: (authData: AuthDataContextType) => Promise<void>
  clearInstance: () => void
  
  // Error handling
  error: string | null
  
  // Debug info for loading screen
  debugMessages: string[]
  addDebugMessage: (message: string) => void
  clearDebugMessages: () => void
}

const InstanceManagementContext = createContext<InstanceManagementContextType | undefined>(undefined)

interface InstanceManagementProviderProps {
  children: ReactNode
}

const LAMBDA_URL = 'https://t6kf7jfqub5z5jcetfzk64ko6u0vlpwe.lambda-url.eu-central-1.on.aws/'

export function InstanceManagementProvider({ children }: InstanceManagementProviderProps) {
  const [instanceData, setInstanceData] = useState<InstanceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugMessages, setDebugMessages] = useState<string[]>([])
  
  // Helper to add debug messages with timestamp
  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugMessages(prev => [...prev, `[${timestamp}] ${message}`])
  }, [])
  
  // Clear debug messages
  const clearDebugMessages = useCallback(() => {
    setDebugMessages([])
  }, [])
  
  // Status helpers
  const isProvisioning = instanceData?.status === 'CREATING'
  const isReady = instanceData?.status === 'READY'
  const isError = instanceData?.status === 'ERROR'
  
  // Start provisioning by calling lambda with user credentials
  const startProvisioning = useCallback(async (authData: AuthDataContextType) => {
    try {
      setError(null)
      console.log('🔥 InstanceManagementContext: startProvisioning called')
      console.log('🔥 Lambda URL:', LAMBDA_URL)
      addDebugMessage('🚀 Starting instance provisioning...')
      
      if (!authData.isAuthenticated || !authData.userId || !authData.sessionId) {
        throw new Error('User not authenticated or missing credentials')
      }
      
      console.log('📡 About to call lambda with:', { userId: authData.userId, sessionId: authData.sessionId })
      addDebugMessage(`📡 Calling lambda with userId: ${authData.userId}`)
      
      const requestBody = {
        userId: authData.userId,
        sessionId: authData.sessionId
      }
      
      console.log('🚀 Making fetch request to lambda...')
      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      console.log('📥 Lambda response status:', response.status, response.statusText)
      if (!response.ok) {
        throw new Error(`Lambda call failed: ${response.status} ${response.statusText}`)
      }
      
      const data: InstanceResponse = await response.json()
      console.log('📦 Lambda response data:', data)
      addDebugMessage(`✅ Lambda response: ${data.status} - Instance ID: ${data.instanceId}`)
      
      if (data.status === 'CREATING') {
        console.log('⏳ Instance status is CREATING, will start polling immediately...')
        console.log('🏷️ Storing instance ID for polling:', data.instanceId)
        setInstanceData({
          status: 'CREATING',
          instanceId: data.instanceId,
          sessionId: data.sessionId,
          lastUpdated: new Date()
        })
        addDebugMessage('⏳ Instance is being created, starting polling immediately...')
      } else if (data.status === 'READY') {
        // Unlikely but handle immediate ready state
        console.log('🎉 Instance ready immediately!')
        setInstanceData({
          status: 'READY',
          instanceId: data.instanceId,
          publicIp: data.publicIp,
          url: data.url,
          sessionId: data.sessionId,
          lastUpdated: new Date()
        })
        addDebugMessage(`🎉 Instance ready immediately! URL: ${data.url}`)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('❌ Lambda call error:', err)
      setError(errorMessage)
      addDebugMessage(`❌ Error: ${errorMessage}`)
      setInstanceData(prev => prev ? { ...prev, status: 'ERROR', lastUpdated: new Date() } : null)
    }
  }, [addDebugMessage])
  
  // Poll instance status (should be called every 3 seconds when provisioning)
  const pollInstanceStatus = useCallback(async (authData: AuthDataContextType) => {
    console.log('🔄 PollInstanceStatus called, instanceData:', instanceData)
    
    if (!instanceData || instanceData.status !== 'CREATING') {
      console.log('🚫 Not polling - instance not in CREATING state')
      return
    }

    if (!authData.isAuthenticated || !authData.userId || !authData.sessionId) {
      console.log('🚫 Not polling - user not authenticated or missing credentials')
      return
    }
    
    try {
      console.log('📡 About to poll lambda for instance status...')
      addDebugMessage('🔄 Polling instance status...')
      
      const requestBody = {
        userId: authData.userId,
        sessionId: authData.sessionId
      }
      
      console.log('🚀 Making polling request to lambda...')
      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      console.log('📥 Polling response status:', response.status, response.statusText)
      if (!response.ok) {
        if (response.status === 502) {
          // Lambda is temporarily unavailable, this is common during cold starts
          console.warn('⚠️ Lambda returned 502 Bad Gateway - temporary issue, will retry')
          addDebugMessage('⚠️ Lambda temporarily unavailable (502), will retry...')
          return // Don't throw error, just skip this poll
        }
        throw new Error(`Polling failed: ${response.status} ${response.statusText}`)
      }
      
      const data: InstanceResponse = await response.json()
      console.log('📦 Polling response data:', data)
      
      // Check if lambda returned a different instance ID
      if (data.instanceId !== instanceData.instanceId) {
        console.warn('⚠️ Lambda returned DIFFERENT instance ID!')
        console.warn('Expected:', instanceData.instanceId)
        console.warn('Received:', data.instanceId)
        addDebugMessage(`⚠️ Instance ID mismatch! Expected: ${instanceData.instanceId}, Got: ${data.instanceId}`)
      }
      
      if (data.status === 'READY') {
        console.log('🎉 Polling detected instance is ready!')
        setInstanceData({
          status: 'READY',
          instanceId: data.instanceId,
          publicIp: data.publicIp,
          url: data.url,
          sessionId: data.sessionId,
          lastUpdated: new Date()
        })
        addDebugMessage(`🎉 Instance is ready! URL: ${data.url}`)
        addDebugMessage(`📍 Public IP: ${data.publicIp}`)
      } else if (data.status === 'CREATING') {
        console.log('⏳ Polling - instance still creating...')
        // Still creating, update timestamp but keep original instance ID
        setInstanceData(prev => prev ? { 
          ...prev, 
          lastUpdated: new Date(),
          // Keep the original instance ID from initial call
          instanceId: prev.instanceId  
        } : null)
        addDebugMessage('⏳ Still creating...')
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Polling error'
      console.error('❌ Polling error:', err)
      setError(errorMessage)
      addDebugMessage(`❌ Polling error: ${errorMessage}`)
      setInstanceData(prev => prev ? { ...prev, status: 'ERROR', lastUpdated: new Date() } : null)
    }
  }, [instanceData, addDebugMessage])
  
  // Clear instance data (e.g., on logout or reset)
  const clearInstance = useCallback(() => {
    setInstanceData(null)
    setError(null)
    addDebugMessage('🧹 Instance data cleared')
  }, [addDebugMessage])
  
  const contextValue: InstanceManagementContextType = {
    instanceData,
    isProvisioning,
    isReady,
    isError,
    startProvisioning,
    pollInstanceStatus,
    clearInstance,
    error,
    debugMessages,
    addDebugMessage,
    clearDebugMessages
  }
  
  return (
    <InstanceManagementContext.Provider value={contextValue}>
      {children}
    </InstanceManagementContext.Provider>
  )
}

// Hook to use the instance management context
export function useInstanceManagement() {
  const context = useContext(InstanceManagementContext)
  if (context === undefined) {
    throw new Error('useInstanceManagement must be used within an InstanceManagementProvider')
  }
  return context
}

export { InstanceManagementContext }