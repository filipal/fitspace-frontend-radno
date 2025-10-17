import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  type AvatarListItem,
  type AvatarPayload,
  useAvatarApi
} from '../services/avatarApi'
import { useAuthData } from '../hooks/useAuthData'
import type { CreateAvatarCommand } from '../types/provisioning'

export interface AvatarRecord {
  id: string
  name: string
  createdAt: string
}

const PENDING_NAME_KEY = 'fitspace:pending-avatar-name'
const MAX_AVATARS = 5

interface AvatarContextValue {
  avatars: AvatarRecord[]
  maxAvatars: number
  refreshAvatars: () => Promise<void>
  pendingAvatarName: string | null
  setPendingAvatarName: (name: string | null) => void
}

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined)

const readStoredPendingName = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(PENDING_NAME_KEY)
}

const persistPendingName = (name: string | null) => {
  if (typeof window === 'undefined') return
  if (name && name.trim()) {
    window.sessionStorage.setItem(PENDING_NAME_KEY, name)
  } else {
    window.sessionStorage.removeItem(PENDING_NAME_KEY)
  }
}

const normalizeAvatarList = (items: AvatarListItem[]): AvatarRecord[] =>
  items
    .map((item, index) => {
      const id = item?.id
      if (id === null || id === undefined) {
        return null
      }

      const name = item?.name?.trim()
      return {
        id: String(id),
        name: name && name.length > 0 ? name : `Avatar ${index + 1}`,
        createdAt: item?.createdAt ?? new Date().toISOString()
      }
    })
    .filter((record): record is AvatarRecord => Boolean(record))

export function AvatarProvider({ children }: { children: ReactNode }) {
  const { listAvatars, createAvatar } = useAvatarApi()
  const { isAuthenticated } = useAuthData()
  const [avatars, setAvatarList] = useState<AvatarRecord[]>([])
  const [pendingAvatarName, setPendingAvatarNameState] = useState<string | null>(() => readStoredPendingName())
  const isPromotingGuestAvatarRef = useRef(false)
  const applyBackendAvatars = useCallback((items: AvatarListItem[]) => {
    setAvatarList(normalizeAvatarList(items))
  }, [])

  const refreshAvatars = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    const items = await listAvatars()
    applyBackendAvatars(items)
  }, [applyBackendAvatars, isAuthenticated, listAvatars])

  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      if (!isAuthenticated) {
        return
      }

      try {
        const items = await listAvatars()
        if (!isCancelled) {
          applyBackendAvatars(items)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load avatars', error)
        }
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [applyBackendAvatars, isAuthenticated, listAvatars])

  useEffect(() => {
    if (!isAuthenticated) {
      setAvatarList([])
    }
  }, [isAuthenticated])

  const setPendingAvatarName = useCallback((name: string | null) => {
    setPendingAvatarNameState(name ? name.trim() : null)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      isPromotingGuestAvatarRef.current = false
      return
    }

    if (isPromotingGuestAvatarRef.current) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    let rawCommand: string | null = null
    try {
      rawCommand = window.localStorage.getItem('pendingAvatarData')
    } catch (error) {
      console.warn('Failed to read pending guest avatar data', error)
      return
    }

    if (!rawCommand) {
      return
    }

    let command: CreateAvatarCommand | null = null
    try {
      command = JSON.parse(rawCommand) as CreateAvatarCommand
    } catch (error) {
      console.warn('Failed to parse pending guest avatar JSON', error)
      return
    }

    if (!command || command.type !== 'createAvatar' || !command.data) {
      return
    }

    const sanitizeMeasurementRecord = (
      source?: Record<string, number | string | null | undefined>,
    ): Record<string, number | null> | undefined => {
      if (!source) {
        return undefined
      }

      const entries = Object.entries(source).reduce<Record<string, number | null>>((acc, [key, value]) => {
        if (!key || key === 'creationMode') {
          return acc
        }

        if (value == null) {
          acc[key] = null
          return acc
        }

        const numericValue = Number(value)
        if (Number.isFinite(numericValue)) {
          acc[key] = numericValue
        }

        return acc
      }, {})

      return Object.keys(entries).length ? entries : undefined
    }

    const sanitizeMorphTargets = (
      source?: Record<string, number | string | null | undefined>,
    ): Record<string, number> | undefined => {
      if (!source) {
        return undefined
      }

      const morphTargets = Object.entries(source).reduce<Record<string, number>>((acc, [key, value]) => {
        if (!key) {
          return acc
        }

        const numericValue = Number(value)
        if (Number.isFinite(numericValue)) {
          acc[key] = numericValue
        }

        return acc
      }, {})

      return Object.keys(morphTargets).length ? morphTargets : undefined
    }

    const sanitizeQuickModeSettings = (
      source?: CreateAvatarCommand['data']['quickModeSettings'],
    ): AvatarPayload['quickModeSettings'] => {
      if (!source) {
        return null
      }

      const normalized: AvatarPayload['quickModeSettings'] = {}

      const coerceUpdatedAt = (value: unknown): string | null => {
        if (!value) {
          return null
        }

        if (value instanceof Date) {
          const timestamp = value.getTime()
          if (Number.isFinite(timestamp)) {
            return new Date(timestamp).toISOString()
          }
          return null
        }

        if (typeof value === 'number') {
          if (Number.isFinite(value)) {
            return new Date(value).toISOString()
          }
          return null
        }

        if (typeof value === 'string') {
          const trimmed = value.trim()
          return trimmed.length > 0 ? trimmed : null
        }

        return null
      }

      const bodyShape = typeof source.bodyShape === 'string' ? source.bodyShape.trim() : null
      if (bodyShape) {
        normalized.bodyShape = bodyShape
      }

      const athleticLevel = typeof source.athleticLevel === 'string' ? source.athleticLevel.trim() : null
      if (athleticLevel) {
        normalized.athleticLevel = athleticLevel
      }

      const measurements = source.measurements
      if (measurements && typeof measurements === 'object') {
        const parsed = Object.entries(measurements).reduce<Record<string, number>>((acc, [key, value]) => {
          if (!key) {
            return acc
          }
          const numericValue = Number(value)
          if (Number.isFinite(numericValue)) {
            acc[key] = numericValue
          }
          return acc
        }, {})
        if (Object.keys(parsed).length) {
          normalized.measurements = parsed
        }
      }

      const updatedAtValue = coerceUpdatedAt(source.updatedAt)
      if (updatedAtValue) {
        normalized.updatedAt = updatedAtValue
      }

      return Object.keys(normalized).length ? normalized : null
    }

    const guestData = command.data
    const trimmedName = guestData.avatarName?.trim()
    const resolvedName = trimmedName && trimmedName.length > 0 ? trimmedName : 'Guest Avatar'

    const basicMeasurements = sanitizeMeasurementRecord(guestData.basicMeasurements)
    const bodyMeasurements = sanitizeMeasurementRecord(guestData.bodyMeasurements)
    const morphTargets = sanitizeMorphTargets(guestData.morphTargets)
    const quickModeSettings = sanitizeQuickModeSettings(guestData.quickModeSettings)

    const payload: AvatarPayload = {
      name: resolvedName,
      avatarName: resolvedName,
      gender: guestData.gender,
      ageRange: guestData.ageRange,
      creationMode: 'quickMode',
      quickMode: true,
      source: 'guest',
      ...(basicMeasurements ? { basicMeasurements } : {}),
      ...(bodyMeasurements ? { bodyMeasurements } : {}),
      ...(morphTargets ? { morphTargets } : {}),
      quickModeSettings,
    }

    isPromotingGuestAvatarRef.current = true

    void (async () => {
      try {
        const result = await createAvatar(payload)
        const backendAvatar = result.backendAvatar
        const avatarId = result.avatarId ?? backendAvatar?.id ?? null

        try {
          window.localStorage.removeItem('pendingAvatarData')
          window.localStorage.removeItem('pendingAvatarId')
        } catch (error) {
          console.warn('Failed to clear pending guest avatar keys', error)
        }

        try {
          setPendingAvatarName(null)
        } catch (error) {
          console.warn('Failed to clear pending avatar name', error)
        }

        if (backendAvatar || avatarId) {
          const backendMorphTargets = backendAvatar?.morphTargets ?? null
          const metadata = {
            avatarId: avatarId,
            name: backendAvatar?.name ?? payload.name,
            avatarName: backendAvatar?.name ?? payload.name,
            gender: backendAvatar?.gender ?? payload.gender,
            ageRange: backendAvatar?.ageRange ?? payload.ageRange,
            basicMeasurements: backendAvatar?.basicMeasurements ?? payload.basicMeasurements ?? null,
            bodyMeasurements: backendAvatar?.bodyMeasurements ?? payload.bodyMeasurements ?? null,
            morphTargets: backendMorphTargets ?? null,
            quickMode: backendAvatar?.quickMode ?? payload.quickMode ?? null,
            creationMode: backendAvatar?.creationMode ?? payload.creationMode ?? null,
            quickModeSettings: backendAvatar?.quickModeSettings ?? payload.quickModeSettings ?? null,
            source: backendAvatar?.source ?? payload.source ?? null,
          }

          try {
            window.sessionStorage.setItem(
              LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
              JSON.stringify(metadata),
            )
          } catch (error) {
            console.warn('Failed to persist created avatar metadata', error)
          }
        }

        try {
          await refreshAvatars()
        } catch (error) {
          console.error('Failed to refresh avatars after guest promotion', error)
        }
      } catch (error) {
        console.error('Failed to promote guest avatar to backend', error)
        isPromotingGuestAvatarRef.current = false
      }
    })()
  }, [createAvatar, isAuthenticated, refreshAvatars, setPendingAvatarName])

  useEffect(() => {
    persistPendingName(pendingAvatarName)
  }, [pendingAvatarName])

  const value = useMemo<AvatarContextValue>(
    () => ({
      avatars,
      maxAvatars: MAX_AVATARS,
      refreshAvatars,
      pendingAvatarName,
      setPendingAvatarName
    }),
    [avatars, pendingAvatarName, refreshAvatars, setPendingAvatarName]
  )

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
}

export function useAvatars() {
  const ctx = useContext(AvatarContext)
  if (!ctx) {
    throw new Error('useAvatars must be used within an AvatarProvider')
  }
  return ctx
}