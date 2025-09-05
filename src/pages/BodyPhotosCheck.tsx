import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from '../components/Header/Header'
import frontImg from '../assets/front.png'
import sideImg from '../assets/side.png'
import styles from './BodyPhotosCheck.module.scss'

export default function BodyPhotosCheck() {
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
    <div className={styles.bodyPhotosCheckPage}>
      <div className={styles.canvas}>
        <Header
          variant="dark"
          title="Body Photos Check"
          onExit={() => navigate('/')}
        />

        <div className={styles.content}>
          <div className={styles.prompt}>Are you satisfied with your photos?</div>
          <div className={styles.photos}>
            <img src={frontPhoto} alt="Front" />
            <img src={sidePhoto} alt="Side" />
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.row1}>
            <button
              type="button"
              className={styles.smallWhiteButton}
              onClick={() => navigate('/body-scan?orientation=front&single=true')}
            >
              Retake Front
            </button>
            <button
              type="button"
              className={styles.smallWhiteButton}
              onClick={() => navigate('/body-scan?orientation=side&single=true')}
            >
              Retake Side
            </button>
          </div>
          <div className={styles.row2}>
            <button
              type="button"
              className={styles.largeWhiteButton}
              onClick={() => navigate('/body-scan')}
            >
              Retake Both Photos
            </button>
          </div>
          <div className={styles.row3}>
            <button
              type="button"
              className={styles.blackButton}
              onClick={() => navigate('/loading')}
            >
              Generate Your Avatar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
