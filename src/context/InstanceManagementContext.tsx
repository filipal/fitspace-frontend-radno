import { createContext, useState, useCallback, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { AuthDataContextType } from './AuthDataContext'
import type { CreateAvatarCommand } from '../types/provisioning'

// ==== Status i odgovori s lambde ====
export type InstanceStatus = 'CREATING' | 'READY' | 'ERROR' | 'IDLE'

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

// ==== Provisioning input (jedina istina) ====
// - "create" nosi CreateAvatarCommand (ono što spremaš u localStorage kao pendingAvatarData)
// - "open" nosi samo id
export type ProvisioningInput =
  | { kind: 'create'; data: CreateAvatarCommand }
  | { kind: 'open'; avatarId: string }

// ==== Instance data u kontekstu ====
export interface InstanceData {
  status: InstanceStatus
  instanceId?: string
  publicIp?: string
  url?: string
  sessionId?: string
  lastUpdated: Date
}

// ==== Interface konteksta ====
export interface InstanceManagementContextType {
  instanceData: InstanceData | null
  isProvisioning: boolean
  isReady: boolean
  isError: boolean

  startProvisioning: (authData: AuthDataContextType, input?: ProvisioningInput) => Promise<void>
  pollInstanceStatus: (authData: AuthDataContextType) => Promise<void>
  clearInstance: () => void

  error: string | null

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

  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugMessages(prev => [...prev, `[${timestamp}] ${message}`])
  }, [])

  useEffect(() => {
    window.addFitspaceDebugMessage = addDebugMessage
    return () => {
      delete window.addFitspaceDebugMessage
    }
  }, [addDebugMessage])

  const clearDebugMessages = useCallback(() => {
    setDebugMessages([])
  }, [])

  const isProvisioning = instanceData?.status === 'CREATING'
  const isReady = instanceData?.status === 'READY'
  const isError = instanceData?.status === 'ERROR'

  // ==== START PROVISIONING ====
  const startProvisioning = useCallback(
    async (authData: AuthDataContextType, input?: ProvisioningInput) => {
      try {
        setError(null)
        console.log('🔥 InstanceManagementContext: startProvisioning called')
        console.log('🔥 Lambda URL:', LAMBDA_URL)

        addDebugMessage(`🚀 Starting instance provisioning... input=${input ? input.kind : 'none'}`)

        if (!authData.isAuthenticated || !authData.userId || !authData.sessionId) {
          throw new Error('User not authenticated or missing credentials')
        }

        console.log('📡 About to call lambda with:', {
          userId: authData.userId,
          sessionId: authData.sessionId,
          mode: input?.kind ?? 'default'
        })
        addDebugMessage(`📡 Calling lambda with userId: ${authData.userId} (mode=${input?.kind ?? 'default'})`)

        const requestBody: Record<string, unknown> = {
          userId: authData.userId,
          sessionId: authData.sessionId,
          mode: 'default'
        }

        if (input?.kind === 'create') {
          // šaljemo CreateAvatarCommand (ono što si stavila u pendingAvatarData)
          requestBody.mode = 'create'
          requestBody.avatarData = input.data
        } else if (input?.kind === 'open') {
          requestBody.mode = 'open'
          requestBody.avatarId = input.avatarId
        }

        console.log('🚀 Making fetch request to lambda...', requestBody)
        const response = await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          setInstanceData({
            status: 'CREATING',
            instanceId: data.instanceId,
            sessionId: data.sessionId,
            lastUpdated: new Date()
          })
          addDebugMessage('⏳ Instance is being created, starting polling immediately...')
        } else if (data.status === 'READY') {
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
        setInstanceData(prev => (prev ? { ...prev, status: 'ERROR', lastUpdated: new Date() } : null))
      }
    },
    [addDebugMessage]
  )

  // ==== POLLING ====
  const pollInstanceStatus = useCallback(
    async (authData: AuthDataContextType) => {
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        console.log('📥 Polling response status:', response.status, response.statusText)
        if (!response.ok) {
          if (response.status === 502) {
            console.warn('⚠️ Lambda returned 502 Bad Gateway - temporary issue, will retry')
            addDebugMessage('⚠️ Lambda temporarily unavailable (502), will retry...')
            return
          }
          throw new Error(`Polling failed: ${response.status} ${response.statusText}`)
        }

        const data: InstanceResponse = await response.json()
        console.log('📦 Polling response data:', data)

        if (data.instanceId !== instanceData.instanceId) {
          console.warn('⚠️ Lambda returned DIFFERENT instance ID!', {
            expected: instanceData.instanceId,
            received: data.instanceId
          })
          addDebugMessage(
            `⚠️ Instance ID mismatch! Expected: ${instanceData.instanceId}, Got: ${data.instanceId}`
          )
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
          setInstanceData(prev =>
            prev
              ? {
                  ...prev,
                  lastUpdated: new Date(),
                  instanceId: prev.instanceId
                }
              : null
          )
          addDebugMessage('⏳ Still creating...')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Polling error'
        console.error('❌ Polling error:', err)
        setError(errorMessage)
        addDebugMessage(`❌ Polling error: ${errorMessage}`)
        setInstanceData(prev => (prev ? { ...prev, status: 'ERROR', lastUpdated: new Date() } : null))
      }
    },
    [instanceData, addDebugMessage]
  )

  // ==== CLEAR ====
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

export function useInstanceManagement() {
  const context = useContext(InstanceManagementContext)
  if (context === undefined) {
    throw new Error('useInstanceManagement must be used within an InstanceManagementProvider')
  }
  return context
}

export { InstanceManagementContext }
