import { useAuth } from 'react-oidc-context'
import { getAuthInfo, type AuthInfo } from '../utils/authUtils'

/**
 * Custom hook to easily access authentication information
 * This replaces AWS Amplify's Auth.currentAuthenticatedUser() and Auth.currentSession()
 */
export function useAuthInfo(): AuthInfo {
  const auth = useAuth()
  const authInfo = getAuthInfo(auth.user, auth.isAuthenticated)
  
  return authInfo
}

/**
 * Get just the user ID (Cognito sub)
 */
export function useUserId(): string | undefined {
  const auth = useAuth()
  return auth.user?.profile?.sub
}

/**
 * Get just the session ID (Access Token JTI - not ID token JTI)
 */
export function useSessionId(): string | undefined {
  const auth = useAuth()
  const authInfo = getAuthInfo(auth.user, auth.isAuthenticated)
  return authInfo.sessionId
}

/**
 * Get tokens for API calls
 */
export function useTokens() {
  const auth = useAuth()
  
  return {
    idToken: auth.user?.id_token,
    accessToken: auth.user?.access_token,
    refreshToken: auth.user?.refresh_token,
    isValid: auth.isAuthenticated && !!auth.user?.access_token
  }
}
