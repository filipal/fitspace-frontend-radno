import { useEffect, useRef, useCallback } from 'react'
import { useInstanceManagement, type ProvisioningInput } from '../context/InstanceManagementContext'
import { useAuthData } from './useAuthData'
import type { CreateAvatarCommand } from '../types/provisioning'

/**
 * Hook koji vodi cijeli provisioning flow
 * - čita pendingAvatarData / pendingAvatarId iz localStorage
 * - poziva startProvisioning(authData, input?)
 * - pokreće polling i drži progress
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

  /** Safe čitanje boot input-a iz localStorage (prefer data → else id) */
  const readBootInput = useCallback((): ProvisioningInput | undefined => {
    try {
      const rawData = localStorage.getItem('pendingAvatarData')
      const rawId = localStorage.getItem('pendingAvatarId')
      console.log('🧭 Loading boot keys', { hasData: !!rawData, hasId: !!rawId })
      addDebugMessage(`🧭 Boot keys: data=${!!rawData}, id=${!!rawId}`)

      // 1) createAvatar komanda
      if (rawData) {
        try {
          const parsed = JSON.parse(rawData) as CreateAvatarCommand
          if (parsed?.type === 'createAvatar' && parsed.data && typeof parsed.data === 'object') {
            return { kind: 'create', data: parsed }
          }
          addDebugMessage('⚠️ pendingAvatarData present but invalid shape; falling back to ID if present.')
          console.warn('pendingAvatarData invalid shape:', parsed)
        } catch (e) {
          addDebugMessage('⚠️ Failed to parse pendingAvatarData JSON; falling back to ID if present.')
          console.warn('Failed to parse pendingAvatarData', e)
        }
      }

      // 2) otvaranje postojećeg avatara
      if (rawId) {
        return { kind: 'open', avatarId: rawId }
      }

      return undefined
    } catch (e) {
      console.warn('readBootInput failed', e)
      addDebugMessage('⚠️ readBootInput failed — continuing without boot input.')
      return undefined
    }
  }, [addDebugMessage])

  // ===== Start workflow =====
  const startProvisioningWorkflow = useCallback(async () => {
    try {
      console.log('🔄 useInstanceProvisioning: startProvisioningWorkflow called')
      addDebugMessage('🔄 Starting provisioning workflow...')

      if (!authData.isAuthenticated) {
        console.error('❌ User not authenticated')
        throw new Error('User must be authenticated to start provisioning')
      }

      console.log('✅ User authenticated, proceeding with provisioning')

      // Očisti postojeći polling
      if (pollingIntervalRef.current) {
        console.log('🧹 Clearing existing polling interval')
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }

      // Pročitaj boot input (pendingAvatarData > pendingAvatarId)
      const bootInput = readBootInput()
      if (bootInput?.kind === 'create') {
        addDebugMessage('📦 Boot input: CREATE (pendingAvatarData)')
      } else if (bootInput?.kind === 'open') {
        addDebugMessage(`🆔 Boot input: OPEN (id=${bootInput.avatarId})`)
      } else {
        addDebugMessage('ℹ️ No boot input (will rely on backend defaults).')
      }

      console.log('🚀 About to call startProvisioning from context...', { bootInput })
      await startProvisioning(authData, bootInput) // OK: input je undefined kad ga nema
      console.log('✅ startProvisioning dispatched')

      // (Opcionalno) odmah obriši pending ključeve da se ne recikliraju
      try {
        localStorage.removeItem('pendingAvatarData')
        localStorage.removeItem('pendingAvatarId')
        addDebugMessage('🧹 Cleared pendingAvatarData/pendingAvatarId')
      } catch {}
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ startProvisioningWorkflow error:', error)
      addDebugMessage(`❌ Failed to start provisioning: ${errorMessage}`)
      throw error
    }
  }, [authData, startProvisioning, addDebugMessage, readBootInput])

  // ===== Polling kada je CREATING =====
  useEffect(() => {
    if (isProvisioning && !isPollingRef.current) {
      console.log('⏰ Instance is in CREATING state, setting up immediate polling...')
      addDebugMessage('⏰ Starting polling immediately every 3 seconds...')
      isPollingRef.current = true

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

    // Stop kad je READY ili ERROR
    if ((isReady || isError) && pollingIntervalRef.current) {
      console.log('⏹️ Stopping polling - instance status resolved:', { isReady, isError })
      addDebugMessage('⏹️ Stopping polling - instance status resolved')
      clearTimeout(pollingIntervalRef.current)
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      isPollingRef.current = false
    }

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        console.log('🧹 Cleaning up polling on unmount')
        clearTimeout(pollingIntervalRef.current)
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
        isPollingRef.current = false
      }
    }
  }, [isProvisioning, isReady, isError, pollInstanceStatus, addDebugMessage, authData])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      isPollingRef.current = false
      addDebugMessage('⏹️ Polling stopped manually')
    }
  }, [addDebugMessage])

  const getProgressData = useCallback(() => {
    if (!instanceData) {
      return { progress: 0, stage: 'Initializing...' }
    }

    switch (instanceData.status) {
      case 'CREATING': {
        const elapsed = Date.now() - instanceData.lastUpdated.getTime()
        const estimatedProgress = Math.min(90, Math.floor(elapsed / 1000) * 2) // 2% per sec, max 90%
        return { progress: 30 + estimatedProgress, stage: 'Provisioning EC2 instance...' }
      }
      case 'READY':
        return { progress: 100, stage: 'Instance ready! Connecting...' }
      case 'ERROR':
        return { progress: 0, stage: 'Error occurred' }
      default:
        return { progress: 10, stage: 'Starting provisioning...' }
    }
  }, [instanceData])

  return {
    instanceData,
    isProvisioning,
    isReady,
    isError,
    startProvisioningWorkflow,
    stopPolling,
    getProgressData,
    debugMessages: instanceManagement.debugMessages,
    clearDebugMessages: instanceManagement.clearDebugMessages,
    error: instanceManagement.error
  }
}
