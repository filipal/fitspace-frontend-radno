import { useEffect } from 'react'
import { useDebug } from '../../hooks/useDebug'
import { usePixelStreamingSettings } from '../../hooks/usePixelStreamingSettings'
import { PixelStreamingWrapper } from '../PixelStreamingDebugWrapper/PixelStreamingDebugWrapper'
import packageJson from '../../../package.json'
import styles from './DebugOverlay.module.scss'

export default function DebugOverlay() {
  const { isDebug, toggleDebug } = useDebug()
  const { settings, updateSettings } = usePixelStreamingSettings()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug mode
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        toggleDebug()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleDebug])

  if (!isDebug) return null

  return (
    <div className={styles.debugOverlay}>
      <div className={styles.debugHeader}>
        <div className={styles.debugTitle}>
          <h3>Debug Mode v{packageJson.version}</h3>
        </div>
        <div className={styles.debugControls}>
          <span className={styles.shortcutHint}>Ctrl+Shift+D to toggle</span>
          <button 
            className={styles.closeButton}
            onClick={toggleDebug}
            type="button"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className={styles.debugContent}>
        <div className={styles.debugSection}>
          <h4>Pixel Streaming Debug</h4>
          <div style={{ 
            height: 'calc(100dvh - 120px)', 
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
