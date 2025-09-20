import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from '../components/Header/Header'
import frontImg from '../assets/front-face-scan.png'
import sideImg from '../assets/side-face-scan.png'
import styles from './FacePhotosCheck.module.scss'

export default function FacePhotosCheck() {
  const navigate = useNavigate()
  const location = useLocation()
  const [frontPhoto, setFrontPhoto] = useState(frontImg)
  const [sidePhoto, setSidePhoto] = useState(sideImg)

  useEffect(() => {
    const state = location.state as {
      frontImage?: string
      sideImage?: string
    }
    if (state?.frontImage) setFrontPhoto(state.frontImage)
    if (state?.sideImage) setSidePhoto(state.sideImage)
  }, [location.state])

  return (
    <div className={styles.facePhotosCheckPage}>
      <Header
        variant="dark"
        title="Face Photos Check"
        onExit={() => navigate('/')}
      />

      <div className={styles.content}>
        <div className={styles.prompt}>Are you satisfied with your photos?</div>
        <div className={styles.photos}>
          <div className={styles.photoBlock}>
            <img src={frontPhoto} alt="Front" />
            <button
              type="button"
              className={styles.smallWhiteButton}
              onClick={() => navigate('/face-scan?orientation=front&single=true')}
            >
              Retake Front
            </button>
          </div>
          <div className={styles.photoBlock}>
            <img src={sidePhoto} alt="Side" />
            <button
              type="button"
              className={styles.smallWhiteButton}
              onClick={() => navigate('/face-scan?orientation=side&single=true')}
            >
              Retake Side
            </button>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.largeWhiteButton}
          onClick={() => navigate('/face-scan')}
        >
          Retake Both Photos
        </button>
        <button
          type="button"
          className={styles.blackButton}
          onClick={() => navigate('/loading', { state: { openSkinRight: true } })}
        >
          Generate 3D Model
        </button>
      </div>
    </div>
  )
}
