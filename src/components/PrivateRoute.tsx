import { type ReactElement, type ReactNode, useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import { AuthDataContext } from '../context/AuthDataContext'
import styles from './PrivateRoute.module.scss'

interface PrivateRouteProps {
  children: ReactNode
}

export default function PrivateRoute({ children }: PrivateRouteProps): ReactElement {
  const authDataContext = useContext(AuthDataContext)
  const auth = useAuth()
  const location = useLocation()

  if (!authDataContext) {
    throw new Error('PrivateRoute must be used within an AuthDataProvider')
  }

  const hasActiveNavigator = typeof auth.activeNavigator === 'string'
  const isAuthDataLoading = authDataContext.authData === null
  const isAuthenticated = auth.isAuthenticated || authDataContext.isAuthenticated
  const isLoading = auth.isLoading || isAuthDataLoading || hasActiveNavigator

  if (isLoading) {
    return (
      <div className={styles.loadingContainer} role="status" aria-live="polite">
        <div className={styles.spinner} aria-hidden="true" />
        <span className={styles.loadingText}>Provjera prijave...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}