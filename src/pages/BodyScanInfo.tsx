
import { useNavigate } from 'react-router-dom'
import BodyScanIllustration from '../assets/body-scan-illustration.png'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import styles from './BodyScanInfo.module.scss'


export default function BodyScanInfo() {
  const navigate = useNavigate()
  const tips = [
    'Wear tight clothing\nto show body lines',
    'Stay in a well-lit room',
    'Turn on phone sound to hear the\nvoice guide',
    'Place the phone upright at hip\nheight, e.g. on a table against an\nobject',
    'Step away from the phone\nwithin 2-3 metres',
  ]
  // Na manjim visinama (npr. iPhone 15/15 Pro ~844–852) smanji boxove ~10–12%
  const isTall = typeof window !== 'undefined' && window.innerHeight >= 900
  const tipHeights = isTall ? [75, 51, 75, 97, 75] : [66, 45, 66, 86, 66]

  return (
    <div className={styles.bodyScanInfoPage}>
      <div className={styles.canvas}>
        {/* Header */}
        <Header
          title="Body Scanning Tips"
          variant="dark"
          onExit={() => navigate('/')} />

        <div className={styles.bodyScanContent}>
          <div className={styles.tipsList}>
            {tips.map((tip, idx) => (
              <div
                className={styles.tipBox}
                key={idx}
                style={{ height: tipHeights[idx], whiteSpace: 'pre-line' }}
              >
                {tip}
              </div>
            ))}
          </div>
          <div className={styles.scanIllustration}>
            <img src={BodyScanIllustration} alt="Body Scan Illustration" />
          </div>
          <Footer
            backText="Back"
            actionText="Start Scanning"
            onBack={() => navigate('/avatar-info')}
            onAction={() => navigate('/body-scan')}
            actionType="primary"
          />
        </div>
      </div>
    </div>
  )
}
