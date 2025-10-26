// src/components/PixelStreamingContainer/PixelStreamingContainer.tsx
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { PixelStreamingView } from '../PixelStreamingView/PixelStreamingView'

/**
 * Persistent PS "manager":
 * - drži konekciju (connect/keepalive)
 * - prebacuje modove (measurement/fittingRoom) prema ruti
 * - opcionalno može i CRTATI globalni <PixelStreamingView/> ako se traži (renderView=true)
 *
 * Zadano: renderView=false → ne crta ništa, samo upravlja konekcijom.
 */
export const PixelStreamingContainer: React.FC<{ renderView?: boolean }> = ({
  renderView = false,
}) => {
  const location = useLocation()
  const {
    sendCommand,
    connectionState,
    connect,
    getEffectiveSettings,
    devMode,
    setDebugMode,
    setDebugSettings,
    activeStreamMode,
    isIntentionalDisconnect,
    clearIntentionalDisconnect,
  } = usePixelStreaming()

  // stabilna slika postavki u ovom renderu
  const effective = getEffectiveSettings();
  const ss = effective.ss ?? '';

  // stabilna referenca na connect da ga ne moramo stavljati u deps
  const connectRef = useRef(connect);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // rute koje koriste streaming
  const streamPages = ['/unreal-measurements', '/virtual-try-on'] as const
  const isStreamPage = Boolean(activeStreamMode) || streamPages.includes(location.pathname as (typeof streamPages)[number])

  // trenutni "mode" u UE
  const currentMode = activeStreamMode
    ?? (location.pathname === '/unreal-measurements'
      ? 'measurement'
      : location.pathname === '/virtual-try-on'
        ? 'fittingRoom'
        : null)

  // zapamti prethodni mode da šaljemo switchMode samo kad se stvarno promijeni
  const prevModeRef = useRef<string | null>(null)
  const wasOnStreamPageRef = useRef<boolean>(false)

  // DEV helper: localhost → forsiraj debug postavke
  useEffect(() => {
    if (isStreamPage && devMode === 'localhost') {
      console.log('🏠 PS Container: localhost dev mode → ws://localhost:80')
      setDebugMode(true)
      setDebugSettings({ ss: 'ws://localhost:80' })
    }
  }, [isStreamPage, devMode, setDebugMode, setDebugSettings])

  // Clear intentional disconnect flag ONLY when navigating TO a streaming page
  // (not when already on one and disconnecting)
  useEffect(() => {
    const wasOnStreamPage = wasOnStreamPageRef.current;
    const nowOnStreamPage = isStreamPage;
    
    // Update the ref for next render
    wasOnStreamPageRef.current = nowOnStreamPage;
    
    // Only clear if we're transitioning FROM non-stream TO stream page
    if (!wasOnStreamPage && nowOnStreamPage && isIntentionalDisconnect) {
      console.log('🔓 PS Container: Navigated to streaming page, clearing intentional disconnect flag');
      clearIntentionalDisconnect();
    }
  }, [isStreamPage, isIntentionalDisconnect, clearIntentionalDisconnect]);

  // Auto-connect čim uđemo na stranicu koja koristi stream (ako smo disconnected)
  useEffect(() => {
    // Samo na PS stranicama
    if (!isStreamPage) return;

    // Bez URL-a nema povezivanja (sprječava spam logova)
    if (!ss) return;

    // Ako smo već connected/connecting, ne pokušavaj opet
    if (connectionState === 'connected' || connectionState === 'connecting') return;

    // Ne pokušavaj reconnect ako je korisnik namjerno diskonektovao
    if (isIntentionalDisconnect) {
      console.log('� PS Container: skipping auto-connect due to intentional disconnect');
      return;
    }

    console.log('�🔌 PS Container: initiating connect…', ss);
    // Po želji možeš proslijediti ss kao override, ali nije nužno
    // connectRef.current(ss);
    connectRef.current();
  }, [isStreamPage, ss, connectionState, isIntentionalDisconnect]);

  // Prebacivanje modova bez reconnecta
  useEffect(() => {
    if (!currentMode || connectionState !== 'connected') return
    const prevMode = prevModeRef.current

    if (!prevMode || prevMode !== currentMode) {
      console.log(`🔄 switchMode: ${prevMode ?? '(initial)'} → ${currentMode}`)
      sendCommand('switchMode', { mode: currentMode })
      prevModeRef.current = currentMode
    }
  }, [currentMode, connectionState, sendCommand])

  // (opcionalno) renderaj globalni view — samo ako je traženo i ako smo na jednoj od PS stranica
  if (!(renderView && isStreamPage)) {
    // Nema DOM-a → nema crnog kvadrata; ali efekti iznad i dalje rade dok je komponenta montirana
    return null
  }

  // Minimalni styling ako netko želi globalni prikaz iz kontejnera
  const streamHeight =
    currentMode === 'fittingRoom' ? '780px' : 'calc(100vh - 101px)'

  const zIndexValue = currentMode === 'fittingRoom' ? -1 : 1

  return (
    <div
      style={{
        position: 'fixed',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        height: streamHeight,
        zIndex: zIndexValue,
        // Ako želiš omogućiti klikanje po videu, promijeni na 'auto'.
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <PixelStreamingView />
    </div>
  )
}