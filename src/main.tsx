import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import oidcConfig from './oidcConfig'
import './index.css'
import App from './App.tsx'

const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname)
  window.location.replace('/logged-in')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
      <BrowserRouter future={{ v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
