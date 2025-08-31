import { useNavigate } from 'react-router-dom'
import styles from './StartPage.module.scss'

export default function StartPage() {
  const navigate = useNavigate()
  return (
    <div className={styles.startPage}>
      <h1 className={styles.title}>PANDOMOTO<br />WEB</h1>
      <button className={styles.startButton} onClick={() => navigate('/login')}>
        Try On in 3D
      </button>
    </div>
  )
}