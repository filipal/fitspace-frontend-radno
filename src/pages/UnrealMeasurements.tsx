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
} from '../services/avatarTransformationService'
import { morphAttributes } from '../data/morphAttributes'
import { useAvatarLoader } from '../hooks/useAvatarLoader'
import {
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  LAST_LOADED_AVATAR_STORAGE_KEY,
  buildBackendMorphPayload,
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

import { estimateMissingMeasurements } from '../services/anthroEstimator'

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
  const { sendFittingRoomCommand, connectionState, application, devMode } = usePixelStreaming()

  const { updateMorphValue, currentAvatar } = useAvatarConfiguration()

  const accordionAvatar = useMemo(() => {
    if (!currentAvatar) return null;
    return {
      avatarId: String(currentAvatar.avatarId),
      avatarName: currentAvatar.avatarName ?? (currentAvatar as any)?.name,
      gender:
        currentAvatar.gender === 'female'
          ? 'female'
          : currentAvatar.gender === 'male'
          ? 'male'
          : undefined,
      ageRange: currentAvatar.ageRange,
      morphValues: currentAvatar.morphValues ?? [],
    };
  }, [currentAvatar]);

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

  const locationState = location.state as { avatarId?: number | string; openSkinRight?: boolean } | null
  const avatarIdFromState = locationState?.avatarId
  const openSkinRight = locationState?.openSkinRight

  const getActiveAvatarId = useCallback((): string | null => {
    if (avatarIdFromState != null) return String(avatarIdFromState)
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  }, [avatarIdFromState])

  const computedFallbacks = useMemo(() => {
    if (!currentAvatar) return {} as Record<string, number>

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
      (bodyMeasurements as any).chest ?? (quickModeMeasurements as any).chest ?? (quickModeMeasurements as any).bustCircumference
    )
    const waist = toNum(
      (bodyMeasurements as any).waist ?? (quickModeMeasurements as any).waist ?? (quickModeMeasurements as any).waistCircumference
    )
    const lowHip = toNum(
      (bodyMeasurements as any).lowHip ?? (quickModeMeasurements as any).lowHip ?? (quickModeMeasurements as any).lowHipCircumference
    )

    const known = {
      height: toNum((basicMeasurements as any).height),
      weight: toNum((basicMeasurements as any).weight),
      chest,
      waist,
      lowHip,
      underchest: toNum((bodyMeasurements as any).underchest ?? (quickModeMeasurements as any).underchest),
    }

    const estimated = estimateMissingMeasurements(sex, known, athletic)
    // Vratimo kao običan record da ga lako “indeksiramo” po descriptor.key
    return estimated as Record<string, number>
  }, [currentAvatar])

  const persistMorphTargets = useCallback(async (): Promise<boolean> => {
    if (!currentAvatar) {
      console.warn('No avatar available to persist morph targets')
      return false
    }
    if (!hasDirtyMorphsRef.current) return true
    if (isSavingMorphsRef.current) return false

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
        if (!backendKey) return acc
        acc[backendKey] = convertMorphValueToBackendValue(morph.value, morph)
        return acc
      }, {})

      const mergedBody: Record<string, number> = { ...(currentAvatar.bodyMeasurements ?? {}) }

      // popuni samo one koje fale
      for (const d of MEASUREMENT_DESCRIPTORS) {
        if (d.source !== 'body') continue
        const key = d.key as string
        const already = mergedBody[key]
        const est = (computedFallbacks as Record<string, number | undefined>)[key]
        if ((already == null || !Number.isFinite(Number(already))) && est != null) {
          mergedBody[key] = est
        }
      }

      // Ukloni creationMode iz basicMeasurements da ne kolidira s top-level creationMode
      const basicNoMode =
        currentAvatar.basicMeasurements
          ? (() => {
              const { creationMode: _ignore, ...rest } = currentAvatar.basicMeasurements
              return rest
            })()
          : undefined

      const basePayload: AvatarPayload = {
        name: currentAvatar.avatarName ?? 'Avatar',
        gender: currentAvatar.gender,
        ageRange: currentAvatar.ageRange ?? '20-29',
        creationMode: currentAvatar.creationMode ?? 'manual',
        quickMode: currentAvatar.quickMode ?? true,
        source: currentAvatar.source ?? 'web',
        // koristimo basicNoMode (bez creationMode) i NE dodajemo ponovno original
        ...(basicNoMode ? { basicMeasurements: basicNoMode } : {}),
        // OVDJE koristimo mergedBody (koji već sadrži postojeće + procijenjene vrijednosti)
        ...(Object.keys(mergedBody).length ? { bodyMeasurements: mergedBody } : {}),
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

      const morphs = buildBackendMorphPayload({ ...basePayload })
      const payload: AvatarPayload = { ...basePayload, ...(morphs ? { morphs } : {}) }
      if (morphs) delete (payload as { morphTargets?: Record<string, number> }).morphTargets

      const result = await updateAvatarMeasurements(activeAvatarId, payload)

      const backendAvatar = result.backendAvatar
      const persistedAvatarId = backendAvatar?.id ?? result.avatarId ?? String(activeAvatarId)

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, persistedAvatarId)

        const storageMorphTargets =
          backendAvatar?.morphTargets ??
          (Array.isArray(morphs)
            ? morphs
                .map((morph): { name: string; value: number } | null => {
                  if (!morph) return null
                  const key = morph.backendKey ?? morph.id
                  const value = Number(morph.sliderValue)
                  if (!key || !Number.isFinite(value)) return null
                  return { name: key, value }
                })
                .filter((entry): entry is { name: string; value: number } => Boolean(entry))
            : undefined) ??
          (basePayload.morphTargets
            ? Object.entries(basePayload.morphTargets).reduce<{ name: string; value: number }[]>(
                (acc, [key, value]) => {
                  if (!key) return acc
                  const numericValue = Number(value)
                  if (Number.isFinite(numericValue)) {
                    acc.push({ name: key, value: numericValue })
                  }
                  return acc
                },
                []
              )
            : undefined)

        sessionStorage.setItem(
          LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
          JSON.stringify({
            avatarId: persistedAvatarId,
            name: backendAvatar?.name ?? payload.name,
            avatarName: backendAvatar?.name ?? payload.name,
            gender: backendAvatar?.gender ?? payload.gender,
            ageRange: backendAvatar?.ageRange ?? payload.ageRange,
            basicMeasurements: backendAvatar?.basicMeasurements ?? payload.basicMeasurements,
            bodyMeasurements: backendAvatar?.bodyMeasurements ?? payload.bodyMeasurements,
            morphTargets: storageMorphTargets ?? null,
            quickMode: backendAvatar?.quickMode ?? payload.quickMode,
            creationMode: backendAvatar?.creationMode ?? payload.creationMode,
            quickModeSettings: backendAvatar?.quickModeSettings ?? payload.quickModeSettings ?? null,
            source: backendAvatar?.source ?? payload.source,
          })
        )
      }

      if (isMountedRef.current) {
        try {
          const backendAvatarFresh = result.backendAvatar ?? (await fetchAvatarById(persistedAvatarId))
          const loadResult = await loadAvatar(backendAvatarFresh)
          if (!loadResult.success) throw new Error(loadResult.error ?? 'Failed to refresh avatar configuration')
        } catch (refreshError) {
          console.error('Failed to refresh avatar after saving morph targets', refreshError)
          if (isMountedRef.current) {
            setSaveError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh avatar after saving morph targets')
          }
          return false
        }
        setHasDirtyMorphs(false)
      }

      hasDirtyMorphsRef.current = false
      return true
    } catch (error) {
      console.error('Failed to persist morph targets', error)
      if (isMountedRef.current) setSaveError(error instanceof Error ? error.message : 'Failed to save morph changes')
      return false
    } finally {
      isSavingMorphsRef.current = false
      if (isMountedRef.current) setIsSavingMorphs(false)
    }
  }, [currentAvatar, fetchAvatarById, getActiveAvatarId, loadAvatar, updateAvatarMeasurements, computedFallbacks])

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
      source: Record<string, unknown> | undefined,
      descriptorKey: string,
    ): number | null => {
      if (!source) return null
      const directValue = resolveNumericValue((source as any)[descriptorKey])
      if (directValue != null) return directValue

      const normalizedTargetKey = normalizeMeasurementKey(descriptorKey)
      if (!normalizedTargetKey) return null

      for (const [candidateKey, candidateValue] of Object.entries(source)) {
        if (normalizeMeasurementKey(candidateKey) === normalizedTargetKey) {
          const numericValue = resolveNumericValue(candidateValue)
          if (numericValue != null) return numericValue
        }
      }
      return null
    }

    return MEASUREMENT_DESCRIPTORS.map(descriptor => {
      // 1) Primarni iz basic/body
      const primaryValue = descriptor.source === 'basic'
        ? findMeasurementValue(basicMeasurements as Record<string, unknown>, descriptor.key)
        : findMeasurementValue(bodyMeasurements as Record<string, unknown>, descriptor.key)

      // 2) Fallback iz quickMode settings
      const fallbackValue = findMeasurementValue(
        quickModeMeasurements as Record<string, unknown> | undefined,
        descriptor.key,
      )

      // 3) Heuristički fallback iz estimator-a
      const computed = (computedFallbacks as Record<string, number | undefined>)[descriptor.key]
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
  const updateMorph = (morphId: number, morphName: string, sliderPercentage: number) => {
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
      console.log('💾 Save pressed → persisting morphs...')
      const saved = await persistMorphTargets()
      if (saved) {
        console.log('✅ Morphs persisted → navigating to /virtual-try-on')
        navigate('/virtual-try-on')
      } else {
        console.warn('⚠️ Persist failed; staying on page.')
      }
      return
    }
    setSelectedNav(prev => (prev === btnKey ? null : btnKey))
  }, [navigate, persistMorphTargets])

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

      {(loaderState.error || autoLoadError || saveError) && (
        <div className={styles.avatarErrorBanner}>
          {loaderState.error ?? autoLoadError ?? saveError}
        </div>
      )}

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
