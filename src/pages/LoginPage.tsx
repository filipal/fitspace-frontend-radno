import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/fitspace-logo-gradient-nobkg.svg'
import exitIcon from '../assets/exit.svg'
import styles from './LoginPage.module.scss'

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setError('')
    navigate('/logged-in')
  }

  return (
    <div className={styles.loginPage}>
      <button className={styles.backButton} onClick={() => navigate('/')}>
        <img src={exitIcon} alt="Exit" className={styles.exitIcon} />
      </button>

      <img src={logo} alt="Fitspace" className={styles.logo} />

      <div className={styles.webPanel}>
        <div className={styles.loginBg} />

        <button
          type="button"
          className={styles.createButton}
          onClick={() => navigate('/avatar-info')}
        >
          Create Your Digital Twin
        </button>

        <div className={styles.loginFormSection}>
          <span className={styles.introText}>
            If you already have a Fitspace avatar, log in to load it:
          </span>

          <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
            <label className={styles.inputGroup} htmlFor="email">
              <input
                id="email"
                type="email"
                className={styles.textInput}
                required
                autoComplete="email"
                placeholder="E-mail Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              />
            </label>

            <label className={styles.inputGroup} htmlFor="password">
              <input
                id="password"
                type="password"
                className={styles.textInput}
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error && password.length < 6}
              />
            </label>

            {error && <div className={styles.error} role="alert">{error}</div>}

            <button type="submit" className={styles.loginButton}>Log In</button>
          </form>
        </div>
      </div>
    </div>
  )
}