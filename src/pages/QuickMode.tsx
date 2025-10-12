import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import Footer from '../components/Footer/Footer'

import BodyShape1 from '../assets/bodyshape-1.svg?react'
import BodyShape2 from '../assets/bodyshape-2.svg?react'
import BodyShape3 from '../assets/bodyshape-3.svg?react'
import BodyShape4 from '../assets/bodyshape-4.svg?react'
import BodyShape5 from '../assets/bodyshape-5.svg?react'
import athleticTrack from '../assets/athletic-slide.svg'
import athleticCircle from '../assets/athletic-circle.svg'
import athleticThin from '../assets/athletic-thin.svg'
import athleticNormal from '../assets/athletic-normal.svg'
import athleticMuscular from '../assets/athletic-muscular.svg'
import styles from './QuickMode.module.scss'

import {
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
  LAST_LOADED_AVATAR_STORAGE_KEY,
  buildBackendMorphPayload,
  useAvatarApi,
  type AvatarPayload,
  type AvatarMorphPayload,
  type QuickModeSettingsPayload,
} from '../services/avatarApi'

import { useAvatars } from '../context/AvatarContext'
import {
  useAvatarConfiguration,
  type BasicMeasurements,
  type AvatarCreationMode,
  type BackendAvatarMorphTarget,
  type QuickModeSettings,
} from '../context/AvatarConfigurationContext'

import { mapBackendMorphTargetsToRecord } from '../services/avatarTransformationService'
import { deriveMissingMeasurements } from '../utils/deriveMeasurements'
import {
  buildMeasurementMorphTargetMap,
  computeBaselineMeasurementsFromBasics,
  normalizeMeasurementRecord,
} from '../utils/morphMeasurementSync'

import type { CreateAvatarCommand } from '../types/provisioning'

const USE_LOADING_ROUTE = import.meta.env.VITE_USE_LOADING_ROUTE === 'true'

const bodyShapes = [
  { id: 1, Icon: BodyShape1, label: 'Shape 1', width: 33, height: 55 },
  { id: 2, Icon: BodyShape2, label: 'Shape 2', width: 42, height: 55 },
  { id: 3, Icon: BodyShape3, label: 'Shape 3', width: 30, height: 55 },
  { id: 4, Icon: BodyShape4, label: 'Shape 4', width: 55, height: 55 },
  { id: 5, Icon: BodyShape5, label: 'Shape 5', width: 38, height: 55 },
]

const measurementOptions = Array.from({ length: 100 }, (_, i) => (60 + i).toString())
const athleticLevelLabels = ['low', 'medium', 'high'] as const

export default function QuickMode() {
  const navigate = useNavigate()

  // API & konteksti
  const { updateAvatarMeasurements } = useAvatarApi()
  const { refreshAvatars } = useAvatars()
  const { currentAvatar, loadAvatarFromBackend } = useAvatarConfiguration()

  // lokalni state
  const [selectedBodyShape, setSelectedBodyShape] = useState(3)
  const [athleticLevel, setAthleticLevel] = useState(1) // 0, 1, 2
  const [bustCircumference, setBustCircumference] = useState('')
  const [waistCircumference, setWaistCircumference] = useState('')
  const [lowHipCircumference, setLowHipCircumference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // sessionStorage meta (kompatibilno s postojećim)
  const [storedAvatarId, setStoredAvatarId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  })

  // --------- Stored metadata kompat sloj ---------
  type StoredAvatarMetadata = {
    avatarId?: string
    name?: string
    avatarName?: string
    gender?: 'male' | 'female'
    ageRange?: string
    basicMeasurements?: Partial<BasicMeasurements>
    bodyMeasurements?: Record<string, number>
    morphTargets?:
      | Record<string, number>
      | (BackendAvatarMorphTarget | AvatarMorphPayload | null | undefined)[]
    quickMode?: boolean
    creationMode?: AvatarCreationMode | null
    quickModeSettings?: (QuickModeSettings | QuickModeSettingsPayload) | null
    source?: string | null
  }

  const storedMetadata = useMemo<StoredAvatarMetadata | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(LAST_CREATED_AVATAR_METADATA_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as StoredAvatarMetadata
    } catch (err) {
      console.warn('Failed to parse stored avatar metadata', err)
      return null
    }
  }, [])

  // morphTargets iz storage-a (legacy kompat)
  type LegacyStoredMorphEntry =
    | BackendAvatarMorphTarget
    | AvatarMorphPayload
    | Record<string, unknown>
    | null
    | undefined

  const storedMorphTargets = useMemo(() => {
    const source = storedMetadata?.morphTargets
    if (!source) return {}

    const toFiniteNumber = (value: unknown): number | undefined => {
      const n = Number(value)
      return Number.isFinite(n) ? n : undefined
    }

    const normalizeLegacyEntry = (entry: LegacyStoredMorphEntry): BackendAvatarMorphTarget | null => {
      if (!entry || typeof entry !== 'object') return null
      const c = entry as Record<string, unknown>

      if (typeof c.name === 'string') {
        const v = toFiniteNumber(c.value) ?? toFiniteNumber(c.sliderValue)
        return v !== undefined ? { name: c.name, value: v } : null
      }
      if (typeof c.backendKey === 'string') {
        const v =
          toFiniteNumber(c.sliderValue) ??
          toFiniteNumber(c.value) ??
          toFiniteNumber(c.unrealValue) ??
          toFiniteNumber(c.defaultValue)
        return v !== undefined ? { name: c.backendKey, value: v } : null
      }
      if (typeof c.id === 'string') {
        const v =
          toFiniteNumber(c.sliderValue) ??
          toFiniteNumber(c.value) ??
          toFiniteNumber(c.unrealValue) ??
          toFiniteNumber(c.defaultValue)
        return v !== undefined ? { name: c.id, value: v } : null
      }
      return null
    }

    if (Array.isArray(source)) {
      const normalized = source.reduce<BackendAvatarMorphTarget[]>((acc, entry) => {
        const n = normalizeLegacyEntry(entry as LegacyStoredMorphEntry)
        if (n) acc.push(n)
        return acc
      }, [])
      return normalized.length ? mapBackendMorphTargetsToRecord(normalized) : {}
    }

    return Object.entries(source).reduce<Record<string, number>>((acc, [k, v]) => {
      if (!k) return acc
      const n = toFiniteNumber(v)
      if (n !== undefined) acc[k] = n
      return acc
    }, {})
  }, [storedMetadata?.morphTargets])

  // koji avatar ID je “trenutni” u legacy/update toku
  const effectiveAvatarId = useMemo(() => {
    return currentAvatar?.avatarId || storedAvatarId || storedMetadata?.avatarId || null
  }, [currentAvatar?.avatarId, storedAvatarId, storedMetadata?.avatarId])

  // helpers
  const parseMeasurement = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  // slider helpers
  const getSliderValue = (clientX: number, slider: HTMLDivElement | null) => {
    if (!slider) return athleticLevel
    const rect = slider.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = x / rect.width
    const newLevel = Math.round(percentage * 2)
    return Math.max(0, Math.min(2, newLevel))
  }
  const handleSliderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const slider = e.currentTarget as HTMLDivElement
    const newLevel = getSliderValue(e.clientX, slider)
    setAthleticLevel(newLevel)
    window.addEventListener('mousemove', handleSliderMouseMove)
    window.addEventListener('mouseup', handleSliderMouseUp)
  }
  const handleSliderMouseMove = (e: MouseEvent) => {
    const slider = document.getElementById('athletic-slider-track') as HTMLDivElement | null
    if (!slider) return
    const newLevel = getSliderValue(e.clientX, slider)
    setAthleticLevel(newLevel)
  }
  const handleSliderMouseUp = () => {
    window.removeEventListener('mousemove', handleSliderMouseMove)
    window.removeEventListener('mouseup', handleSliderMouseUp)
  }
  const handleSliderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const slider = e.currentTarget as HTMLDivElement
    const touch = e.touches[0]
    const newLevel = getSliderValue(touch.clientX, slider)
    setAthleticLevel(newLevel)
    window.addEventListener('touchmove', handleSliderTouchMove)
    window.addEventListener('touchend', handleSliderTouchEnd)
  }
  const handleSliderTouchMove = (e: TouchEvent) => {
    const slider = document.getElementById('athletic-slider-track') as HTMLDivElement | null
    if (!slider) return
    const touch = e.touches[0]
    const newLevel = getSliderValue(touch.clientX, slider)
    setAthleticLevel(newLevel)
  }
  const handleSliderTouchEnd = () => {
    window.removeEventListener('touchmove', handleSliderTouchMove)
    window.removeEventListener('touchend', handleSliderTouchEnd)
  }

  // GLAVNA AKCIJA
  const handleGenerateAvatar = useCallback(async () => {
    console.log('🚀 Starting avatar generation from QuickMode')

    if (isSubmitting) return

    // 1) Tri QuickMode mjere
    const chest = parseMeasurement(bustCircumference)
    const waist = parseMeasurement(waistCircumference)
    const lowHip = parseMeasurement(lowHipCircumference)

    // 2) Skupi poznate + QuickMode mjere
    const bodyMeasurements: Record<string, number> = {}
    if (currentAvatar?.bodyMeasurements) {
      for (const [k, v] of Object.entries(currentAvatar.bodyMeasurements)) {
        if (typeof v === 'number' && Number.isFinite(v)) bodyMeasurements[k] = v
      }
    }
    if (typeof chest === 'number') bodyMeasurements.chest = chest
    if (typeof waist === 'number') bodyMeasurements.waist = waist
    if (typeof lowHip === 'number') bodyMeasurements.lowHip = lowHip

    // 3) za derivaciju
    const height = currentAvatar?.basicMeasurements?.height ?? storedMetadata?.basicMeasurements?.height
    const weight = currentAvatar?.basicMeasurements?.weight ?? storedMetadata?.basicMeasurements?.weight

    // 4) Popuni ostatak (bez hardkodiranja)
    const completeBody = deriveMissingMeasurements(bodyMeasurements, { height, weight })
    const normalizedMeasurements = normalizeMeasurementRecord(completeBody)
    const baselineMeasurements = computeBaselineMeasurementsFromBasics({ height, weight })
    const measurementMorphTargets = buildMeasurementMorphTargetMap(
      normalizedMeasurements,
      baselineMeasurements,
    )
    const quickModeMeasurementSnapshot: Record<string, number> = {}
    for (const [key, value] of Object.entries(normalizedMeasurements)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        quickModeMeasurementSnapshot[key] = value
      }
    }
    if (typeof chest === 'number' && Number.isFinite(chest)) quickModeMeasurementSnapshot.chest = chest
    if (typeof waist === 'number' && Number.isFinite(waist)) quickModeMeasurementSnapshot.waist = waist
    if (typeof lowHip === 'number' && Number.isFinite(lowHip)) quickModeMeasurementSnapshot.lowHip = lowHip

    // 5) QuickMode morph “features” → naš BE
    const bodyShapeMorphValue = Math.round(((selectedBodyShape - 1) / Math.max(1, bodyShapes.length - 1)) * 100)
    const athleticMorphValue = Math.round((athleticLevel / 2) * 100)
    const quickModeBodyShapeKey = ['shape_1', 'shape_2', 'shape_3', 'shape_4', 'shape_5'][selectedBodyShape - 1] ?? null
    const quickModeAthleticLabel = athleticLevelLabels[athleticLevel] ?? null
    const morphTargets = {
      ...storedMorphTargets,
      ...measurementMorphTargets,
      quickModeBodyShape: bodyShapeMorphValue,
      quickModeAthleticLevel: athleticMorphValue,
    }

    // 6) Odaberi tok
    const haveExisting = Boolean(effectiveAvatarId)

    if (!USE_LOADING_ROUTE && haveExisting) {
      // ─── A) LEGACY/UPDATE (tvoj stari tok) ─────────────────────────────
      setIsSubmitting(true); setError(null)
      try {
        const payload: AvatarPayload = {
          name: currentAvatar?.avatarName ?? 'Avatar',
          gender: currentAvatar?.gender ?? 'male',
          ageRange: currentAvatar?.ageRange ?? '20-29',
          creationMode: currentAvatar?.creationMode ?? 'preset',
          quickMode: true,
          source: currentAvatar?.source ?? 'web',
          basicMeasurements: currentAvatar?.basicMeasurements ?? {},
          bodyMeasurements: completeBody,
          morphTargets,
          quickModeSettings: {
            ...(currentAvatar?.quickModeSettings ?? {}),
            bodyShape: quickModeBodyShapeKey,
            athleticLevel: quickModeAthleticLabel,
            measurements: {
              ...(currentAvatar?.quickModeSettings?.measurements ?? {}),
              ...quickModeMeasurementSnapshot,
            },
            updatedAt: new Date().toISOString(),
          },
        }

        const morphs = buildBackendMorphPayload(payload)
        const finalPayload: AvatarPayload = morphs ? { ...payload, morphs } : payload
        if (morphs) delete (finalPayload as { morphTargets?: Record<string, number> }).morphTargets

        const result = await updateAvatarMeasurements(effectiveAvatarId!, finalPayload)

        const backendAvatar = result.backendAvatar
        const persistedAvatarId = backendAvatar?.id ?? result.avatarId ?? effectiveAvatarId

        if (persistedAvatarId) {
          setStoredAvatarId(persistedAvatarId)
          window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, persistedAvatarId)
        }

        // spremi metapodatke (kao i prije)
        const storageMorphTargets =
          backendAvatar?.morphTargets ??
          (Array.isArray(morphs)
            ? (morphs
                .map((m): BackendAvatarMorphTarget | null => {
                  if (!m) return null
                  const key = m.backendKey ?? m.id
                  const val = Number(m.sliderValue)
                  if (!key || !Number.isFinite(val)) return null
                  return { name: key, value: val }
                })
                .filter(Boolean) as BackendAvatarMorphTarget[])
            : undefined) ??
          (payload.morphTargets
            ? Object.entries(payload.morphTargets).reduce<BackendAvatarMorphTarget[]>((acc, [k, v]) => {
                const n = Number(v)
                if (k && Number.isFinite(n)) acc.push({ name: k, value: n })
                return acc
              }, [])
            : undefined)

        window.sessionStorage.setItem(
          LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
          JSON.stringify({
            avatarId: persistedAvatarId ?? effectiveAvatarId,
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
          }),
        )

        if (backendAvatar) {
          await loadAvatarFromBackend(backendAvatar, undefined, persistedAvatarId ?? effectiveAvatarId ?? undefined)
        }

        if (persistedAvatarId) {
          try { await refreshAvatars() } catch (e) { console.error('Failed to refresh avatars', e) }
        }

        navigate('/unreal-measurements')
      } catch (err) {
        console.error('Failed to update avatar measurements', err)
        setError(err instanceof Error ? err.message : 'Failed to update avatar measurements')
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // ─── B) LOADING ROUTE (kolegin tok → Unreal) ───────────────────────
      const quickModeFeatureMorphTargets = {
        lowerBellyMoveUpDown: 50 + (selectedBodyShape - 3) * 5,
        upperBellyWidth: 45 + (selectedBodyShape - 3) * 3,
        pelvicDepth: 55 - (selectedBodyShape - 3) * 2,
        shoulderSize: 50 + (selectedBodyShape - 3) * 8,
        armsMuscular: athleticLevel * 25,
        bodyMuscular: athleticLevel * 30,
        chestSize: 50 + (selectedBodyShape - 3) * 7,
      }
      const combinedMorphTargets = {
        ...measurementMorphTargets,
        ...quickModeFeatureMorphTargets,
        quickModeBodyShape: bodyShapeMorphValue,
        quickModeAthleticLevel: athleticMorphValue,
      }

      const cmd: CreateAvatarCommand = {
        type: 'createAvatar',
        data: {
          avatarName: currentAvatar?.avatarName ?? `QuickMode Avatar ${Date.now()}`,
          gender: currentAvatar?.gender ?? 'female',
          ageRange: currentAvatar?.ageRange ?? '25-35',
          basicMeasurements: {
            ...(typeof height === 'number' ? { height } : {}),
            ...(typeof weight === 'number' ? { weight } : {}),
            creationMode: 'quickMode',
          },
          bodyMeasurements: completeBody,
          // UE-morph map (kolegin očekivani ključevni set)
          morphTargets: combinedMorphTargets,
          quickModeSettings: {
            bodyShape: quickModeBodyShapeKey,
            athleticLevel: quickModeAthleticLabel,
            measurements: Object.keys(quickModeMeasurementSnapshot).length
              ? quickModeMeasurementSnapshot
              : {
                  ...(typeof chest === 'number' ? { chest } : {}),
                  ...(typeof waist === 'number' ? { waist } : {}),
                  ...(typeof lowHip === 'number' ? { lowHip } : {}),
                },
            updatedAt: new Date().toISOString(),
          },
        },
      }

      try {
        localStorage.setItem('pendingAvatarData', JSON.stringify(cmd))
        navigate('/loading?destination=unreal-measurements')
      } catch (e) {
        console.error('Failed to start loading flow', e)
        setError(e instanceof Error ? e.message : 'Failed to start loading flow')
      }
    }
  }, [
    // routing & guard
    isSubmitting,
    navigate,

    // legacy grana
    effectiveAvatarId,
    updateAvatarMeasurements,
    loadAvatarFromBackend,
    refreshAvatars,

    // quickmode inputi
    bustCircumference,
    waistCircumference,
    lowHipCircumference,
    selectedBodyShape,
    athleticLevel,

    // kontekst
    currentAvatar?.avatarName,
    currentAvatar?.gender,
    currentAvatar?.ageRange,
    currentAvatar?.creationMode,
    currentAvatar?.source,
    currentAvatar?.basicMeasurements,
    currentAvatar?.bodyMeasurements,
    currentAvatar?.quickModeSettings,

    // storage fallbacki
    storedMetadata?.basicMeasurements,
    storedMorphTargets,
  ])

  return (
    <div className={styles.quickmodePage}>
      <div className={styles.canvas}>
        <Header
          title="Body Shape & Fitness"
          variant="dark"
          onExit={() => navigate('/')}
          onInfo={() => navigate('/use-of-data')}
        />

        <div className={styles.quickmodeContent}>
          {/* Body Shape */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>What’s your body shape?</div>
            <div className={styles.bodyshapeRow}>
              {bodyShapes.map((shape) => (
                <button
                  key={shape.id}
                  className={`${styles.buttonReset} ${styles.bodyshapeBtn}`}
                  onClick={() => setSelectedBodyShape(shape.id)}
                  aria-label={shape.label}
                  type="button"
                >
                  <shape.Icon
                    width={shape.width}
                    height={shape.height}
                    fill={selectedBodyShape === shape.id ? '#000' : '#fff'}
                    className={styles.bodyshapeIcon}
                    color={selectedBodyShape === shape.id ? '#000' : '#fff'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Athletic Level */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>How athletic are you?</div>
            <div className={styles.athleticSliderWrap}>
              <div
                id="athletic-slider-track"
                className={styles.athleticSliderTrack}
                onMouseDown={handleSliderMouseDown}
                onTouchStart={handleSliderTouchStart}
              >
                <img src={athleticTrack} alt="" className={styles.athleticTrack} />
                <img
                  src={athleticCircle}
                  alt=""
                  className={`${styles.athleticCircle} ${
                    athleticLevel === 0 ? styles.level0 : athleticLevel === 1 ? styles.level1 : styles.level2
                  }`}
                  draggable={false}
                />
              </div>
              <div className={styles.athleticIcons}>
                <img src={athleticThin} alt="Thin" />
                <img src={athleticNormal} alt="Normal" />
                <img src={athleticMuscular} alt="Muscular" />
              </div>
            </div>
          </div>

          {/* Measurements */}
          <div className={styles.sectionMeasurements}>
            <div className={styles.measureRow}>
              <div className={styles.measureLabel}>Bust Circumference</div>
              <select
                value={bustCircumference}
                onChange={e => setBustCircumference(e.target.value)}
                className={styles.measureSelect}
              >
                <option value="">...</option>
                {measurementOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className={styles.measureUnit}>cm</span>
            </div>

            <div className={styles.measureRow}>
              <div className={styles.measureLabel}>Waist Circumference</div>
              <select
                value={waistCircumference}
                onChange={e => setWaistCircumference(e.target.value)}
                className={styles.measureSelect}
              >
                <option value="">...</option>
                {measurementOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className={styles.measureUnit}>cm</span>
            </div>

            <div className={styles.measureRow}>
              <div className={styles.measureLabel}>Low Hip Circumference</div>
              <select
                value={lowHipCircumference}
                onChange={e => setLowHipCircumference(e.target.value)}
                className={styles.measureSelect}
              >
                <option value="">...</option>
                {measurementOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className={styles.measureUnit}>cm</span>
            </div>
          </div>

          {error ? <div className={styles.errorMessage}>{error}</div> : null}
        </div>

        {/* Bottom Buttons */}
        <div className={styles.footerSlot}>
          <Footer
            backText="Back"
            actionText={isSubmitting ? 'Generating…' : 'Generate Avatar'}
            onBack={() => navigate('/avatar-info')}
            onAction={handleGenerateAvatar}
            actionDisabled={
              !selectedBodyShape ||
              bustCircumference === '' ||
              waistCircumference === '' ||
              lowHipCircumference === '' ||
              isSubmitting
            }
            actionType="primary"
          />
        </div>
      </div>
    </div>
  )
}
