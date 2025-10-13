import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useIsMobile from '../hooks/useIsMobile';
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'
import VoiceInfoOn from '../assets/voice-info-on.svg'
import VoiceInfoOff from '../assets/voice-info-off.svg'
import scanInstructions from '../assets/scan-instructions.mp3'
import FaceGuide from '../assets/face-guide.png'
import frontImg from '../assets/front-face-scan.png'
import sideImg from '../assets/side-face-scan.png'
import styles from './FaceScan.module.scss'

type ScanPhase = 'initial' | 'scanning' | 'countdown' | 'completed'

export default function FaceScan({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialOrientation =
    searchParams.get('orientation') === 'side' ? 'side' : 'front'
  const [orientation, setOrientation] = useState<'front' | 'side'>(
    initialOrientation
  )
  const [singleScan] = useState(searchParams.get('single') === 'true')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [scanPhase, setScanPhase] = useState<ScanPhase>('initial')
  const [countdown, setCountdown] = useState(5)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedFront, setCapturedFront] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const playPromiseRef = useRef<Promise<void> | null>(null)
  const initialSoundEnabled = useRef(soundEnabled)

  const isMobile = useIsMobile(1024);
  useEffect(() => {
    if (!isMobile) {
      navigate('/scan-qr-bodyscan', { replace: true, state: { mode: 'face' } });
    }
  }, [isMobile, navigate]);

  if (!isMobile) return null; // spriječi flicker

  // Resetira naslijeđeni scroll + isključi auto-restoration
  useEffect(() => {
    const browserHistory = window.history;
    const prev = browserHistory.scrollRestoration ?? 'auto';
    if ('scrollRestoration' in browserHistory) {
      browserHistory.scrollRestoration = 'manual';
    }

    // hard reset na vrh (bez animacije)
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // (opcionalno, za svaki slučaj) Zaključaj scroll dok je FaceScan aktivan
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehaviorY || '';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'none';

    return () => {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = prev ?? 'auto';
      }
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overscrollBehaviorY = prevBodyOverscroll;
    };
  }, []);

  // Pokreni audio prilikom mounta komponente samo jednom. Ovaj efekt ne
  // ovisi o promjenama `soundEnabled`, nego koristi početnu vrijednost
  // spremljenu u referenci kako bi izbjegao zastarjele vrijednosti.
  useEffect(() => {
    const audioEl = audioRef.current
    if (audioEl && initialSoundEnabled.current) {
      audioEl.currentTime = 0
      const playPromise = audioEl.play()
      playPromiseRef.current = playPromise
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          // Audio playback was prevented or interrupted
          if (err.name !== 'AbortError') {
            console.error('Initial audio playback failed:', err)
          }
        })
      }
    }
    return () => {
      const audio = audioEl
      if (audio) {
        // Bezbjedno zaustavi audio tek kad se završi play promise
        if (playPromiseRef.current) {
          playPromiseRef.current.then(() => {
            audio.pause()
          }).catch(() => {
            audio.pause()
          })
        } else {
          audio.pause()
        }
      }
    }
  }, [])

  // Pauziraj/pokreni audio kad se promijeni soundEnabled
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      if (soundEnabled) {
        // Čekaj da se završi prethodni play promise prije pokretanja novog
        if (playPromiseRef.current) {
          playPromiseRef.current.then(() => {
            if (audio && soundEnabled) {
              const playPromise = audio.play()
              playPromiseRef.current = playPromise
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  if (err.name !== 'AbortError') {
                    console.error('Audio playback failed:', err)
                  }
                })
              }
            }
          }).catch(() => {
            // Ignore errors from previous promise
          })
        } else {
          const playPromise = audio.play()
          playPromiseRef.current = playPromise
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              if (err.name !== 'AbortError') {
                console.error('Audio playback failed:', err)
              }
            })
          }
        }
      } else {
        // Bezbjedno pauziraj tek kad se završi trenutni play promise
        if (playPromiseRef.current) {
          playPromiseRef.current.then(() => {
            if (audio) {
              audio.pause()
            }
          }).catch(() => {
            // Play failed, audio is already stopped
            if (audio) {
              audio.pause()
            }
          })
        } else {
          audio.pause()
        }
      }
    }
  }, [soundEnabled])

  // Countdown logika (neovisna o zvuku)
  useEffect(() => {
    let timer: number
    if (scanPhase === 'countdown' && countdown > 0) {
      timer = window.setTimeout(() => setCountdown(countdown - 1), 1000)
    } else if (scanPhase === 'countdown' && countdown === 0) {
      timer = window.setTimeout(() => setScanPhase('completed'), 1000)
    }
    return () => clearTimeout(timer)
  }, [scanPhase, countdown])

  const startScan = async () => {
    setCameraError(null)
    // Stop any existing tracks before starting a new scan
    const oldTracks = streamRef.current?.getTracks()
    oldTracks?.forEach(track => track.stop())
    setScanPhase('scanning')
    try {
      // Preflight: traži siguran kontekst (HTTPS ili localhost)
      const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      if (!window.isSecureContext && !isLocalhost) {
        throw Object.assign(new Error('InsecureContext'), { name: 'SecurityError' })
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const frontCamera = devices.find(
        d => d.kind === 'videoinput' && d.label.toLowerCase().includes('front')
      )

      const videoConstraints: MediaTrackConstraints = frontCamera
        ? { deviceId: { exact: frontCamera.deviceId } }
        : { facingMode: 'user' }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCountdown(5)
      setScanPhase('countdown')
    } catch (err) {
      console.error('Error starting video stream:', err)
      const e = err as DOMException & { message?: string }
      let msg = 'Unable to access camera. Please check permissions and try again.'
      switch (e?.name) {
        case 'NotAllowedError':
          msg = 'Camera access was blocked. In Safari settings allow camera for this site, then reload.'
          break
        case 'NotFoundError':
          msg = 'No camera device found. Check camera availability and try again.'
          break
        case 'NotReadableError':
          msg = 'Camera is in use by another app. Close other apps and retry.'
          break
        case 'OverconstrainedError':
          msg = 'Requested camera is unavailable. Remove device constraints and retry.'
          break
        case 'SecurityError':
          msg = 'Camera requires a secure context. Open the app via HTTPS (e.g. CloudFront) or localhost.'
          break
      }
      setCameraError(msg)
      setScanPhase('initial')
    }
  }

  useEffect(() => {
    return () => {
      const tracks = streamRef.current?.getTracks()
      tracks?.forEach(track => track.stop())
    }
  }, [])

  const placeholderImage = orientation === 'front' ? frontImg : sideImg
  const title = orientation === 'front' ? 'Front Face Scan' : 'Side Face Scan'

  const actionText =
    scanPhase === 'initial'
      ? 'SCAN'
      : orientation === 'front'
        ? singleScan
          ? 'Continue'
          : 'Continue to the Side Scan'
        : 'Continue'

  const handleFooterAction = () => {
    if (scanPhase === 'initial') {
      startScan()
    } else if (scanPhase === 'completed') {
      const tracks = streamRef.current?.getTracks()
      tracks?.forEach(track => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
      const placeholder = orientation === 'front' ? frontImg : sideImg
      if (singleScan) {
        if (orientation === 'front') {
          setCapturedFront(placeholder)
          navigate('/face-photos-check', { state: { frontImage: placeholder } })
        } else {
          navigate('/face-photos-check', { state: { sideImage: placeholder } })
        }
      } else if (orientation === 'front') {
        setCapturedFront(placeholder)
        setOrientation('side')
        setScanPhase('initial')
        setCountdown(5)
      } else {
        navigate('/face-photos-check', {
          state: {
            frontImage: capturedFront ?? frontImg,
            sideImage: placeholder,
          },
        })
      }
    }
  }

  return (
    <div className={styles.faceScanPage}>
      {/* Placeholder samo u 'initial' */}
      {scanPhase === 'initial' && (
        <img
          src={placeholderImage}
          alt={orientation === 'front' ? 'Front face placeholder' : 'Side face placeholder'}
          className={styles.scanImage}
        />
      )}

      {/* Video je prisutan, ali skriven u 'initial' */}
      <video
        ref={videoRef}
        className={`${styles.video} ${scanPhase === 'initial' ? styles.videoHidden : ''}`}
        autoPlay
        playsInline
        muted
      />

      {/* Guide je stalno iznad (i iznad placeholdera) */}
      <div className={styles.overlay}>
        <img src={FaceGuide} alt="Face guide" className={styles.guideImage} />
      </div>


      <Header
        className={styles.scanHeader}
        variant="light"
        title={title}
        onExit={onClose || (() => navigate(-1))}
        rightContent={
          <button className={styles.voiceButton} onClick={() => setSoundEnabled(v => !v)} type="button">
            <img src={soundEnabled ? VoiceInfoOn : VoiceInfoOff} alt="Voice Info" />
          </button>
        }
      />

      {/* Main scan area */}
      <div className={styles.scanArea}>
        {scanPhase === 'countdown' && countdown > 0 && (
          <div className={styles.countdownNumber}>{countdown}</div>
        )}
        {scanPhase === 'completed' && (
          <div className={styles.scanDoneMsg}>
            <span>{orientation === 'front' ? 'Front Scan Done!' : 'Side Scan Done!'}</span>
          </div>
        )}
        {cameraError && (
          <div className={styles.cameraError}>
            <p>{cameraError}</p>
            <button type="button" onClick={startScan}>Retry</button>
          </div>
        )}
      </div>

      {/* Voice instructions (audio only, neovisno o countdownu) */}
      <audio ref={audioRef} src={scanInstructions} />

      {/* Prikaži Footer samo kad nije scanning ili countdown */}
      {(scanPhase === 'initial' || scanPhase === 'completed') && (
        <Footer
          className={styles.scanFooter}
          actionText={actionText}
          onAction={handleFooterAction}
          actionDisabled={false}
        />
      )}
    </div>
  )
}
