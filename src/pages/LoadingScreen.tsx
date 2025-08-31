import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LoadingScreen.module.scss'

export default function LoadingScreen() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          // Navigate to UnrealMeasurements with no accordion pre-selected
          setTimeout(() => {
            navigate('/unreal-measurements')
          }, 500)
          return 100
        }
        return prev + 2 // povećaj za 2% svake 100ms (ukupno 5 sekundi)
      })
    }, 100)

    return () => clearInterval(interval)
  }, [navigate])

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
