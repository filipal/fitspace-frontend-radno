import { useEffect, useState } from 'react'
import { useDebug } from '../../hooks/useDebug'
import { usePixelStreamingSettings } from '../../hooks/usePixelStreamingSettings'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useAuthData } from '../../hooks/useAuthData'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useInstanceManagement } from '../../context/InstanceManagementContext'
import { PixelStreamingWrapper } from '../PixelStreamingDebugWrapper/PixelStreamingDebugWrapper'
import packageJson from '../../../package.json'
import styles from './DebugOverlay.module.scss'

export default function DebugOverlay() {
  const { isDebug, toggleDebug } = useDebug()
  const { settings, updateSettings } = usePixelStreamingSettings()
  const { devMode, setDevMode, hideNativeOverlay, setHideNativeOverlay } = usePixelStreaming()
  const globalAuthData = useAuthData()
  const userSettings = useUserSettings()
  const { instanceData } = useInstanceManagement()

  // State for collapsible sections
  const [isAuthExpanded, setIsAuthExpanded] = useState(false)
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)
  const [isGeneralExpanded, setIsGeneralExpanded] = useState(false)
  const [isServerControlsExpanded, setIsServerControlsExpanded] = useState(false)
  const [isMobileDebugExpanded, setIsMobileDebugExpanded] = useState(false)

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

  // Terminate UE server function
  const handleTerminateUEServer = async () => {
    if (!instanceData?.instanceId) {
      console.error('❌ No instance ID available for termination');
      alert('No instance ID available for termination');
      return;
    }

    try {
      console.log('🔥 Terminating UE server for instance:', instanceData.instanceId);
      
      const response = await fetch('https://hfijogsomw73ojgollhdr75oqq0osdlq.lambda-url.eu-central-1.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: instanceData.instanceId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Terminate UE server response:', result);
      
      if (result.status === 'TERMINATED') {
        alert(`Server terminated successfully! Instance: ${result.instanceId}`);
      } else {
        alert('Server termination initiated, check console for details');
      }
    } catch (error) {
      console.error('❌ Failed to terminate UE server:', error);
      alert(`Failed to terminate UE server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

    const handleTouchStart = (e: TouchEvent) => {
      // Three-finger tap to toggle debug mode on mobile
      if (e.touches.length === 3) {
        e.preventDefault()
        e.stopPropagation()
        toggleDebug()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false })
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('touchstart', handleTouchStart, { capture: true })
    }
  }, [toggleDebug, isDebug])

  if (!isDebug) return null

  return (
    <div className={styles.debugOverlay}>
      <div className={styles.debugHeader}>
        <div className={styles.debugTitle}>
          <h3>Debug Mode v{packageJson.version}</h3>
        </div>
        <div className={styles.debugControls}>
          <span className={styles.shortcutHint}>Ctrl+Shift+D, 3-finger tap, or Escape to toggle</span>
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
                  display: 'block', 
                  fontSize: '12px',
                  color: '#ccc',
                  marginBottom: '4px'
                }}>
                  <strong>Dev Mode:</strong> Control instance creation behavior
                </label>
                <select 
                  value={devMode}
                  onChange={(e) => setDevMode(e.target.value as 'dev' | 'prod' | 'localhost')}
                  style={{ 
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#2a2a2a',
                    color: '#ccc',
                    border: '1px solid #444',
                    borderRadius: '4px'
                  }}
                >
                  <option value="dev">Dev - Skip lambda, go to try-on page</option>
                  <option value="prod">Prod - Trigger lambda calls normally</option>
                  <option value="localhost">Localhost - Connect to ws://localhost:80</option>
                </select>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#888',
                  marginTop: '4px'
                }}>
                  • <strong>Dev:</strong> Bypass lambda calls and redirect directly to /virtual-try-on<br/>
                  • <strong>Prod:</strong> Normal lambda provisioning workflow<br/>
                  • <strong>Localhost:</strong> Skip lambda, connect to local websocket server
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
          onClick={() => setIsServerControlsExpanded(!isServerControlsExpanded)}>
            <h4 style={{ margin: 0, marginRight: '8px' }}>Server Controls</h4>
            <span style={{ fontSize: '14px', color: '#888' }}>
              {isServerControlsExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isServerControlsExpanded && (
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <button 
                  onClick={handleTerminateUEServer}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '12px', 
                    borderRadius: '4px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  title={instanceData?.instanceId ? `Terminate instance: ${instanceData.instanceId}` : 'No instance ID available'}
                >
                  🔥 Terminate UE Server
                </button>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#888',
                  marginTop: '4px'
                }}>
                  Terminates the current UE server instance{instanceData?.instanceId ? ` (${instanceData.instanceId})` : ' (no instance ID available)'}
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
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            cursor: 'pointer'
          }}
          onClick={() => setIsMobileDebugExpanded(!isMobileDebugExpanded)}>
            <h4 style={{ margin: 0, marginRight: '8px' }}>Mobile & Connection Debug</h4>
            <span style={{ fontSize: '14px', color: '#888' }}>
              {isMobileDebugExpanded ? '▼' : '▶'}
            </span>
          </div>
          {isMobileDebugExpanded && (
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              border: '1px solid #444',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '12px', color: '#f39c12' }}>Device Information:</strong>
                <pre style={{ 
                  fontSize: '10px', 
                  color: '#ccc', 
                  margin: '4px 0',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #333',
                  padding: '6px',
                  borderRadius: '2px'
                }}>
                  {JSON.stringify({
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                    autoPlayVideo: settings.AutoPlayVideo,
                    autoPlayPolicy: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                      ? 'disabled (requires user gesture)' 
                      : 'enabled (desktop)',
                    screenSize: `${window.screen.width}x${window.screen.height}`,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                    devicePixelRatio: window.devicePixelRatio,
                    connection: (navigator as any).connection ? {
                      effectiveType: (navigator as any).connection.effectiveType,
                      downlink: (navigator as any).connection.downlink,
                      rtt: (navigator as any).connection.rtt,
                      saveData: (navigator as any).connection.saveData
                    } : 'not available',
                    languages: navigator.languages,
                    cookieEnabled: navigator.cookieEnabled,
                    doNotTrack: navigator.doNotTrack,
                    maxTouchPoints: navigator.maxTouchPoints,
                    timestamp: new Date().toISOString()
                  }, null, 2)}
                </pre>
              </div>
              
              <div style={{ 
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? '#2d1b69' : '#1a5a3e',
                borderRadius: '4px',
                border: '1px solid ' + (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? '#5b21b6' : '#10b981')
              }}>
                <strong style={{ fontSize: '12px', color: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? '#a78bfa' : '#6ee7b7' }}>
                  Video Autoplay Policy:
                </strong>
                <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                  {/Android|webOS|iPhone|iPad|IPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? (
                    <>
                      🔇 <strong>Mobile:</strong> AutoPlayVideo disabled - requires user tap/gesture to start video stream.
                      This is intentional to comply with mobile browser autoplay policies.
                    </>
                  ) : (
                    <>
                      🔊 <strong>Desktop:</strong> AutoPlayVideo enabled - video will start automatically when connected.
                    </>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <button 
                  onClick={() => {
                    console.group('📱 Mobile Debug Information');
                    console.log('User Agent:', navigator.userAgent);
                    console.log('Platform:', navigator.platform);
                    console.log('Screen Size:', `${window.screen.width}x${window.screen.height}`);
                    console.log('Viewport:', `${window.innerWidth}x${window.innerHeight}`);
                    console.log('Device Pixel Ratio:', window.devicePixelRatio);
                    console.log('Connection:', (navigator as any).connection);
                    console.log('Touch Points:', navigator.maxTouchPoints);
                    console.log('Languages:', navigator.languages);
                    console.log('Online:', navigator.onLine);
                    console.log('WebSocket Support:', 'WebSocket' in window);
                    console.log('WebRTC Support:', 'RTCPeerConnection' in window);
                    console.groupEnd();
                  }}
                  style={{ 
                    padding: '6px 12px', 
                    marginRight: '8px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Log Mobile Debug to Console
                </button>
                
                <button 
                  onClick={() => {
                    // Test network connectivity
                    fetch('https://www.google.com/favicon.ico', { 
                      mode: 'no-cors',
                      cache: 'no-cache'
                    })
                    .then(() => {
                      console.log('✅ Network connectivity test: PASSED');
                    })
                    .catch((error) => {
                      console.error('❌ Network connectivity test: FAILED', error);
                    });
                  }}
                  style={{ 
                    padding: '6px 12px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Test Network Connectivity
                </button>
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