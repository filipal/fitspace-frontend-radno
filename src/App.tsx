import { Routes, Route, Navigate } from 'react-router-dom'
import StartPage from './pages/StartPage.tsx'
import LoginPage from './pages/LoginPage'
import LoggedInPage from './pages/LoggedInPage.tsx'
import AvatarInfoPage from './pages/AvatarInfoPage'
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
import DebugOverlay from './components/DebugOverlay/DebugOverlay.tsx'
import { PixelStreamingProvider } from './context/PixelStreamingContext'
import './App.module.scss'


export default function App() {
  return (
    <PixelStreamingProvider>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/avatar-info" element={<AvatarInfoPage />} />
        <Route path="/logged-in" element={<LoggedInPage />} />
        <Route path="/use-of-data" element={<UseOfData />} />
        <Route path="/body-scan-info" element={<BodyScanInfo />} />
        <Route path="/face-scan-info" element={<FaceScanInfo />} />
        <Route path="/quickmode" element={<QuickMode />} />
        <Route path="/body-scan" element={<BodyScan />} />
        <Route path="/face-scan" element={<FaceScan />} />
        <Route path="/unreal-measurements" element={<UnrealMeasurements />} />
        <Route path="/virtual-try-on" element={<VirtualTryOn />} />
        <Route path="/scan-qr-bodyscan" element={<ScanQRBodyscan />} />
        <Route path="/body-photos-check" element={<BodyPhotosCheck />} />
        <Route path="/face-photos-check" element={<FacePhotosCheck />} />
        <Route path="/loading" element={<LoadingScreen />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      
      <DebugOverlay />
    </PixelStreamingProvider>
  )
}