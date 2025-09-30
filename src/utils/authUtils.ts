// Using any type since User is not exported from react-oidc-context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type User = any

export interface AuthInfo {
  // User identifiers
  userId?: string
  sessionId?: string // JWT ID (jti) from ACCESS TOKEN
  
  // Session timing
  issuedAt?: string
  expiresAt?: string
  authTime?: string
  
  // Profile information
  email?: string
  emailVerified?: boolean
  phone?: string
  phoneVerified?: boolean
  
  // Tokens
  idToken?: string
  accessToken?: string
  refreshToken?: string
  tokenType?: string
  
  // Token metadata
  tokenUse?: string
  audience?: string
  issuer?: string
  
  // Status
  isAuthenticated: boolean
}

/**
 * Decode JWT token to inspect all claims (for debugging only!)
 * DO NOT use this in production - tokens should be validated server-side
 */
export function decodeJWT(token: string) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }
    
    const header = JSON.parse(atob(parts[0]))
    const payload = JSON.parse(atob(parts[1]))
    
    return { header, payload }
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

/**
 * Extract authentication information from react-oidc-context User object
 * This is equivalent to AWS Amplify's Auth.currentAuthenticatedUser() and Auth.currentSession()
 */
export function getAuthInfo(user: User | null | undefined, isAuthenticated: boolean): AuthInfo {
  if (!isAuthenticated || !user) {
    return { isAuthenticated: false }
  }

  try {
    const profile = user.profile
    
    // Extract sessionId from access token's jti field
    let sessionId: string | undefined
    if (user.access_token) {
      const decoded = decodeJWT(user.access_token)
      if (decoded?.payload?.jti) {
        sessionId = decoded.payload.jti
      }
    }

    return {
      isAuthenticated: true,
      
      // User identification
      userId: profile?.sub,  // Cognito user ID (equivalent to user.username in Amplify)
      sessionId: sessionId,  // JWT ID from ACCESS TOKEN (not ID token)
      
      // Session timing information
      issuedAt: profile?.iat ? new Date(profile.iat * 1000).toISOString() : undefined,
      expiresAt: user.expires_at ? new Date(user.expires_at * 1000).toISOString() : undefined,
      authTime: profile?.auth_time ? new Date(profile.auth_time * 1000).toISOString() : undefined,
      
      // Profile information
      email: profile?.email,
      emailVerified: profile?.email_verified === true,
      phone: profile?.phone_number,
      phoneVerified: profile?.phone_number_verified === true,
      
      // Tokens (equivalent to Auth.currentSession() in Amplify)
      idToken: user.id_token,  // JWT ID token
      accessToken: user.access_token,  // Access token
      refreshToken: user.refresh_token,  // Refresh token
      tokenType: user.token_type,
      
      // Token metadata
      tokenUse: profile?.token_use,  // 'id' for ID token, 'access' for access token
      audience: profile?.aud,  // Client ID that the token was issued for
      issuer: profile?.iss,  // Cognito issuer URL
    }
  } catch (error) {
    console.error('Error extracting auth info:', error)
    return { isAuthenticated: false }
  }
}
