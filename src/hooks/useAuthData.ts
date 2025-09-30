import { useContext } from 'react'
import { AuthDataContext } from '../context/AuthDataContext'
import type { AuthInfo } from '../utils/authUtils'

interface AuthDataContextType {
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

/**
 * Hook to access global auth data from anywhere in the app
 * This provides the processed auth data stored in AuthDataContext
 * 
 * @returns AuthDataContextType with auth data and helper methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { userId, sessionId, email, isAuthenticated } = useAuthData()
 *   
 *   if (!isAuthenticated) return <div>Please log in</div>
 *   
 *   return (
 *     <div>
 *       <p>User ID: {userId}</p>
 *       <p>Session ID: {sessionId}</p>
 *       <p>Email: {email}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAuthData(): AuthDataContextType {
  const context = useContext(AuthDataContext)
  
  if (context === undefined) {
    throw new Error('useAuthData must be used within an AuthDataProvider')
  }
  
  return context
}

/**
 * Get just the user ID from global auth data
 */
export function useGlobalUserId(): string | null {
  const { userId } = useAuthData()
  return userId
}

/**
 * Get just the session ID from global auth data
 */
export function useGlobalSessionId(): string | null {
  const { sessionId } = useAuthData()
  return sessionId
}

/**
 * Get just the email from global auth data
 */
export function useGlobalEmail(): string | null {
  const { email } = useAuthData()
  return email
}

export type { AuthDataContextType }