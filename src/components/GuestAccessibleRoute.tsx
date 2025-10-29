import { type ReactElement, type ReactNode, useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthData } from '../hooks/useAuthData'
import {
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  LAST_LOADED_AVATAR_STORAGE_KEY,
} from '../services/avatarApi'

interface GuestAccessibleRouteProps {
  children: ReactNode
  allowGuestWithoutTokens?: boolean
}

const hasGuestAccessTokens = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  let hasLocalTokens = false
  try {
    const pendingData = window.localStorage.getItem('pendingAvatarData')
    const pendingId = window.localStorage.getItem('pendingAvatarId')
    hasLocalTokens = Boolean(pendingData || pendingId)
  } catch (error) {
    console.warn('Failed to inspect guest avatar boot data (localStorage)', error)
  }

  if (hasLocalTokens) {
    return true
  }

  try {
    const lastLoaded = window.sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
    const pendingMetadata = window.sessionStorage.getItem(LAST_CREATED_AVATAR_METADATA_STORAGE_KEY)
    return Boolean(lastLoaded || pendingMetadata)
  } catch (error) {
    console.warn('Failed to inspect guest avatar boot data (sessionStorage)', error)
    return false
  }
}

export default function GuestAccessibleRoute({
  children,
  allowGuestWithoutTokens = false,
}: GuestAccessibleRouteProps): ReactElement {
  const location = useLocation()
  const { isAuthenticated } = useAuthData()

  const allowGuestAccess = useMemo(() => {
    if (isAuthenticated || allowGuestWithoutTokens) {
      return true
    }

    return hasGuestAccessTokens()
  }, [allowGuestWithoutTokens, isAuthenticated])

  if (!allowGuestAccess) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}