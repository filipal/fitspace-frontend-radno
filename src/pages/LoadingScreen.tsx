import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './LoadingScreen.module.scss'

export default function LoadingScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const openSkinRight = Boolean((location.state as { openSkinRight?: boolean } | undefined)?.openSkinRight)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          // Navigate to UnrealMeasurements with no accordion pre-selected
          setTimeout(() => {
            if (openSkinRight) {
              navigate('/unreal-measurements', { state: { openSkinRight: true } })
            } else {
              navigate('/unreal-measurements')
            }
          }, 500)
          return 100
        }
        return prev + 2 // povećaj za 2% svake 100ms (ukupno 5 sekundi)
      })
    }, 100)

    return () => clearInterval(interval)
  }, [navigate, openSkinRight])

  const handleExit = () => {
    navigate('/')
  }

  return (
    <div className={styles.loadingScreenPage}>
      {/* Exit button */}
      <button className={styles.exitButton} onClick={handleExit} type="button">
        ✕
      </button>

      {/* Loading content */}
      <div className={styles.loadingContent}>
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.loadingText}>
            Generating your Digital Twin...
          </div>
        </div>
      </div>
    </div>
  )
}
