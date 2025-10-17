import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import StartPage from './pages/StartPage.tsx'
import LoginPage from './pages/LoginPage'
import LoggedInPage from './pages/LoggedInPage.tsx'
import AvatarInfoPage from './pages/AvatarInfoPage'
import AuthCallback from './pages/AuthCallback'
import UseOfData from './pages/UseOfData'
import QuickMode from './pages/QuickMode'
import BodyScanInfo from './pages/BodyScanInfo.tsx'
import BodyScan from './pages/BodyScan.tsx'
import UnrealMeasurements from './pages/UnrealMeasurements.tsx'
import VirtualTryOn from './pages/VirtualTryOn'
import ScanQRBodyscan from './pages/ScanQRBodyscan.tsx'
import BodyPhotosCheck from './pages/BodyPhotosCheck.tsx'
import LoadingScreen from './pages/LoadingScreen.tsx'
import FaceScanInfo from './pages/FaceScanInfo.tsx'
import FaceScan from './pages/FaceScan.tsx'
import FacePhotosCheck from './pages/FacePhotosCheck.tsx'
import ExitGuestUser from './pages/ExitGuestUser.tsx'
import PixelStreamingDemo from './pages/PixelStreamingDemo.tsx'
import DebugOverlay from './components/DebugOverlay/DebugOverlay.tsx'
import BeforeUnloadHandler from './components/BeforeUnloadHandler/BeforeUnloadHandler.tsx'
import PrivateRoute from './components/PrivateRoute'
import GuestAccessibleRoute from './components/GuestAccessibleRoute'
import { PixelStreamingProvider } from './context/PixelStreamingContext'
import { AuthDataProvider } from './context/AuthDataContext'
import { UserSettingsProvider } from './context/UserSettingsContext'
import { AvatarConfigurationProvider } from './context/AvatarConfigurationContext'
import { AvatarProvider } from './context/AvatarContext'
import { InstanceManagementProvider } from './context/InstanceManagementContext'
import ScrollToTop from './components/ScrollToTop'
import { PixelStreamingContainer } from './components/PixelStreamingContainer/PixelStreamingContainer'
import './App.module.scss'

export default function App() {
  const location = useLocation()

  // DEV: istakni elemente koji probijaju širinu viewporta (nema importa za import.meta.env)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const root: Element = document.querySelector('.page') ?? document.body
    const highlightOverflow = () => {
      const vw = document.documentElement.clientWidth
      ;(Array.from(root.querySelectorAll('*')) as HTMLElement[]).forEach(el => {
        el.style.outline = '' // reset
        const w = el.getBoundingClientRect().width
        if (w - vw > 1) el.style.outline = '2px dashed red'
      })
    }
    const onResize = () => requestAnimationFrame(highlightOverflow)
    window.addEventListener('resize', onResize, { passive: true })
    requestAnimationFrame(highlightOverflow)
    return () => {
      window.removeEventListener('resize', onResize)
      ;(Array.from(root.querySelectorAll('*')) as HTMLElement[]).forEach(el => (el.style.outline = ''))
    }
  }, [location.pathname])

  return (
    <UserSettingsProvider>
      <AuthDataProvider>
        <AvatarProvider>
          <AvatarConfigurationProvider>
            <InstanceManagementProvider>
              <PixelStreamingProvider>
                <ScrollToTop />
                <BeforeUnloadHandler />
                <Routes>
                  <Route path="/" element={<StartPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/avatar-info" element={<AvatarInfoPage />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/exit-guest-user" element={<ExitGuestUser />} />

                  <Route
                    path="/logged-in"
                    element={<PrivateRoute><LoggedInPage /></PrivateRoute>}
                  />
                  <Route path="/use-of-data" element={<UseOfData />} />
                  <Route path="/body-scan-info" element={<BodyScanInfo />} />
                  <Route path="/face-scan-info" element={<FaceScanInfo />} />

                  <Route path="/quickmode" element={<QuickMode />} />
                  <Route path="/body-scan" element={<PrivateRoute><BodyScan /></PrivateRoute>} />
                  <Route path="/face-scan" element={<PrivateRoute><FaceScan /></PrivateRoute>} />
                  <Route path="/unreal-measurements" element={<UnrealMeasurements />} />
                  <Route
                    path="/virtual-try-on"
                    element={<GuestAccessibleRoute><VirtualTryOn /></GuestAccessibleRoute>}
                  />
                  <Route path="/scan-qr-bodyscan" element={<PrivateRoute><ScanQRBodyscan /></PrivateRoute>} />
                  <Route path="/body-photos-check" element={<PrivateRoute><BodyPhotosCheck /></PrivateRoute>} />
                  <Route path="/face-photos-check" element={<PrivateRoute><FacePhotosCheck /></PrivateRoute>} />
                  <Route path="/loading" element={<LoadingScreen />} />
                  <Route path="/pixel-streaming-demo" element={<PrivateRoute><PixelStreamingDemo /></PrivateRoute>} />

                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>

                {/* izvan <Routes>, unutar providera */}
                <PixelStreamingContainer />

                <DebugOverlay />
              </PixelStreamingProvider>
            </InstanceManagementProvider>
          </AvatarConfigurationProvider>
        </AvatarProvider>
      </AuthDataProvider>
    </UserSettingsProvider>
  )
}