import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import styles from './ScanQRBodyscan.module.scss'
import barcodeImg from '../assets/barcode.png'

export default function ScanQRBodyscan() {
  const navigate = useNavigate()

  return (
    <div className={styles.scanQRPage}>
      <Header title="Body Scanning" onExit={() => navigate('/')} />
      <div className={styles.content}>
        <div className={styles.infoBox}>
          Scan this QR code with your phone and start body scanning
        </div>
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