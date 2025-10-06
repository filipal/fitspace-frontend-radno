import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type ComponentType, type SVGProps, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header/Header'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import { PixelStreamingView } from '../components/PixelStreamingView/PixelStreamingView'
import { useAvatarConfiguration, type BasicMeasurements, type BodyMeasurements } from '../context/AvatarConfigurationContext'
import { convertSliderValueToUnrealValue } from '../services/avatarCommandService'
import {
  convertMorphValueToBackendValue,
  getBackendKeyForMorphId,
  mapBackendMorphTargetsToRecord,
} from '../services/avatarTransformationService'
import { morphAttributes } from '../data/morphAttributes'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import {
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  LAST_LOADED_AVATAR_STORAGE_KEY,
  type AvatarPayload,
  useAvatarApi,
} from '../services/avatarApi'

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
  value: string
  icon: string // Može biti tekst ikona ili slika path
}

type MeasurementDescriptor =
  | {
    source: 'basic'
    key: keyof Pick<BasicMeasurements, 'height' | 'weight'>
    label: string
    unit?: string
    icon: string
  }
  | {
    source: 'body'
    key: keyof BodyMeasurements
    label: string
    unit?: string
    icon: string
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasDirtyMorphs, setHasDirtyMorphs] = useState(false)
  const [isSavingMorphs, setIsSavingMorphs] = useState(false)
  const lastAutoLoadedIdRef = useRef<string | null>(null)
  const hasDirtyMorphsRef = useRef(false)
  const isSavingMorphsRef = useRef(false)
  const isMountedRef = useRef(true)

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
  const { fetchAvatarById, updateAvatarMeasurements } = useAvatarApi()

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

  const getActiveAvatarId = useCallback((): string | null => {
    if (avatarIdFromState != null) {
      return String(avatarIdFromState)
    }

    if (typeof window === 'undefined') {
      return null
    }

    return sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  }, [avatarIdFromState])

  const persistMorphTargets = useCallback(async (): Promise<boolean> => {
    if (!currentAvatar) {
      console.warn('No avatar available to persist morph targets')
      return false
    }

    if (!hasDirtyMorphsRef.current) {
      return true
    }

    if (isSavingMorphsRef.current) {
      return false
    }

    const activeAvatarId = getActiveAvatarId()

    if (!activeAvatarId) {
      console.warn('Cannot persist morph targets without an avatar identifier')
      return false
    }

    try {
      if (isMountedRef.current) {
        setIsSavingMorphs(true)
        setSaveError(null)
      }
      isSavingMorphsRef.current = true

      const morphTargets = currentAvatar.morphValues.reduce<Record<string, number>>((acc, morph) => {
        const backendKey = getBackendKeyForMorphId(morph.morphId)

        if (!backendKey) {
          return acc
        }

        acc[backendKey] = convertMorphValueToBackendValue(morph.value, morph)
        return acc
      }, {})

      const payload: AvatarPayload = {
        name: currentAvatar.avatarName ?? 'Avatar',
        gender: currentAvatar.gender,
        ageRange: currentAvatar.ageRange ?? '20-29',
        creationMode: currentAvatar.creationMode ?? 'manual',
        quickMode: currentAvatar.quickMode ?? true,
        source: currentAvatar.source ?? 'web',
        ...(currentAvatar.basicMeasurements
          ? { basicMeasurements: { ...currentAvatar.basicMeasurements } }
          : {}),
        ...(currentAvatar.bodyMeasurements
          ? { bodyMeasurements: { ...currentAvatar.bodyMeasurements } }
          : {}),
        ...(currentAvatar.quickModeSettings
          ? {
              quickModeSettings: {
                ...currentAvatar.quickModeSettings,
                ...(currentAvatar.quickModeSettings?.measurements
                  ? { measurements: { ...currentAvatar.quickModeSettings.measurements } }
                  : {}),
              },
            }
          : {}),
        morphTargets,
      }

      const result = await updateAvatarMeasurements(activeAvatarId, payload)

      const backendAvatar = result.backendAvatar
      const backendMorphTargets = backendAvatar
        ? mapBackendMorphTargetsToRecord(backendAvatar.morphTargets)
        : undefined
      const persistedAvatarId =
        backendAvatar?.id ?? result.avatarId ?? String(activeAvatarId)

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, persistedAvatarId)
        sessionStorage.setItem(
          LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
          JSON.stringify({
            avatarId: persistedAvatarId,
            avatarName: backendAvatar?.name ?? payload.name,
            gender: backendAvatar?.gender ?? payload.gender,
            ageRange: backendAvatar?.ageRange ?? payload.ageRange,
            basicMeasurements:
              backendAvatar?.basicMeasurements ?? payload.basicMeasurements,
            bodyMeasurements:
              backendAvatar?.bodyMeasurements ?? payload.bodyMeasurements,
            morphTargets: backendMorphTargets ?? payload.morphTargets,
            quickMode: backendAvatar?.quickMode ?? payload.quickMode,
            creationMode: backendAvatar?.creationMode ?? payload.creationMode,
            quickModeSettings:
              backendAvatar?.quickModeSettings ?? payload.quickModeSettings ?? null,
            source: backendAvatar?.source ?? payload.source,
          }),
        )
      }

      if (isMountedRef.current) {
        try {
          const backendAvatar = result.backendAvatar ?? await fetchAvatarById(persistedAvatarId)
          const loadResult = await loadAvatar(backendAvatar)

          if (!loadResult.success) {
            throw new Error(loadResult.error ?? 'Failed to refresh avatar configuration')
          }
        } catch (refreshError) {
          console.error('Failed to refresh avatar after saving morph targets', refreshError)
          if (isMountedRef.current) {
            setSaveError(refreshError instanceof Error
              ? refreshError.message
              : 'Failed to refresh avatar after saving morph targets')
          }
          return false
        }

        setHasDirtyMorphs(false)
      }

      hasDirtyMorphsRef.current = false
      return true
    } catch (error) {
      console.error('Failed to persist morph targets', error)
      if (isMountedRef.current) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save morph changes')
      }
      return false
    } finally {
      isSavingMorphsRef.current = false
      if (isMountedRef.current) {
        setIsSavingMorphs(false)
      }
    }
  }, [currentAvatar, fetchAvatarById, getActiveAvatarId, loadAvatar, updateAvatarMeasurements])

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

  const formatMeasurementValue = useCallback((value: number, unit?: string) => {
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
      maximumFractionDigits: 1
    })

    const formatted = formatter.format(value)
    return unit ? `${formatted} ${unit}` : formatted
  }, [])

  const measurementDescriptors = useMemo<MeasurementDescriptor[]>(() => [
    { source: 'basic', key: 'height', label: 'Height', icon: lengthIcon, unit: 'cm' },
    { source: 'basic', key: 'weight', label: 'Weight', icon: girthIcon, unit: 'kg' },
    { source: 'body', key: 'shoulder', label: 'Shoulder', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'chest', label: 'Chest', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'underchest', label: 'Underchest', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'waist', label: 'Waist', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'highHip', label: 'High Hip', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'lowHip', label: 'Low Hip', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'inseam', label: 'Inseam', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'highThigh', label: 'High Thigh', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'midThigh', label: 'Mid Thigh', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'knee', label: 'Knee', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'calf', label: 'Calf', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'ankle', label: 'Ankle', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'footLength', label: 'Foot Length', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'footBreadth', label: 'Foot Breadth', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'bicep', label: 'Bicep', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'forearm', label: 'Forearm', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'wrist', label: 'Wrist', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'shoulderToWrist', label: 'Shoulder to Wrist', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'handLength', label: 'Hand Length', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'handBreadth', label: 'Hand Breadth', icon: lengthIcon, unit: 'cm' },
    { source: 'body', key: 'neck', label: 'Neck', icon: girthIcon, unit: 'cm' },
    { source: 'body', key: 'head', label: 'Head', icon: girthIcon, unit: 'cm' }
  ], [])

  const measurements = useMemo<Measurement[] | null>(() => {
    if (!currentAvatar?.basicMeasurements && !currentAvatar?.bodyMeasurements) {
      return null
    }

    return measurementDescriptors.map(descriptor => {
      const rawValue = descriptor.source === 'basic'
        ? currentAvatar?.basicMeasurements?.[descriptor.key]
        : currentAvatar?.bodyMeasurements?.[descriptor.key]

      const value = typeof rawValue === 'number'
        ? formatMeasurementValue(rawValue, descriptor.unit)
        : '—'

      return {
        name: descriptor.label,
        value,
        icon: descriptor.icon
      }
    })
  }, [currentAvatar, formatMeasurementValue, measurementDescriptors])

  const isLoadingMeasurements = !measurements
  const skeletonRowCount = measurementDescriptors.length

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
    if (!hasDirtyMorphsRef.current) {
      hasDirtyMorphsRef.current = true
      setHasDirtyMorphs(true)
    }

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

  const handleNavClick = useCallback(async (btnKey: NavKey) => {
    if (btnKey === 'Save') {
      const saved = await persistMorphTargets()

      if (saved) {
        navigate('/virtual-try-on')
      }
      return
    }

    setSelectedNav(prev => (prev === btnKey ? null : btnKey))
    }, [navigate, persistMorphTargets])

  useEffect(() => {
    if (!hasDirtyMorphs) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirtyMorphsRef.current) {
        return
      }

      void persistMorphTargets()
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasDirtyMorphs, persistMorphTargets])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (hasDirtyMorphsRef.current) {
        void persistMorphTargets()
      }
    }
  }, [persistMorphTargets])

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

      {(loaderState.error || autoLoadError || saveError) && (
        <div className={styles.avatarErrorBanner}>
          {loaderState.error ?? autoLoadError ?? saveError}
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
            <DataPanel title="Body Measurements" measurements={measurements ?? undefined}>
              {isLoadingMeasurements && (
                <div className={styles.measurementsSkeleton} aria-busy="true" aria-live="polite">
                  {Array.from({ length: skeletonRowCount }).map((_, idx) => (
                    <div key={idx} className={styles.measurementsSkeletonRow}>
                      <span className={styles.measurementsSkeletonIcon} />
                      <span className={styles.measurementsSkeletonLabel} />
                      <span className={styles.measurementsSkeletonValue} />
                    </div>
                  ))}
                </div>
              )}
            </DataPanel>
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
                onClick={() => { void handleNavClick(btn.key) }}
                type="button"
                style={navButtonVars}
                disabled={btn.key === 'Save' && isSavingMorphs}
              >
                <div className={styles.navIndicator} />
                <div className={styles.navIcon}>
                  <img src={btn.icon} alt={btn.label} />
                </div>
                <span className={styles.navLabel}>
                  {btn.key === 'Save' && isSavingMorphs ? 'Saving…' : btn.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
