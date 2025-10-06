import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAvatarApi, type AvatarListItem } from '../services/avatarApi'
import { useAuthData } from '../hooks/useAuthData'

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
  const { listAvatars } = useAvatarApi()
  const { isAuthenticated } = useAuthData()
  const [avatars, setAvatarList] = useState<AvatarRecord[]>([])
  const [pendingAvatarName, setPendingAvatarNameState] = useState<string | null>(() => readStoredPendingName())
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

  useEffect(() => {
    persistPendingName(pendingAvatarName)
  }, [pendingAvatarName])

  const setPendingAvatarName = useCallback((name: string | null) => {
    setPendingAvatarNameState(name ? name.trim() : null)
  }, [])

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