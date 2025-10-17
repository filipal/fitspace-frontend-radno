import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'
import { getAuthInfo, type AuthInfo } from '../utils/authUtils'

export interface AuthDataContextType {
  // Processed auth data
  authData: AuthInfo | null
  
  // Helper getters for common values
  isAuthenticated: boolean
  userId: string | null
  sessionId: string | null
  email: string | null
  
  // Actions
  refreshAuthData: () => void
  clearAuthData: () => void
}

export const AuthDataContext = createContext<AuthDataContextType | undefined>(undefined)

interface AuthDataProviderProps {
  children: ReactNode
}

/**
 * AuthDataProvider - Wraps the app and provides global access to processed auth data
 * This sits on top of react-oidc-context and processes/stores the auth information
 */
export function AuthDataProvider({ children }: AuthDataProviderProps) {
  const auth = useAuth()
  const [authData, setAuthData] = useState<AuthInfo | null>(null)

  // Process and store auth data whenever auth state changes
  useEffect(() => {
    if (auth.isLoading || auth.activeNavigator) {
      setAuthData(prev => (prev === null ? prev : null))
      return
    }

    const processedAuthData = getAuthInfo(auth.user, auth.isAuthenticated)
    setAuthData(processedAuthData)
    
    // Log auth data changes (for development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Auth data updated:', processedAuthData)
    }
  }, [auth.user, auth.isAuthenticated, auth.isLoading, auth.activeNavigator])

  // Helper function to manually refresh auth data
  const refreshAuthData = () => {
    const processedAuthData = getAuthInfo(auth.user, auth.isAuthenticated)
    setAuthData(processedAuthData)
  }

  // Helper function to clear auth data (e.g., on logout)
  const clearAuthData = () => {
    setAuthData(null)
  }

  // Derived values for easy access
  const isAuthenticated = authData?.isAuthenticated ?? false
  const userId = authData?.userId ?? null
  const sessionId = authData?.sessionId ?? null
  const email = authData?.email ?? null

  const contextValue: AuthDataContextType = {
    authData,
    isAuthenticated,
    userId,
    sessionId,
    email,
    refreshAuthData,
    clearAuthData
  }

  return (
    <AuthDataContext.Provider value={contextValue}>
      {children}
    </AuthDataContext.Provider>
  )
}