import { type ReactElement, type ReactNode, useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthData } from '../hooks/useAuthData'

interface GuestAccessibleRouteProps {
  children: ReactNode
}

const hasGuestAccessTokens = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const pendingData = window.localStorage.getItem('pendingAvatarData')
    const pendingId = window.localStorage.getItem('pendingAvatarId')
    return Boolean(pendingData || pendingId)
  } catch (error) {
    console.warn('Failed to inspect guest avatar boot data', error)
    return false
  }
}

export default function GuestAccessibleRoute({ children }: GuestAccessibleRouteProps): ReactElement {
  const location = useLocation()
  const { isAuthenticated } = useAuthData()

  const allowGuestAccess = useMemo(() => {
    if (isAuthenticated) {
      return true
    }

    return hasGuestAccessTokens()
  }, [isAuthenticated])

  if (!allowGuestAccess) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}