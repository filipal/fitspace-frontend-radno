/**
 * Example of how to use the GLOBAL authentication utilities in your components
 * This shows both the original hooks and the new global context approach
 */

import { useAuthInfo, useUserId, useSessionId, useTokens } from '../hooks/useAuthInfo'
import { useAuthData, useGlobalUserId, useGlobalSessionId, useGlobalEmail } from '../hooks/useAuthData'

export function ExampleAuthComponent() {
  // OLD WAY: Direct access to auth context (still works)
  const authInfo = useAuthInfo()
  const userId = useUserId()
  const sessionId = useSessionId()
  const { idToken, accessToken, refreshToken, isValid } = useTokens()

  // NEW WAY: Global auth data from context (recommended for most use cases)
  const globalAuth = useAuthData()
  const globalUserId = useGlobalUserId()
  const globalSessionId = useGlobalSessionId()
  const globalEmail = useGlobalEmail()

  // Handle API calls with tokens
  const makeApiCall = async () => {
    if (!isValid) {
      console.error('No valid access token')
      return
    }

    try {
      const response = await fetch('/api/some-endpoint', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      console.log('API Response:', data)
    } catch (error) {
      console.error('API Error:', error)
    }
  }

  if (!globalAuth.isAuthenticated) {
    return <div>Please log in to see auth info</div>
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h3>Global Authentication Data Example</h3>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ color: '#0066cc' }}>🆕 Global Context (Recommended)</h4>
          <div><strong>User ID:</strong> {globalUserId}</div>
          <div><strong>Session ID:</strong> {globalSessionId}</div>
          <div><strong>Email:</strong> {globalEmail}</div>
          <div><strong>Is Authenticated:</strong> {globalAuth.isAuthenticated ? '✅' : '❌'}</div>
        </div>
        
        <div style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px' }}>
          <h4 style={{ color: '#666' }}>📜 Direct Access (Still works)</h4>
          <div><strong>User ID:</strong> {userId}</div>
          <div><strong>Session ID:</strong> {sessionId}</div>
          <div><strong>Email:</strong> {authInfo.email}</div>
          <div><strong>Is Authenticated:</strong> {authInfo.isAuthenticated ? '✅' : '❌'}</div>
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <strong>Tokens Available:</strong>
        <ul>
          <li>ID Token: {idToken ? '✓' : '✗'}</li>
          <li>Access Token: {accessToken ? '✓' : '✗'}</li>
          <li>Refresh Token: {refreshToken ? '✓' : '✗'}</li>
        </ul>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => globalAuth.refreshAuthData()} style={{ marginRight: '8px' }}>
          🔄 Refresh Global Auth Data
        </button>
        <button onClick={() => globalAuth.clearAuthData()} style={{ marginRight: '8px' }}>
          🗑️ Clear Global Auth Data
        </button>
        <button onClick={makeApiCall} disabled={!isValid}>
          🚀 Test API Call
        </button>
      </div>
      
      <details>
        <summary>Full Global Auth Data JSON</summary>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(globalAuth.authData, null, 2)}
        </pre>
      </details>
    </div>
  )
}

// Export for use in other files if needed
export default ExampleAuthComponent
