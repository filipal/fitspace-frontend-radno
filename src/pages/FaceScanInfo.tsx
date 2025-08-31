import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import styles from './FaceScanInfo.module.scss'

export default function FaceScanInfo() {
  const navigate = useNavigate()
  const tips = [
    'Make sure to be in a well-lit environment and avoid harsh light from one side',
    'Keep a relaxed face with a closed mouth and eyes open',
    'Turn on phone sound to hear the voice guide',
    'Take off glasses, hats, masks, or hair covering your face',
    'Hold your phone straight, at eye level, and center your face inside the guided area',
  ]

  return (
    <div className={styles.faceScanInfoPage}>
      <Header
        title="Face Scanning Tips"
        variant="dark"
        onExit={() => navigate('/')}
      />
      <div className={styles.faceScanContent}>
        <div className={styles.tipsList}>
          {tips.map((tip, idx) => (
            <div className={styles.tipBox} key={idx}>
              {tip}
            </div>
          ))}
        </div>
      </div>        
      <Footer
        backText="Back"
        actionText="Start Scanning"
        onBack={() => navigate('/avatar-info')}
        onAction={() => navigate('/face-scan')}
        actionType="primary"
      />
    </div>
  )
}