import { useEffect, useState } from 'react'
import { useDebug } from '../../hooks/useDebug'
import { usePixelStreamingSettings } from '../../hooks/usePixelStreamingSettings'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useAuthData } from '../../hooks/useAuthData'
import { useUserSettings } from '../../hooks/useUserSettings'
import { PixelStreamingWrapper } from '../PixelStreamingDebugWrapper/PixelStreamingDebugWrapper'
import packageJson from '../../../package.json'
import styles from './DebugOverlay.module.scss'

export default function DebugOverlay() {
  const { isDebug, toggleDebug } = useDebug()
  const { settings, updateSettings } = usePixelStreamingSettings()
  const { devMode, setDevMode, hideNativeOverlay, setHideNativeOverlay } = usePixelStreaming()
  const globalAuthData = useAuthData()
  const userSettings = useUserSettings()

  // State for collapsible sections
  const [isAuthExpanded, setIsAuthExpanded] = useState(false)
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)
  const [isGeneralExpanded, setIsGeneralExpanded] = useState(false)

  const handleLogGlobalAuthData = () => {
    console.group('🌐 Global Auth Data (from Context)')
    console.log('Global Auth Data:', globalAuthData)
    console.log('Is Authenticated:', globalAuthData.isAuthenticated)
    console.log('User ID:', globalAuthData.userId)
    console.log('Session ID:', globalAuthData.sessionId)
    console.log('Email:', globalAuthData.email)
    console.log('Full Auth Data Object:', globalAuthData.authData)
    console.groupEnd()
  }

  const handleLogUserSettings = () => {
    console.group('🖥️ User Settings (from Context)')
    console.log('User Settings:', userSettings.settings)
    console.log('Resolution:', `${userSettings.screenWidth}x${userSettings.screenHeight}`)
    console.log('Is Mobile:', userSettings.isMobile)
    console.log('Measurements:', userSettings.settings.measurements)
    console.log('Last Updated:', userSettings.settings.lastUpdated)
    console.groupEnd()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug mode (case-insensitive)
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        e.stopPropagation()
        toggleDebug()
      }
      // Escape key to close debug mode when it's open
      if (isDebug && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        toggleDebug()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [toggleDebug, isDebug])

  if (!isDebug) return null

  return (
    <div className={styles.debugOverlay}>
      <div className={styles.debugHeader}>
        <div className={styles.debugTitle}>
          <h3>Debug Mode v{packageJson.version}</h3>
        </div>
        <div className={styles.debugControls}>
          <span className={styles.shortcutHint}>Ctrl+Shift+D or Escape to toggle</span>
          <button 
            className={styles.closeButton}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleDebug()
            }}
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className={styles.debugContent}>
        <div className={styles.debugSection}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            cursor: 'pointer'
          }}
          onClick={() => setIsGeneralExpanded(!isGeneralExpanded)}>
            <h4 style={{ margin: 0, marginRight: '8px' }}>General</h4>
            <span style={{ fontSize: '14px', color: '#888' }}>
              {isGeneralExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isGeneralExpanded && (
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#ccc',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="checkbox"
                    checked={devMode}
                    onChange={(e) => setDevMode(e.target.checked)}
                    style={{ 
                      marginRight: '8px',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <span>
                    <strong>Dev Mode:</strong> Skip lambda calls and redirect directly to virtual-try-on
                  </span>
                </label>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#888',
                  marginTop: '4px',
                  marginLeft: '24px'
                }}>
                  When enabled, instance creation will bypass lambda calls and redirect directly to /virtual-try-on
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#ccc',
                  cursor: 'pointer'
                }}>
                  <input 
                    type="checkbox"
                    checked={hideNativeOverlay}
                    onChange={(e) => setHideNativeOverlay(e.target.checked)}
                    style={{ 
                      marginRight: '8px',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  <span>
                    <strong>Hide Pixelstreaming Settings:</strong> Hide the native settings overlay
                  </span>
                </label>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#888',
                  marginTop: '4px',
                  marginLeft: '24px'
                }}>
                  When enabled, hides the uiFeatures overlay in the upper left corner of the Pixel Streaming view
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.debugSection}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            cursor: 'pointer'
          }}
          onClick={() => setIsAuthExpanded(!isAuthExpanded)}>
            <h4 style={{ margin: 0, marginRight: '8px' }}>Global Authentication Data</h4>
            <span style={{ fontSize: '14px', color: '#888' }}>
              {isAuthExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isAuthExpanded && (
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <button 
                  onClick={handleLogGlobalAuthData}
                  style={{ 
                    padding: '4px 8px', 
                    marginRight: '8px',
                    backgroundColor: '#10B981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    fontSize: '12px'
                  }}
                >
                  Log Global Auth to Console
                </button>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  Status: {globalAuthData.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                </span>
              </div>
              <div>
                <strong style={{ fontSize: '11px', color: '#888' }}>Global Auth Data:</strong>
                <pre style={{ 
                  fontSize: '10px', 
                  color: '#ccc', 
                  margin: '4px 0 0 0',
                  maxHeight: '200px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #333',
                  padding: '6px',
                  borderRadius: '2px'
                }}>
                  {JSON.stringify({
                    isAuthenticated: globalAuthData.isAuthenticated,
                    userId: globalAuthData.userId,
                    sessionId: globalAuthData.sessionId,
                    email: globalAuthData.email,
                    authData: globalAuthData.authData
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className={styles.debugSection}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            cursor: 'pointer'
          }}
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}>
            <h4 style={{ margin: 0, marginRight: '8px' }}>User Settings</h4>
            <span style={{ fontSize: '14px', color: '#888' }}>
              {isSettingsExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isSettingsExpanded && (
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <button 
                  onClick={handleLogUserSettings}
                  style={{ 
                    padding: '4px 8px', 
                    marginRight: '8px',
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    fontSize: '12px'
                  }}
                >
                  Log User Settings to Console
                </button>
                <button 
                  onClick={userSettings.refreshSettings}
                  style={{ 
                    padding: '4px 8px', 
                    marginRight: '8px',
                    backgroundColor: '#8B5CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    fontSize: '12px'
                  }}
                >
                  Refresh Settings
                </button>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  Device: {userSettings.screenWidth}x{userSettings.screenHeight} ({userSettings.isMobile ? 'Mobile' : 'Desktop'})
                </span>
              </div>
              <div>
                <strong style={{ fontSize: '11px', color: '#888' }}>User Settings:</strong>
                <pre style={{ 
                  fontSize: '10px', 
                  color: '#ccc', 
                  margin: '4px 0 0 0',
                  maxHeight: '200px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #333',
                  padding: '6px',
                  borderRadius: '2px'
                }}>
                  {JSON.stringify({
                    resolution: userSettings.settings.resolution,
                    isMobileDevice: userSettings.settings.isMobileDevice,
                    measurements: userSettings.settings.measurements,
                    lastUpdated: userSettings.settings.lastUpdated
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        
        <div className={styles.debugSection}>
          <h4>Pixel Streaming Debug</h4>
          <div style={{ 
            height: 'calc(100vh - 300px)', 
            border: '1px solid #444',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <PixelStreamingWrapper 
              initialDebugSettings={settings}
              onDebugSettingsChange={updateSettings}
            />
          </div>
        </div>
        
        {/* Future debug sections can be added here */}
        {/* 
        <div className={styles.debugSection}>
          <h4>Route Debug</h4>
          // Route debugging component
        </div>
        */}
      </div>
    </div>
  )
}
