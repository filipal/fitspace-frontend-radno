import { useNavigate } from 'react-router-dom'
import ResponsivePage from '../components/ResponsivePage/ResponsivePage'
import styles from './StartPage.module.scss'

export default function StartPage() {
  const navigate = useNavigate()
  return (
    <ResponsivePage contentClassName={styles.startPage}>
      <div className={styles.canvas}>
        <h1 className={styles.title}>PANDOMOTO{' '}<br />WEB</h1>
        <button className={styles.startButton} onClick={() => navigate('/login')}>
          Try On in 3D
        </button>
      </div>
    </ResponsivePage>
  )
}
