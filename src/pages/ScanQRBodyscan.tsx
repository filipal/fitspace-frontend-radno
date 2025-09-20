import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header/Header'
import styles from './ScanQRBodyscan.module.scss'
import barcodeImg from '../assets/barcode.png'

export default function ScanQRBodyscan() {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = ((location.state as { mode?: 'face' | 'body' } | undefined)?.mode) ?? 'body'
  const isFace = mode === 'face'
  const headerTitle = isFace ? 'Face Scanning' : 'Body Scanning'
  const infoText = isFace
    ? 'Scan this QR code with your phone and start face scanning'
    : 'Scan this QR code with your phone and start body scanning'

  return (
    <div className={styles.scanQRPage}>
      <Header title={headerTitle} onExit={() => navigate('/')} />
      <div className={styles.content}>
        <div className={styles.infoBox}>{infoText}</div>
        <img src={barcodeImg} alt="QR Barcode" className={styles.barcodeImg} />
        <button
          className={styles.backButton}
          onClick={() => navigate(-1)}
          type="button"
        >
          Back
        </button>
      </div>
    </div>
  )
}
