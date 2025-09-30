import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface AvatarRecord {
  id: string
  name: string
  createdAt: string
}

const STORAGE_KEY = 'fitspace:avatars'
const PENDING_NAME_KEY = 'fitspace:pending-avatar-name'
const MAX_AVATARS = 5

type AvatarUpdater = AvatarRecord[] | ((prev: AvatarRecord[]) => AvatarRecord[])

interface AvatarContextValue {
  avatars: AvatarRecord[]
  maxAvatars: number
  updateAvatars: (updater: AvatarUpdater) => void
  createAvatar: (name?: string) => AvatarRecord | null
  removeAvatar: (id: string) => void
  pendingAvatarName: string | null
  setPendingAvatarName: (name: string | null) => void
}

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined)

const readStoredAvatars = (): AvatarRecord[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as AvatarRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(a => typeof a?.id === 'string' && typeof a?.name === 'string')
  } catch (err) {
    console.error('Failed to parse stored avatars', err)
    return []
  }
}

const readStoredPendingName = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(PENDING_NAME_KEY)
}

const persistAvatars = (avatars: AvatarRecord[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(avatars))
}

const persistPendingName = (name: string | null) => {
  if (typeof window === 'undefined') return
  if (name && name.trim()) {
    window.sessionStorage.setItem(PENDING_NAME_KEY, name)
  } else {
    window.sessionStorage.removeItem(PENDING_NAME_KEY)
  }
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [avatars, setAvatarList] = useState<AvatarRecord[]>(() => readStoredAvatars())
  const [pendingAvatarName, setPendingAvatarNameState] = useState<string | null>(() => readStoredPendingName())
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    if (!hasHydratedRef.current && typeof window !== 'undefined') {
      // Ensure we read again after hydration in case SSR provided empty state
      setAvatarList(readStoredAvatars())
      setPendingAvatarNameState(readStoredPendingName())
      hasHydratedRef.current = true
    }
  }, [])

  useEffect(() => {
    persistAvatars(avatars)
  }, [avatars])

  useEffect(() => {
    persistPendingName(pendingAvatarName)
  }, [pendingAvatarName])

  const updateAvatars = useCallback((updater: AvatarUpdater) => {
    setAvatarList(prev =>
      typeof updater === 'function'
        ? (updater as (prev: AvatarRecord[]) => AvatarRecord[])(prev)
        : updater
    )
  }, [])

  const removeAvatar = useCallback((id: string) => {
    setAvatarList(prev => prev.filter(avatar => avatar.id !== id))
  }, [])

  const createAvatar = useCallback(
    (name?: string): AvatarRecord | null => {
      let created: AvatarRecord | null = null
      setAvatarList(prev => {
        if (prev.length >= MAX_AVATARS) {
          return prev
        }
        const rawName = name ?? pendingAvatarName ?? ''
        const trimmed = rawName.trim()
        const finalName = trimmed || `Avatar ${prev.length + 1}`
        const newAvatar: AvatarRecord = {
          id: generateId(),
          name: finalName,
          createdAt: new Date().toISOString()
        }
        created = newAvatar
        return [...prev, newAvatar]
      })
      if (created) {
        setPendingAvatarNameState(null)
      }
      return created
    },
    [pendingAvatarName]
  )

  const setPendingAvatarName = useCallback((name: string | null) => {
    setPendingAvatarNameState(name ? name.trim() : null)
  }, [])

  const value = useMemo<AvatarContextValue>(
    () => ({
      avatars,
      maxAvatars: MAX_AVATARS,
      updateAvatars,
      createAvatar,
      removeAvatar,
      pendingAvatarName,
      setPendingAvatarName
    }),
    [avatars, createAvatar, pendingAvatarName, removeAvatar, setPendingAvatarName, updateAvatars]
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