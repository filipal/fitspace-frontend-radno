import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type ComponentType, type SVGProps, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header/Header'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import { PixelStreamingView } from '../components/PixelStreamingView/PixelStreamingView'
import { useAvatarConfiguration } from '../context/AvatarConfigurationContext'
import { convertSliderValueToUnrealValue } from '../services/avatarCommandService'
import { morphAttributes } from '../data/morphAttributes'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import { LAST_LOADED_AVATAR_STORAGE_KEY, useAvatarApi } from '../services/avatarApi'

import avatarsButton from '../assets/avatars-button.png'
import RLeft from '../assets/r-left.svg?react'
import RRight from '../assets/r-right.svg?react'
import UploadIcon from '../assets/upload.svg?react'
import FullScreenIcon from '../assets/full-screen.svg?react'
import DownloadIcon from '../assets/download.svg?react'
import unrealFBBodyButton from '../assets/unreal-fb-body-button.png'
import avatarMeasure from '../assets/unreal-full-body.png'
import bodyIcon from '../assets/body.png'
import faceIcon from '../assets/face.png'
import skinIcon from '../assets/skin.png'
import hairIcon from '../assets/hair.png'
import extrasIcon from '../assets/extras.png'
import saveIcon from '../assets/save.png'
import lengthIcon from '../assets/length.png'
import girthIcon from '../assets/girth.png'
import DataPanel from '../components/DataPanel/DataPanel'
import BodyAccordion from '../components/BodyAccordion/BodyAccordion'
import FaceAccordion from '../components/FaceAccordion/FaceAccordion'
import SkinAccordion from '../components/SkinAccordion/SkinAccordion'
import HairAccordion from '../components/HairAccordion/HairAccordion'
import ExtrasAccordion from '../components/ExtrasAccordion/ExtrasAccordion'
import styles from './UnrealMeasurements.module.scss'

interface ControlButton {
  key: string
  width: number
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  marginRight: number
}

interface NavButton {
  key: NavKey
  icon: string
  label: string
  iconWidth: number
  iconHeight: number
}

interface Measurement {
  name: string
  value: number
  icon: string // Može biti tekst ikona ili slika path
}

interface PendingMorphUpdate {
  morphId: number
  sliderValue: number
}

type NavKey = 'Body' | 'Face' | 'Skin' | 'Hair' | 'Extras' | 'Save'

export default function UnrealMeasurements() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const accordionRef = useRef<HTMLDivElement | null>(null)
  // State used by effects below must be declared before effects
  const [selectedControl, setSelectedControl] = useState<string | null>(null)
  const [selectedNav, setSelectedNav] = useState<NavKey | null>(null)
  const [avatarSrc] = useState<string>(avatarMeasure)
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null)
  const lastAutoLoadedIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const el = pageRef.current
    if (!el) return

    const update = () => {
      const w = el.clientWidth
      el.style.setProperty('--page-w-px', `${w}px`)
    }

    update()
    const onResize = () => update()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  useLayoutEffect(() => {
    const page = pageRef.current
    const header = document.querySelector('[data-app-header]') as HTMLElement | null
    if (!page || !header) return

    const set = () => {
      // uključuje sve paddinge/bordere (i safe-area) jer je to realna visina u layoutu
      const h = Math.round(header.getBoundingClientRect().height)
      page.style.setProperty('--header-real-h', `${h}px`)
    }

    set()
    const ro = new ResizeObserver(set)
    ro.observe(header)

    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
    }
  }, [])

  useLayoutEffect(() => {
    const page = pageRef.current
    const header = document.querySelector('[data-app-header]') as HTMLElement | null
    const bottom = bottomRef.current
    if (!page || !header || !bottom) return

    const set = () => {
      const docEl = document.documentElement
      const headerH = Math.round(header.getBoundingClientRect().height)
      const w = window.innerWidth
      // Sidebar accordion tek za ≥1024: tada visina ostaje ista (samo širina)
      const verticalNav = w >= 1024
      const sideAccordion = verticalNav
      // Kada je navigacija bočno (desktop breakpoint)
      const measuredBottomH = Math.round(bottom.getBoundingClientRect().height)
      const bottomH = verticalNav ? 0 : measuredBottomH
      // Ako je accordion otvoren, oduzmi njegovu stvarnu visinu
      const accEl = accordionRef.current
      const accH = sideAccordion ? 0 : (accEl ? Math.round(accEl.getBoundingClientRect().height) : 0)
      const docHeight = docEl?.clientHeight ?? 0
      const viewportH = verticalNav
        ? window.innerHeight || docHeight || window.visualViewport?.height || 0
        : window.visualViewport?.height ?? window.innerHeight ?? docHeight
      const layoutHeight = Math.max(viewportH - headerH - bottomH - accH, 200)
      const panelScale = Math.min(1, layoutHeight / 953)
      page.style.setProperty('--bottom-real-h', `${measuredBottomH}px`)
      page.style.setProperty('--avatar-h', `${layoutHeight}px`)
      page.style.setProperty('--panel-scale', panelScale.toString())
    }

    set()
    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)
    window.visualViewport?.addEventListener('resize', set)
    window.visualViewport?.addEventListener('scroll', set)
    // Promjene visine accordeona (npr. sadržaj) – promatraj i njega
    const ro = new ResizeObserver(() => set())
    if (accordionRef.current) ro.observe(accordionRef.current)

    return () => {
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
      window.visualViewport?.removeEventListener('resize', set)
      window.visualViewport?.removeEventListener('scroll', set)
      ro.disconnect()
    }
  }, [selectedNav])

  const navigate = useNavigate()
  const location = useLocation()
  const { sendFittingRoomCommand, connectionState, application } = usePixelStreaming()
  const { updateMorphValue, currentAvatar } = useAvatarConfiguration()
  const { loadAvatar, loaderState } = useAvatarLoader()
  const { fetchAvatarById } = useAvatarApi()

  const pendingMorphUpdatesRef = useRef<PendingMorphUpdate[]>([])

  const findMorphAttribute = useCallback((morphId: number) => {
    return currentAvatar?.morphValues.find(morph => morph.morphId === morphId)
      ?? morphAttributes.find(morph => morph.morphId === morphId)
      ?? null
  }, [currentAvatar])

  const dispatchMorphUpdate = useCallback((morphId: number, sliderPercentage: number) => {
    const morphAttribute = findMorphAttribute(morphId)

    if (!morphAttribute) {
      console.warn('Unable to find morph attribute for update', { morphId })
      return
    }

    const unrealValue = convertSliderValueToUnrealValue(sliderPercentage, morphAttribute)

    sendFittingRoomCommand('updateMorph', {
      morphId: String(morphId),
      value: unrealValue
    })
  }, [findMorphAttribute, sendFittingRoomCommand])

  const locationState = location.state as { avatarId?: number | string } | null
  const avatarIdFromState = locationState?.avatarId

  useEffect(() => {
    if (currentAvatar || loaderState.isLoading) {
      return
    }

    const storedAvatarId = avatarIdFromState != null
      ? String(avatarIdFromState)
      : typeof window !== 'undefined'
        ? sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
        : null

    if (!storedAvatarId) {
      return
    }

    if (lastAutoLoadedIdRef.current === storedAvatarId) {
      return
    }

    let cancelled = false
    lastAutoLoadedIdRef.current = storedAvatarId

    const load = async () => {
      try {
        setAutoLoadError(null)
        const avatarData = await fetchAvatarById(storedAvatarId)
        const result = await loadAvatar(avatarData)

        if (!result.success) {
          throw new Error(result.error ?? 'Failed to load avatar configuration')
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, storedAvatarId)
        }
      } catch (error) {
        if (cancelled) return
        lastAutoLoadedIdRef.current = null
        const message = error instanceof Error ? error.message : 'Failed to load avatar'
        setAutoLoadError(message)
        console.error('Failed to auto-load avatar', error)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [avatarIdFromState, currentAvatar, fetchAvatarById, loadAvatar, loaderState.isLoading])

  // TODO: Consider debouncing or batching updates via generateUnrealMorphUpdateCommand for performance.
  useEffect(() => {
    if (connectionState !== 'connected') return
    if (!pendingMorphUpdatesRef.current.length) return

    const queuedUpdates = [...pendingMorphUpdatesRef.current]
    pendingMorphUpdatesRef.current = []

    queuedUpdates.forEach(({ morphId, sliderValue }) => {
      dispatchMorphUpdate(morphId, sliderValue)
    })
  }, [connectionState, dispatchMorphUpdate])

  const openSkinRight = (
    location.state as { openSkinRight?: boolean } | undefined
  )?.openSkinRight

  useEffect(() => {
    if (openSkinRight) {
      setSelectedNav('Skin')
    }
  }, [openSkinRight])

  const measurements: Measurement[] = [
    { name: 'Shoulder', value: 33.3, icon: lengthIcon },
    { name: 'Chest', value: 97.1, icon: girthIcon },
    { name: 'Underchest', value: 88.9, icon: girthIcon },
    { name: 'Waist', value: 79.1, icon: girthIcon },
    { name: 'High Hip', value: 82, icon: girthIcon },
    { name: 'Low Hip', value: 91.8, icon: girthIcon },
    { name: 'Inseam', value: 72.6, icon: lengthIcon },
    { name: 'High Thigh', value: 53.6, icon: girthIcon },
    { name: 'Mid Thigh', value: 49.5, icon: girthIcon },
    { name: 'Knee', value: 35, icon: girthIcon },
    { name: 'Calf', value: 36.1, icon: girthIcon },
    { name: 'Ankle', value: 19.9, icon: girthIcon },
    { name: 'Foot Length', value: 24.4, icon: lengthIcon },
    { name: 'Foot Breadth', value: 8.9, icon: lengthIcon },
    { name: 'Bicep', value: 32.1, icon: girthIcon },
    { name: 'Forearm', value: 26.5, icon: girthIcon },
    { name: 'Wrist', value: 15.9, icon: girthIcon },
    { name: 'Shoulder to Wrist', value: 56.7, icon: lengthIcon },
    { name: 'Hand Length', value: 18.3, icon: lengthIcon },
    { name: 'Hand Breadth', value: 8.1, icon: lengthIcon },
    { name: 'Neck', value: 37.3, icon: girthIcon },
    { name: 'Head', value: 54.5, icon: girthIcon },
    { name: 'Height', value: 170.5, icon: lengthIcon }
  ]

  const controls: ControlButton[] = [
    { key: 'rotate-left', width: 60, Icon: RLeft, marginRight: 50 },
    { key: 'upload', width: 50, Icon: UploadIcon, marginRight: 25 },
    { key: 'fullscreen', width: 40, Icon: FullScreenIcon, marginRight: 25 },
    { key: 'download', width: 50, Icon: DownloadIcon, marginRight: 50 },
    { key: 'rotate-right', width: 60, Icon: RRight, marginRight: 0 },
  ]

  const navButtons: NavButton[] = [
    { key: 'Body', icon: bodyIcon, label: 'Body', iconWidth: 16.11, iconHeight: 33.83 },
    { key: 'Face', icon: faceIcon, label: 'Face', iconWidth: 31.85, iconHeight: 31.85 },
    { key: 'Skin', icon: skinIcon, label: 'Skin', iconWidth: 30.89, iconHeight: 33.83 },
    { key: 'Hair', icon: hairIcon, label: 'Hair', iconWidth: 35.17, iconHeight: 35.17 },
    { key: 'Extras', icon: extrasIcon, label: 'Extras', iconWidth: 48.47, iconHeight: 18.96 },
    { key: 'Save', icon: saveIcon, label: 'Save', iconWidth: 35.06, iconHeight: 33.83 },
  ]

  const avatarImage = selectedNav === 'Body' ? unrealFBBodyButton : avatarSrc

  const updateMorph = (morphId: number, morphName: string, sliderPercentage: number) => {
    updateMorphValue(morphId, sliderPercentage)

    if (connectionState === 'connected') {
      dispatchMorphUpdate(morphId, sliderPercentage)
      return
    }

    const queue = pendingMorphUpdatesRef.current
    const existingIndex = queue.findIndex(update => update.morphId === morphId)
    const queuedUpdate: PendingMorphUpdate = { morphId, sliderValue: sliderPercentage }

    if (existingIndex >= 0) {
      queue[existingIndex] = queuedUpdate
    } else {
      queue.push(queuedUpdate)
    }

    console.info('Queued morph update until connection resumes', {
      morphId,
      morphName,
      sliderPercentage,
      connectionState
    })
  }

  const handleControlClick = (controlKey: string) => {
    // Update selected control state
    setSelectedControl(prev => (prev === controlKey ? null : controlKey))
    
    // Send pixel streaming commands for rotate buttons
    if (connectionState === 'connected') {
      switch (controlKey) {
        case 'rotate-left':
          sendFittingRoomCommand('rotateCamera', { direction: 'left', speed: 1 })
          console.log('Sent rotate left command')
          break
        case 'upload': // Second button - now sends zoom command
          sendFittingRoomCommand('zoomCamera', { direction: 'in', amount: 0.1 })
          console.log('Sent zoom command')
          break
        case 'fullscreen': // Middle button - pass for now
          console.log('Fullscreen button clicked - no command defined yet')
          break
        case 'download': // Fourth button - now sends moveCamera command
          sendFittingRoomCommand('moveCamera', { direction: 'up', amount: 0.1 })
          console.log('Sent move camera command')
          break
        case 'rotate-right':
          sendFittingRoomCommand('rotateCamera', { direction: 'right', speed: 1 })
          console.log('Sent rotate right command')
          break
        default:
          console.log(`Control ${controlKey} clicked - no streaming command defined`)
      }
    } else {
      console.log(`Cannot send command - connection state: ${connectionState}`)
    }
  }

  const handleNavClick = (btnKey: NavKey) => {
    if (btnKey === 'Save') {
      navigate('/virtual-try-on')
      return
    }

    setSelectedNav(prev => (prev === btnKey ? null : btnKey))
  }

  const loaderMessage = useMemo(() => {
    if (!loaderState.isLoading) {
      return null
    }

    switch (loaderState.stage) {
      case 'validation':
        return 'Validating avatar data…'
      case 'transformation':
        return 'Preparing avatar morphs…'
      case 'command_generation':
        return 'Generating avatar commands…'
      case 'unreal_communication':
        return 'Sending avatar to Unreal Engine…'
      case 'complete':
        return 'Avatar ready!'
      default:
        return 'Loading avatar…'
    }
  }, [loaderState.isLoading, loaderState.stage])

  return (
    <div ref={pageRef} className={styles.page}>
      <Header
        data-app-header
        title="Your Avatar"
        variant="dark"
        onExit={() => navigate('/')}
        rightContent={(
          <button className={styles.avatarButton} onClick={() => navigate('/logged-in')} type="button">
            <img src={avatarsButton} alt="Avatars" />
          </button>
        )}
      />

      {loaderState.isLoading && (
        <div className={styles.avatarLoaderBanner}>
          <span>{loaderMessage}</span>
          {typeof loaderState.progress === 'number' && (
            <span className={styles.avatarLoaderProgress}>
              {` ${Math.round(loaderState.progress)}%`}
            </span>
          )}
        </div>
      )}

      {(loaderState.error || autoLoadError) && (
        <div className={styles.avatarErrorBanner}>
          {loaderState.error ?? autoLoadError}
        </div>
      )}

      <div className={`${styles.centralWrapper} ${selectedNav ? styles.withAccordion : ''} ${selectedNav === 'Body' ? styles.accBody : ''} ${selectedNav === 'Face' ? styles.accFace : ''} ${selectedNav === 'Skin' ? styles.accSkin : ''} ${selectedNav === 'Hair' ? styles.accHair : ''} ${selectedNav === 'Extras' ? styles.accExtras : ''}`}>
        <div className={`${styles.avatarSection} ${selectedNav ? styles.avatarShifted : ''} ${selectedNav === 'Body' ? styles.bodySelected : ''} ${selectedNav === 'Face' ? styles.faceSelected : ''} ${selectedNav === 'Skin' ? styles.skinSelected : ''} ${selectedNav === 'Hair' ? styles.hairSelected : ''} ${selectedNav === 'Extras' ? styles.extrasSelected : ''}`}>

          {/* Conditional render: PixelStreaming when connected, fallback image otherwise */}
          {connectionState === 'connected' && application ? (
            <PixelStreamingView
              className={styles.avatarImage}
              autoConnect={false}
            />
          ) : (
            <img src={avatarImage} alt="Avatar" className={styles.avatarImage} />
          )}

          {/* Body measurements panel positioned separately */}

          {/* Body accordion renders below in centralWrapper to preserve position */}

          <div className={styles.controlGroup}>
            {controls.map(control => (
              <button
                key={control.key}
                className={`${styles.controlButton} ${styles[control.key.replace('-', '')]} ${selectedControl === control.key ? styles.selected : ''}`}
                onClick={() => handleControlClick(control.key)}
                type="button"
              >
                <div className={styles.outerCircle} />
                <control.Icon className={styles.controlIcon} />
              </button>
            ))}
          </div>
        </div>

        {selectedNav === 'Body' && (
          <div className={styles.dataPanelWrapper}>
            <DataPanel title="Body Measurements (cm)" measurements={measurements} />
          </div>
        )}
      </div>
      {selectedNav === 'Body' && (
        <div ref={accordionRef} className={styles.accordion}>
          <BodyAccordion updateMorph={updateMorph} />
        </div>
      )}

      {selectedNav === 'Face' && (
        <div ref={accordionRef} className={styles.accordion}>
          <FaceAccordion />
        </div>
      )}

      {selectedNav === 'Skin' && (
        <div ref={accordionRef} className={styles.accordion}>
          <SkinAccordion defaultRightExpanded={openSkinRight} />
        </div>
      )}

      {selectedNav === 'Hair' && (
        <div ref={accordionRef} className={styles.accordion}>
          <HairAccordion />
        </div>
      )}

      {selectedNav === 'Extras' && (
        <div ref={accordionRef} className={styles.accordion}>
          <ExtrasAccordion />
        </div>
      )}

      <div ref={bottomRef} className={styles.bottomSection}>
        <div className={styles.bottomNav}>
          {navButtons.map(btn => {
            const navButtonVars = {
              '--nav-icon-width': `${btn.iconWidth}px`,
              '--nav-icon-height': `${btn.iconHeight}px`,
            } as CSSProperties

            return (
              <button
                key={btn.key}
                className={`${styles.navButton} ${selectedNav === btn.key ? styles.active : ''}`}
                onClick={() => handleNavClick(btn.key)}
                type="button"
                style={navButtonVars}
              >
                <div className={styles.navIndicator} />
                <div className={styles.navIcon}>
                  <img src={btn.icon} alt={btn.label} />
                </div>
                <span className={styles.navLabel}>{btn.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}