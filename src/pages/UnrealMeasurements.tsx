import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, type ComponentType, type SVGProps, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header/Header'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import { PixelStreamingView } from '../components/PixelStreamingView/PixelStreamingView'
import {
  useAvatarConfiguration,
  type AvatarCreationMode,
  type BasicMeasurements,
  type BodyMeasurements,
  type BackendAvatarMorphTarget,
  type QuickModeSettings,
  type AvatarClothingSelection,
  type AvatarClothingState,
} from '../context/AvatarConfigurationContext'
import { convertSliderValueToUnrealValue } from '../services/avatarCommandService'
import { applyMeasurementMorphOverrides } from '../services/morphEstimation'
import { deriveMorphTargetsFromMeasurements } from '../services/morphDerivation'
import { morphAttributes } from '../data/morphAttributes'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import {
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  LAST_LOADED_AVATAR_STORAGE_KEY,
  buildBackendMorphPayload,
  type AvatarPayload,
  useAvatarApi,
} from '../services/avatarApi'
import { useAuthData } from '../hooks/useAuthData'
import type { CreateAvatarCommand } from '../types/provisioning'
import {
  matchAvatarColorShade,
  normalizeAvatarColorHex,
  resolveAvatarColorById,
  resolveAvatarColorShade,
} from '../constants/avatarColors'

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
import VirtualTryOnPanel, { type VirtualTryOnHeaderState } from '../components/VirtualTryOnPanel/VirtualTryOnPanel'
import virtualTryOnStyles from '../components/VirtualTryOnPanel/VirtualTryOnPanel.module.scss'
import styles from './UnrealMeasurements.module.scss'

import { estimateMissingMeasurements } from '../services/anthroEstimator'
import { getAvatarDisplayName } from '../utils/avatarName'
import cartIcon from '../assets/cart.svg'

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

const MEASUREMENT_DESCRIPTORS: MeasurementDescriptor[] = [
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
  { source: 'body', key: 'head', label: 'Head', icon: girthIcon, unit: 'cm' },
];
const PANEL_REFERENCE_HEIGHT = 953;
const PANEL_SCALE_BOOST = 1.08;

export default function UnrealMeasurements() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const accordionRef = useRef<HTMLDivElement | null>(null)

  // State used by effects below must be declared before effects
  const [selectedControl, setSelectedControl] = useState<string | null>(null)
  const [selectedNav, setSelectedNav] = useState<NavKey | null>(null)
  const [avatarSrc] = useState<string>(avatarMeasure)
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null)
  const [hasDirtyMorphs, setHasDirtyMorphs] = useState(false)

  const { isAuthenticated } = useAuthData()
  const lastAutoLoadedIdRef = useRef<string | null>(null)
  const hasDirtyMorphsRef = useRef(false)
  const isMountedRef = useRef(true)
  const lastViewportStateRef = useRef({ height: 0 })
  const initialViewAppliedRef = useRef(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState<'measurements' | 'virtualTryOn'>(() => {
    const locationState = location.state as { initialView?: 'virtualTryOn' } | null
    return locationState?.initialView === 'virtualTryOn' ? 'virtualTryOn' : 'measurements'
  })
  const [virtualHeaderState, setVirtualHeaderState] = useState<VirtualTryOnHeaderState>({
    title: 'Virtual Try-on',
    showCartButton: false,
  })

  useEffect(() => {
    if (initialViewAppliedRef.current) return
    const locationState = location.state as { initialView?: 'virtualTryOn' } | null
    if (locationState?.initialView === 'virtualTryOn') {
      initialViewAppliedRef.current = true
      setActiveView('virtualTryOn')
    }
  }, [location.state])

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

  const computeFocusedAvatarZoom = useCallback((height: number) => {
    if (!Number.isFinite(height) || height <= 0) return 2.1
    const baseline = 670
    const rawZoom = (baseline / Math.min(Math.max(height, 420), 900)) * 2.1
    const clamped = Math.min(2.6, Math.max(1.9, rawZoom))
    return Number.isFinite(clamped) ? clamped : 2.1
  }, [])

  useLayoutEffect(() => {
    if (activeView !== 'measurements') return

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
      const panelScale = Math.min(1, (layoutHeight / PANEL_REFERENCE_HEIGHT) * PANEL_SCALE_BOOST)
      page.style.setProperty('--bottom-real-h', `${measuredBottomH}px`)
      page.style.setProperty('--avatar-h', `${layoutHeight}px`)
      const lastState = lastViewportStateRef.current
      // Skaliraj panel samo kada se promijeni efektivna visina viewporta
      const heightChanged = Math.abs(lastState.height - viewportH) > 0.5
      if (heightChanged) {
        page.style.setProperty('--panel-scale', panelScale.toString())
      }
      lastViewportStateRef.current = { height: viewportH }

      const focusedZoom = computeFocusedAvatarZoom(layoutHeight)
      page.style.setProperty('--avatar-zoom-face', focusedZoom.toFixed(3))
      page.style.setProperty('--avatar-zoom-hair', focusedZoom.toFixed(3))
      page.style.setProperty('--avatar-zoom-extras', focusedZoom.toFixed(3))
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
  }, [selectedNav, computeFocusedAvatarZoom, activeView])

  const { sendFitSpaceCommand, connectionState, application, devMode, setActiveStreamMode, disconnect } = usePixelStreaming()

  useEffect(() => {
    setActiveStreamMode(activeView === 'virtualTryOn' ? 'fittingRoom' : 'measurement')
  }, [activeView, setActiveStreamMode])

  useEffect(() => {
    return () => {
      setActiveStreamMode(null)
    }
  }, [setActiveStreamMode])

  const {
    updateMorphValue,
    currentAvatar,
    savePendingChanges,
    isSavingPendingChanges,
    savePendingChangesError,
    dirtySections,
  } = useAvatarConfiguration()

  const accordionAvatar = useMemo(() => {
    if (!currentAvatar) return null;
    const measurementSources = {
      basicMeasurements: currentAvatar.basicMeasurements ?? null,
      bodyMeasurements: currentAvatar.bodyMeasurements ?? null,
      quickModeSettings: currentAvatar.quickModeSettings ?? null,
    } as const

    const derivedMorphs = deriveMorphTargetsFromMeasurements(
      currentAvatar.morphValues ?? [],
      measurementSources,
      { gender: currentAvatar.gender },
    )

    const morphValues = applyMeasurementMorphOverrides(
      derivedMorphs,
      measurementSources,
    )
    return {
      avatarId: String(currentAvatar.avatarId),
      avatarName: getAvatarDisplayName(currentAvatar),
      gender:
        currentAvatar.gender === 'female'
          ? 'female'
          : currentAvatar.gender === 'male'
          ? 'male'
          : undefined,
      ageRange: currentAvatar.ageRange,
      morphValues,
      basicMeasurements: currentAvatar.basicMeasurements
        ? { ...currentAvatar.basicMeasurements }
        : null,
      bodyMeasurements: currentAvatar.bodyMeasurements
        ? { ...currentAvatar.bodyMeasurements }
        : null,
    };
  }, [currentAvatar]);

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
    sendFitSpaceCommand('updateMorph', {
      morphId: String(morphId),
      value: unrealValue
    })
  }, [findMorphAttribute, sendFitSpaceCommand])

  const locationState = location.state as {
    avatarId?: number | string
    openSkinRight?: boolean
    initialView?: 'virtualTryOn'
  } | null
  const avatarIdFromState = locationState?.avatarId
  const openSkinRight = locationState?.openSkinRight

  const getActiveAvatarId = useCallback((): string | null => {
    if (avatarIdFromState != null) return String(avatarIdFromState)
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  }, [avatarIdFromState])

  const computedFallbacks = useMemo<Record<string, number>>(() => {
    if (!currentAvatar) return {}

    const sex = currentAvatar.gender === 'female' ? 'female' : 'male'
    const athletic =
      (currentAvatar.quickModeSettings?.athleticLevel as 'low' | 'medium' | 'high') ?? 'medium'

    const basicMeasurements = currentAvatar.basicMeasurements ?? {}
    const bodyMeasurements = currentAvatar.bodyMeasurements ?? {}
    const quickModeMeasurements = currentAvatar.quickModeSettings?.measurements ?? {}

    // Pomoćna funkcija: parsiraj broj ili vrati undefined
    const toNum = (v: unknown): number | undefined => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
      if (typeof v === 'string') {
        const n = Number(v.replace(',', '.'))
        return Number.isFinite(n) ? n : undefined
      }
      return undefined
    }

    const chest = toNum(
      bodyMeasurements.chest ??
      quickModeMeasurements.chest ??
      quickModeMeasurements['bustCircumference']
    )
    const waist = toNum(
      bodyMeasurements.waist ??
      quickModeMeasurements.waist ??
      quickModeMeasurements['waistCircumference']
    )
    const lowHip = toNum(
      bodyMeasurements.lowHip ??
      quickModeMeasurements.lowHip ??
      quickModeMeasurements['lowHipCircumference']
    )

    const known = {
      height: toNum(basicMeasurements.height),
      weight: toNum(basicMeasurements.weight),
      chest,
      waist,
      lowHip,
      underchest: toNum(bodyMeasurements.underchest ?? quickModeMeasurements.underchest),
    }

    const estimated = estimateMissingMeasurements(sex, known, athletic)
    const normalized = Object.entries(estimated ?? {}).reduce<Record<string, number>>((acc, [key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = value
      }
      return acc
    }, {})
    return normalized
  }, [currentAvatar])

  const persistMorphTargets = useCallback(async (): Promise<boolean> => {
    if (!hasDirtyMorphsRef.current && dirtySections.size === 0) {
      return true
    }

    const activeAvatarId = getActiveAvatarId()
    const result = await savePendingChanges({
      activeAvatarId,
      computedFallbacks,
    })

    if (result.success) {
      hasDirtyMorphsRef.current = false
      if (isMountedRef.current) {
        setHasDirtyMorphs(false)
      }
      return true
    }

    if (result.error) {
      console.warn('Failed to persist morph targets', result.error)
    }

    return false
  }, [computedFallbacks, dirtySections, getActiveAvatarId, savePendingChanges])

  // Auto-load avatar if none loaded
  const { isLoading: isAvatarLoading } = loaderState
  useEffect(() => {
    if (currentAvatar || isAvatarLoading) return

    const storedAvatarId = avatarIdFromState != null
      ? String(avatarIdFromState)
      : typeof window !== 'undefined'
        ? sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
        : null

    if (!storedAvatarId) return
    if (lastAutoLoadedIdRef.current === storedAvatarId) return

    let cancelled = false
    lastAutoLoadedIdRef.current = storedAvatarId

    const load = async () => {
      try {
        setAutoLoadError(null)
        const avatarData = await fetchAvatarById(storedAvatarId)
        const result = await loadAvatar(avatarData)
        if (!result.success) throw new Error(result.error ?? 'Failed to load avatar configuration')
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
    return () => { cancelled = true }
  }, [avatarIdFromState, currentAvatar, fetchAvatarById, loadAvatar, isAvatarLoading])

  useEffect(() => {
    const hasDirtySections = dirtySections.size > 0
    if (hasDirtyMorphsRef.current !== hasDirtySections) {
      hasDirtyMorphsRef.current = hasDirtySections
    }
    setHasDirtyMorphs(hasDirtySections)
  }, [dirtySections])

  useEffect(() => {
    if (isAuthenticated) return
    if (currentAvatar) return
    if (typeof window === 'undefined') return

    let cancelled = false

    const readStoredMetadata = () => {
      try {
        const raw = window.sessionStorage.getItem(LAST_CREATED_AVATAR_METADATA_STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as Record<string, unknown>
      } catch (error) {
        console.warn('Failed to parse guest avatar metadata', error)
        return null
      }
    }

    const readPendingCommand = () => {
      try {
        const raw = window.localStorage.getItem('pendingAvatarData')
        if (!raw) return null
        const parsed = JSON.parse(raw) as CreateAvatarCommand
        if (parsed?.type === 'createAvatar' && parsed.data) return parsed
      } catch (error) {
        console.warn('Failed to parse pending guest avatar command', error)
      }
      return null
    }

    const toMorphArray = (source: unknown): BackendAvatarMorphTarget[] => {
      if (!source) return []
      if (Array.isArray(source)) {
        return source
          .map(entry => {
            if (!entry || typeof entry !== 'object') return null
            const record = entry as Record<string, unknown>
            const name = typeof record.name === 'string'
              ? record.name
              : typeof record.backendKey === 'string'
                ? record.backendKey
                : typeof record.id === 'string'
                  ? record.id
                  : null
            const valueCandidate =
              typeof record.value === 'number'
                ? record.value
                : typeof record.sliderValue === 'number'
                  ? record.sliderValue
                  : typeof record.unrealValue === 'number'
                    ? record.unrealValue
                    : typeof record.defaultValue === 'number'
                      ? record.defaultValue
                      : Number(record.value)
            const value = typeof valueCandidate === 'number' && Number.isFinite(valueCandidate)
              ? valueCandidate
              : Number.isFinite(Number(valueCandidate))
                ? Number(valueCandidate)
                : null
            if (!name || value == null) return null
            return { name, value }
          })
          .filter((entry): entry is BackendAvatarMorphTarget => Boolean(entry))
      }

      if (typeof source === 'object' && source) {
        return Object.entries(source as Record<string, unknown>).reduce<BackendAvatarMorphTarget[]>(
          (acc, [name, rawValue]) => {
            if (!name) return acc
            const value = Number(rawValue)
            if (Number.isFinite(value)) acc.push({ name, value })
            return acc
          },
          [],
        )
      }

      return []
    }

    const normalizeBasicMeasurements = (
      source: unknown,
    ): Partial<BasicMeasurements> | undefined => {
      if (!source || typeof source !== 'object') return undefined
      const normalized = Object.entries(source as Record<string, unknown>).reduce<
        Partial<BasicMeasurements>
      >((acc, [key, value]) => {
        if (!key) return acc
        if (value === null) {
          acc[key] = null
          return acc
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          acc[key] = value
          return acc
        }
        if (typeof value === 'string') {
          const numeric = Number(value)
          if (Number.isFinite(numeric)) {
            acc[key] = numeric
            return acc
          }
          acc[key] = value as AvatarCreationMode
        }
        return acc
      }, {})

      return Object.keys(normalized).length ? normalized : undefined
    }

    const normalizeBodyMeasurements = (
      source: unknown,
    ): Partial<BodyMeasurements> | undefined => {
      if (!source || typeof source !== 'object') return undefined
      const normalized = Object.entries(source as Record<string, unknown>).reduce<
        Partial<BodyMeasurements>
      >((acc, [key, value]) => {
        if (!key) return acc
        if (typeof value === 'number' && Number.isFinite(value)) {
          acc[key as keyof BodyMeasurements] = value
          return acc
        }
        if (typeof value === 'string') {
          const numeric = Number(value)
          if (Number.isFinite(numeric)) {
            acc[key as keyof BodyMeasurements] = numeric
          }
        }
        return acc
      }, {})

      return Object.keys(normalized).length ? normalized : undefined
    }

    const toFiniteNumber = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value)
      }

      if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
          return Math.trunc(parsed)
        }
      }

      return null
    }

    const normalizeClothingSelection = (
      source: unknown,
    ): AvatarClothingSelection | null => {
      if (!source || typeof source !== 'object') return null
      const record = source as Record<string, unknown>
      const itemId = Number(record.itemId)
      if (!Number.isFinite(itemId)) return null

      const rawSubCategory = record.subCategory
      const subCategory =
        typeof rawSubCategory === 'string' && rawSubCategory.trim().length
          ? rawSubCategory.trim()
          : null

      let paletteIndex = toFiniteNumber(record.colorPaletteIndex)
      let shadeIndex = toFiniteNumber(record.colorShadeIndex)
      let colorId = toFiniteNumber(record.colorId)
      let colorHex = normalizeAvatarColorHex(record.colorHex)

      if (!colorHex && paletteIndex != null && shadeIndex != null) {
        const resolved = resolveAvatarColorShade(paletteIndex, shadeIndex)
        colorHex = resolved.colorHex
        paletteIndex = resolved.paletteIndex
        shadeIndex = resolved.shadeIndex
        colorId = colorId ?? resolved.colorId
      }

      if (!colorHex && colorId != null) {
        const resolved = resolveAvatarColorById(colorId)
        if (resolved) {
          colorHex = resolved.colorHex
          paletteIndex = resolved.paletteIndex
          shadeIndex = resolved.shadeIndex
          colorId = resolved.colorId
        }
      }

      if (colorHex) {
        const matched = matchAvatarColorShade(colorHex)
        if (matched) {
          if (paletteIndex == null) paletteIndex = matched.paletteIndex
          if (shadeIndex == null) shadeIndex = matched.shadeIndex
          if (colorId == null) colorId = matched.colorId
          colorHex = matched.colorHex
        }
      }

      return {
        itemId,
        ...(subCategory ? { subCategory } : {}),
        ...(colorHex ? { colorHex } : {}),
        ...(paletteIndex != null ? { colorPaletteIndex: paletteIndex } : {}),
        ...(shadeIndex != null ? { colorShadeIndex: shadeIndex } : {}),
        ...(colorId != null ? { colorId } : {}),
      }
    }

    const normalizeClothingSelections = (
      source: unknown,
    ): AvatarClothingState | undefined => {
      if (!source || typeof source !== 'object') return undefined
      const record = source as Record<string, unknown>
      let hasSelection = false
      const normalized: AvatarClothingState = {}

      ;(['top', 'bottom'] as const).forEach(category => {
        const selection = normalizeClothingSelection(record[category])
        if (selection) {
          normalized[category] = selection
          hasSelection = true
        }
      })

      return hasSelection ? normalized : undefined
    }

    const loadGuestAvatar = async () => {
      const metadata = readStoredMetadata()
      const command = readPendingCommand()

      const fallbackName =
        (metadata?.avatarName as string | undefined) ??
        (metadata?.name as string | undefined) ??
        command?.data.avatarName ??
        'Guest Avatar'

      const gender =
        (metadata?.gender as 'male' | 'female' | undefined) ??
        command?.data.gender ??
        'female'

      const ageRange =
        (metadata?.ageRange as string | undefined) ??
        command?.data.ageRange ??
        '20-29'

     const basicMeasurements = normalizeBasicMeasurements(
        command?.data.basicMeasurements ?? metadata?.basicMeasurements,
      )
      const bodyMeasurements = normalizeBodyMeasurements(
        command?.data.bodyMeasurements ?? metadata?.bodyMeasurements,
      )

      const morphTargetsSource =
        command?.data.morphTargets ?? metadata?.morphTargets ?? null
      let morphTargets = toMorphArray(morphTargetsSource)

      if (!morphTargets.length) {
        const pseudoPayload: AvatarPayload = {
          name: fallbackName,
          gender,
          ageRange,
          quickMode: true,
          creationMode: 'quickMode',
          ...(basicMeasurements ? { basicMeasurements } : {}),
          ...(bodyMeasurements ? { bodyMeasurements } : {}),
          ...(command?.data.quickModeSettings
            ? { quickModeSettings: command.data.quickModeSettings }
            : {}),
        }
        const morphs = buildBackendMorphPayload(pseudoPayload)
        if (Array.isArray(morphs)) {
          morphTargets = morphs
            .map(morph => {
              if (!morph) return null
              const key = morph.backendKey ?? morph.id
              if (!key) return null
              const value = Number(morph.sliderValue)
              return Number.isFinite(value) ? { name: key, value } : null
            })
            .filter((entry): entry is BackendAvatarMorphTarget => Boolean(entry))
        }
      }

      const quickModeSettings =
        (command?.data.quickModeSettings ?? metadata?.quickModeSettings ?? null) as
          | QuickModeSettings
          | null

      const clothingSelections =
        normalizeClothingSelections(command?.data.clothingSelections) ??
        normalizeClothingSelections(metadata?.clothingSelections)

      const guestAvatar = {
        type: 'createAvatar' as const,
        id: (metadata?.avatarId as string | null | undefined) ?? 'guest',
        name: fallbackName,
        gender,
        ageRange,
        quickMode: true,
        creationMode:
          (metadata?.creationMode as AvatarCreationMode | null | undefined) ?? 'quickMode',
        source: 'guest' as const,
        createdAt: null,
        updatedAt: null,
        createdBySession: null,
        basicMeasurements: basicMeasurements as BasicMeasurements | undefined,
        bodyMeasurements: bodyMeasurements as BodyMeasurements | undefined,
        morphTargets,
        quickModeSettings,
        clothingSelections: clothingSelections ?? null,
      }

      try {
        const loadResult = await loadAvatar(guestAvatar)
        if (!loadResult.success) {
          throw new Error(loadResult.error ?? 'Failed to load guest avatar')
        }
        if (!cancelled) {
          try {
            window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, String(guestAvatar.id))
          } catch (storageError) {
            console.warn('Failed to persist loaded guest avatar id', storageError)
          }
        }
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Failed to load guest avatar'
        setAutoLoadError(message)
        console.error('Failed to load guest avatar', error)
      }
    }

    void loadGuestAvatar()

    return () => {
      cancelled = true
    }
  }, [currentAvatar, isAuthenticated, loadAvatar])

  // Flush queued morph updates when connected
  useEffect(() => {
    if (connectionState !== 'connected') return
    if (!pendingMorphUpdatesRef.current.length) return
    const queued = [...pendingMorphUpdatesRef.current]
    pendingMorphUpdatesRef.current = []
    queued.forEach(({ morphId, sliderValue }) => {
      dispatchMorphUpdate(morphId, sliderValue)
    })
  }, [connectionState, dispatchMorphUpdate])

  useEffect(() => {
    if (openSkinRight) setSelectedNav('Skin')
  }, [openSkinRight])

  const formatNumber = useCallback((value: number) => {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(value)
  }, [])

  const measurements = useMemo<Measurement[] | null>(() => {
    if (!currentAvatar) return null

    const basicMeasurements = currentAvatar.basicMeasurements ?? {}
    const bodyMeasurements = currentAvatar.bodyMeasurements ?? {}
    const quickModeMeasurements = currentAvatar.quickModeSettings?.measurements ?? {}

    const resolveNumericValue = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    }

    const normalizeMeasurementKey = (key: unknown): string | null => {
      if (typeof key !== 'string') return null
      const normalized = key
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .replace(/[^a-z0-9]/giu, '')
        .toLowerCase()
      return normalized || null
    }

    const findMeasurementValue = (
      source: unknown,
      descriptorKey: string,
    ): number | null => {
      if (!source || typeof source !== 'object') return null
      const record = source as Record<string, unknown>
      const directValue = resolveNumericValue(record[descriptorKey])
      if (directValue != null) return directValue

      const normalizedTargetKey = normalizeMeasurementKey(descriptorKey)
      if (!normalizedTargetKey) return null

      for (const [candidateKey, candidateValue] of Object.entries(record)) {
        if (normalizeMeasurementKey(candidateKey) === normalizedTargetKey) {
          const numericValue = resolveNumericValue(candidateValue)
          if (numericValue != null) return numericValue
        }
      }
      return null
    }

    return MEASUREMENT_DESCRIPTORS.map(descriptor => {
      // 1) Primarni iz basic/body
      const descriptorKey = String(descriptor.key)
      const primaryValue = descriptor.source === 'basic'
        ? findMeasurementValue(basicMeasurements, descriptorKey)
        : findMeasurementValue(bodyMeasurements, descriptorKey)

      // 2) Fallback iz quickMode settings
      const fallbackValue = findMeasurementValue(
        quickModeMeasurements,
        descriptorKey,
      )

      // 3) Heuristički fallback iz estimator-a
      const computed = computedFallbacks[descriptorKey]
      const numericValue = primaryValue ?? fallbackValue ?? (computed ?? null)
      const value = numericValue != null ? formatNumber(numericValue) : '—'

      return {
        name: descriptor.label,
        value,
        icon: descriptor.icon
      }
    })
  }, [currentAvatar, formatNumber, computedFallbacks])

  const isLoadingMeasurements = measurements == null && loaderState.isLoading
  const skeletonRowCount = MEASUREMENT_DESCRIPTORS.length

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

  // Your real updateMorph: receives slider %, updates state + UE value, queues if offline
  const updateMorph = useCallback(
    (morphId: number, morphName: string, sliderPercentage: number) => {
      updateMorphValue(morphId, sliderPercentage)

      if (!hasDirtyMorphsRef.current) {
        hasDirtyMorphsRef.current = true
        setHasDirtyMorphs(true)
      }

      if (connectionState === 'connected') {
        dispatchMorphUpdate(morphId, sliderPercentage)
        console.log('🧬 Sent live morph update', { morphId, morphName, sliderPercentage })
        return
      }

      const queue = pendingMorphUpdatesRef.current
      const existingIndex = queue.findIndex(update => update.morphId === morphId)
      const queuedUpdate: PendingMorphUpdate = { morphId, sliderValue: sliderPercentage }

      if (existingIndex >= 0) queue[existingIndex] = queuedUpdate
      else queue.push(queuedUpdate)

      console.info('⏸️ Queued morph update until connection resumes', {
        morphId,
        morphName,
        sliderPercentage,
        connectionState
      })
    },
    [
      connectionState,
      dispatchMorphUpdate,
      pendingMorphUpdatesRef,
      setHasDirtyMorphs,
      updateMorphValue,
    ],
  )

  const handleControlClick = (controlKey: string) => {
    // Update selected control state
    setSelectedControl(prev => (prev === controlKey ? null : controlKey))    
    // Send pixel streaming commands for rotate buttons
    if (connectionState === 'connected') {
      switch (controlKey) {
        case 'rotate-left':
          sendFitSpaceCommand('rotateCamera', { direction: 'left', speed: 1 })
          console.log('Sent rotate left command')
          break
        case 'upload': // Second button - now sends zoom command
          sendFitSpaceCommand('zoomCamera', { direction: 'in', amount: 0.1 })
          console.log('Sent zoom command')
          break
        case 'fullscreen': // Middle button - pass for now
          console.log('Fullscreen button clicked - no command defined yet')
          break
        case 'download': // Fourth button - now sends moveCamera command
          sendFitSpaceCommand('moveCamera', { direction: 'up', amount: 0.1 })
          console.log('Sent move camera command')
          break
        case 'rotate-right':
          sendFitSpaceCommand('rotateCamera', { direction: 'right', speed: 1 })
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
      console.log('💾 Save pressed → persisting morphs...')
      const saved = await persistMorphTargets()
      if (saved) {
        console.log('✅ Morphs persisted → switching to virtual try-on view')
        setSelectedNav(null)
        setActiveView('virtualTryOn')
      } else {
        console.warn('⚠️ Persist failed; staying on page.')
      }
      return
    }
    setSelectedNav(prev => (prev === btnKey ? null : btnKey))
  }, [persistMorphTargets])

  useEffect(() => {
    if (!hasDirtyMorphs) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirtyMorphsRef.current) return
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
      if (hasDirtyMorphsRef.current) void persistMorphTargets()
    }
  }, [persistMorphTargets])

  const loaderMessage = useMemo(() => {
    if (!loaderState.isLoading) return null
    switch (loaderState.stage) {
      case 'validation': return 'Validating avatar data…'
      case 'transformation': return 'Preparing avatar morphs…'
      case 'command_generation': return 'Generating avatar commands…'
      case 'unreal_communication': return 'Sending avatar to Unreal Engine…'
      case 'complete': return 'Avatar ready!'
      default: return 'Loading avatar…'
    }
  }, [loaderState.isLoading, loaderState.stage])

  const headerTitle = activeView === 'virtualTryOn' ? virtualHeaderState.title : 'Your Avatar'
  const headerRightContent = activeView === 'virtualTryOn'
    ? (
        <div className={virtualTryOnStyles.headerButtonGroup}>
          {virtualHeaderState.showCartButton ? (
            <button className={virtualTryOnStyles.cartButton} type="button">
              <img src={cartIcon} alt="Cart" />
            </button>
          ) : null}
          <button
            className={virtualTryOnStyles.avatarButton}
            onClick={() => {
              setActiveView('measurements')
              setSelectedNav(null)
            }}
            type="button"
          >
            <img src={avatarsButton} alt="Avatars" />
          </button>
        </div>
      )
    : (
        <button 
          className={styles.avatarButton} 
          onClick={() => {
            // Disconnect when leaving measurements view via avatar button
            if (activeView === 'measurements') {
              console.log('🔌 Navigating to avatar list - disconnecting from pixel streaming');
              disconnect();
            }
            navigate('/logged-in');
          }} 
          type="button"
        >
          <img src={avatarsButton} alt="Avatars" />
        </button>
      )

  const handleExit = useCallback(() => {
    if (activeView === 'virtualTryOn') {
      setActiveView('measurements')
      setSelectedNav(null)
      return
    }

    // Disconnect from pixel streaming when leaving measurements view
    console.log('🔌 Exiting measurements page - disconnecting from pixel streaming');
    disconnect();

    if (isAuthenticated) {
      navigate('/')
    } else {
      navigate('/exit-guest-user')
    }
  }, [activeView, isAuthenticated, navigate, disconnect])

  return (
    <div ref={pageRef} className={styles.page}>
      <Header
        data-app-header
        title={headerTitle}
        variant="dark"
        onExit={handleExit}
        rightContent={headerRightContent}
      />
      {devMode === 'localhost' && (
        <div className={styles.devBadge} title="Pixel Streaming Localhost">
          <span className={styles.devDot} />
          DEV · localhost
        </div>
      )}
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

      {(loaderState.error || autoLoadError || savePendingChangesError) && (
        <div className={styles.avatarErrorBanner}>
          {loaderState.error ?? autoLoadError ?? savePendingChangesError}
        </div>
      )}

      {activeView === 'measurements' ? (
        <>
          <div className={`${styles.centralWrapper} ${selectedNav ? styles.withAccordion : ''} ${selectedNav === 'Body' ? styles.accBody : ''} ${selectedNav === 'Face' ? styles.accFace : ''} ${selectedNav === 'Skin' ? styles.accSkin : ''} ${selectedNav === 'Hair' ? styles.accHair : ''} ${selectedNav === 'Extras' ? styles.accExtras : ''}`}>
            <div className={`${styles.avatarSection} ${selectedNav ? styles.avatarShifted : ''} ${selectedNav === 'Body' ? styles.bodySelected : ''} ${selectedNav === 'Face' ? styles.faceSelected : ''} ${selectedNav === 'Skin' ? styles.skinSelected : ''} ${selectedNav === 'Hair' ? styles.hairSelected : ''} ${selectedNav === 'Extras' ? styles.extrasSelected : ''}`}>

              {/* PixelStreaming when connected OR in localhost mode; fallback image otherwise */}
              {((connectionState === 'connected' && application) || devMode === 'localhost') ? (
                <PixelStreamingView
                  className={styles.avatarImage}
                  autoConnect={devMode === 'localhost'}
                />
              ) : (
                <img src={avatarImage} alt="Avatar" className={styles.avatarImage} />
              )}

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
                <DataPanel title="Body Measurements (cm)" measurements={measurements ?? undefined}>
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
              <BodyAccordion
                key={currentAvatar?.avatarId ?? 'no-avatar'}
                avatar={accordionAvatar}
                updateMorph={updateMorph}
              />
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
                    disabled={btn.key === 'Save' && isSavingPendingChanges}
                  >
                    <div className={styles.navIndicator} />
                    <div className={styles.navIcon}>
                      <img src={btn.icon} alt={btn.label} />
                    </div>
                    <span className={styles.navLabel}>
                      {btn.key === 'Save' && isSavingPendingChanges ? 'Saving…' : btn.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.virtualWrapper}>
          <VirtualTryOnPanel
            embedded
            onRequestExit={() => {
              setActiveView('measurements')
              setSelectedNav(null)
            }}
            onRequestAvatarList={() => {
              setActiveView('measurements')
              setSelectedNav(null)
            }}
            onHeaderStateChange={setVirtualHeaderState}
          />
        </div>
      )}
    </div>
  )
}