import styles from './AuthCallback.module.scss'

export default function AuthCallback() {
  return (
    <div className={styles.callbackContainer} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>Signing you in...</p>
    </div>
  )
}