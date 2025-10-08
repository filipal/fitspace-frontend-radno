import { useNavigate } from 'react-router-dom'
import useIsMobile from '../../hooks/useIsMobile'
import faceIcon from '../../assets/face.png'
import styles from './FaceAccordion.module.scss'

export default function FaceAccordion() {
  const navigate = useNavigate()
  const isMobile = useIsMobile(1024)
  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <p>
          To make your Avatar<br/>even more personalised,<br/>create a 3D model of<br/>your face in minutes
        </p>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.scanButton}
          onClick={() => {
            if (isMobile) {
              navigate('/face-scan-info')
            } else {
              navigate('/scan-qr-bodyscan', { state: { mode: 'face' } })
            }
          }}
        >
          <img src={faceIcon} alt="" />
          Scan Your Face
        </button>
      </div>
    </div>
  )
}