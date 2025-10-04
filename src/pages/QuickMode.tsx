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
  useAvatarApi,
  type QuickModeSettingsPayload,
} from '../services/avatarApi'
import { useAvatars } from '../context/AvatarContext'
import {
  useAvatarConfiguration,
  type BasicMeasurements,
  type AvatarCreationMode,
  type QuickModeSettings,
} from '../context/AvatarConfigurationContext'

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
  const { updateAvatarMeasurements } = useAvatarApi()
  const { avatars, maxAvatars, updateAvatars } = useAvatars()
  const { currentAvatar, loadAvatarFromBackend } = useAvatarConfiguration()

  const [selectedBodyShape, setSelectedBodyShape] = useState(3)
  const [athleticLevel, setAthleticLevel] = useState(1) // 0, 1, 2
  const [bustCircumference, setBustCircumference] = useState('')
  const [waistCircumference, setWaistCircumference] = useState('')
  const [lowHipCircumference, setLowHipCircumference] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storedAvatarId, setStoredAvatarId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(LAST_LOADED_AVATAR_STORAGE_KEY)
  })

  type StoredAvatarMetadata = {
    avatarId?: string
    avatarName?: string
    gender?: 'male' | 'female'
    ageRange?: string
    basicMeasurements?: Partial<BasicMeasurements>
    bodyMeasurements?: Record<string, number>
    morphTargets?: Record<string, number>
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

  const effectiveAvatarId = useMemo(() => {
    return (
      currentAvatar?.avatarId ||
      storedAvatarId ||
      storedMetadata?.avatarId ||
      null
    )
  }, [currentAvatar?.avatarId, storedAvatarId, storedMetadata?.avatarId])

  const parseMeasurement = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  // Helper to get slider value from X position
  const getSliderValue = (clientX: number, slider: HTMLDivElement | null) => {
    if (!slider) return athleticLevel
    const rect = slider.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = x / rect.width
    const newLevel = Math.round(percentage * 2)
    return Math.max(0, Math.min(2, newLevel))
  }

  // Mouse events
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

  // Touch events
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

  const handleGenerateAvatar = useCallback(async () => {
    if (isSubmitting) return
    if (!effectiveAvatarId) {
      setError('Please create an avatar before continuing')
      return
    }

    const bust = parseMeasurement(bustCircumference)
    const waist = parseMeasurement(waistCircumference)
    const hip = parseMeasurement(lowHipCircumference)

    const bodyMeasurements: Record<string, number> = {}
    if (currentAvatar?.bodyMeasurements) {
      Object.entries(currentAvatar.bodyMeasurements).forEach(([key, value]) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          bodyMeasurements[key] = value
        }
      })
    }
    if (storedMetadata?.bodyMeasurements) {
      Object.entries(storedMetadata.bodyMeasurements).forEach(([key, value]) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          bodyMeasurements[key] = value
        }
      })
    }
    if (typeof bust === 'number') bodyMeasurements.chest = bust
    if (typeof waist === 'number') bodyMeasurements.waist = waist
    if (typeof hip === 'number') bodyMeasurements.lowHip = hip

    const bodyShapeMorphValue = Math.round(
      ((selectedBodyShape - 1) / Math.max(1, bodyShapes.length - 1)) * 100,
    )
    const athleticMorphValue = Math.round((athleticLevel / 2) * 100)

    const morphTargets = {
      ...(storedMetadata?.morphTargets ?? {}),
      quickModeBodyShape: bodyShapeMorphValue,
      quickModeAthleticLevel: athleticMorphValue,
    }

    const selectedBodyShapeMeta = bodyShapes.find(shape => shape.id === selectedBodyShape)
    const normalizedBodyShape = selectedBodyShapeMeta
      ? selectedBodyShapeMeta.label.toLowerCase().replace(/\s+/g, '-')
      : undefined
    const athleticLevelKey = athleticLevelLabels[athleticLevel] ?? undefined

    const avatarName = storedMetadata?.avatarName
      ?? (effectiveAvatarId ? avatars.find(avatar => avatar.id === effectiveAvatarId)?.name : undefined)
      ?? currentAvatar?.avatarName
      ?? 'Avatar'

    const gender = storedMetadata?.gender ?? currentAvatar?.gender ?? 'male'
    const ageRange = storedMetadata?.ageRange ?? currentAvatar?.ageRange ?? '20-29'
    const creationMode: AvatarCreationMode =
      storedMetadata?.creationMode ?? currentAvatar?.creationMode ?? 'manual'

    const baseBasicMeasurements =
      storedMetadata?.basicMeasurements ??
      (currentAvatar?.basicMeasurements as Partial<BasicMeasurements> | undefined) ??
      {}
    const basicMeasurements: Partial<BasicMeasurements> = {
      ...baseBasicMeasurements,
      ...(creationMode ? { creationMode } : {}),
    }

    const quickModeFlag = storedMetadata?.quickMode ?? currentAvatar?.quickMode ?? true
    const source = storedMetadata?.source ?? currentAvatar?.source ?? 'web'

    const baseQuickModeSettings: (QuickModeSettings | QuickModeSettingsPayload | null | undefined) =
      storedMetadata?.quickModeSettings ?? currentAvatar?.quickModeSettings ?? null

    const quickModeMeasurements: Record<string, number> = {}
    if (baseQuickModeSettings?.measurements) {
      Object.entries(baseQuickModeSettings.measurements).forEach(([key, value]) => {
        const numericValue = Number(value)
        if (Number.isFinite(numericValue)) {
          quickModeMeasurements[key] = numericValue
        }
      })
    }
    if (typeof bust === 'number') quickModeMeasurements.chest = bust
    if (typeof waist === 'number') quickModeMeasurements.waist = waist
    if (typeof hip === 'number') quickModeMeasurements.lowHip = hip

    const normalizedQuickModeMeasurements = Object.entries(quickModeMeasurements).reduce<Record<string, number>>(
      (acc, [key, value]) => {
        if (Number.isFinite(value)) {
          acc[key] = Number(value)
        }
        return acc
      },
      {},
    )

    const hasQuickModeSettings =
      Boolean(normalizedBodyShape) ||
      Boolean(athleticLevelKey) ||
      Object.keys(normalizedQuickModeMeasurements).length > 0

    const quickModeSettings: QuickModeSettingsPayload | undefined = hasQuickModeSettings
      ? {
          ...(normalizedBodyShape ? { bodyShape: normalizedBodyShape } : {}),
          ...(athleticLevelKey ? { athleticLevel: athleticLevelKey } : {}),
          ...(Object.keys(normalizedQuickModeMeasurements).length
            ? { measurements: normalizedQuickModeMeasurements }
            : {}),
        }
      : undefined

    const payload = {
      avatarName,
      gender,
      ageRange,
      creationMode,
      quickMode: quickModeFlag,
      source,
      basicMeasurements,
      bodyMeasurements,
      morphTargets,
      ...(quickModeSettings ? { quickModeSettings } : {}),
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await updateAvatarMeasurements(effectiveAvatarId, payload)

      const persistedAvatarId =
        result.backendAvatar?.data.avatarId ?? result.avatarId ?? effectiveAvatarId

      if (persistedAvatarId) {
        setStoredAvatarId(persistedAvatarId)
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, persistedAvatarId)
        }
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
          JSON.stringify({
            avatarId: persistedAvatarId ?? effectiveAvatarId,
            avatarName: result.backendAvatar?.data.avatarName ?? payload.avatarName,
            gender: result.backendAvatar?.data.gender ?? payload.gender,
            ageRange: result.backendAvatar?.data.ageRange ?? payload.ageRange,
            basicMeasurements:
              result.backendAvatar?.data.basicMeasurements ?? payload.basicMeasurements,
            bodyMeasurements:
              result.backendAvatar?.data.bodyMeasurements ?? payload.bodyMeasurements,
            morphTargets:
              result.backendAvatar?.data.morphTargets ?? payload.morphTargets,
            quickMode: result.backendAvatar?.data.quickMode ?? payload.quickMode,
            creationMode: result.backendAvatar?.data.creationMode ?? payload.creationMode,
            quickModeSettings:
              result.backendAvatar?.data.quickModeSettings ?? payload.quickModeSettings ?? null,
            source: result.backendAvatar?.data.source ?? payload.source,
          }),
        )
      }

      if (result.backendAvatar) {
        await loadAvatarFromBackend(
          result.backendAvatar,
          undefined,
          persistedAvatarId ?? effectiveAvatarId,
        )
      }

      if (persistedAvatarId) {
        updateAvatars(prev => {
          const next = [...prev]
          const existingIndex = next.findIndex(avatar => avatar.id === persistedAvatarId)
          const avatarNameToPersist =
            result.backendAvatar?.data.avatarName ?? payload.avatarName
          const createdAtValue =
            existingIndex >= 0
              ? next[existingIndex].createdAt
              : result.backendAvatar?.data.createdAt ?? new Date().toISOString()
          const record = {
            id: persistedAvatarId,
            name: avatarNameToPersist,
            createdAt: createdAtValue,
          }
          if (existingIndex >= 0) {
            next[existingIndex] = { ...record }
            return next
          }
          if (next.length >= maxAvatars) {
            return next
          }
          next.push(record)
          return next
        })
      }

      navigate('/unreal-measurements')
    } catch (err) {
      console.error('Failed to update avatar measurements', err)
      setError(err instanceof Error ? err.message : 'Failed to update avatar measurements')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    athleticLevel,
    bustCircumference,
    avatars,
    currentAvatar?.ageRange,
    currentAvatar?.avatarName,
    currentAvatar?.basicMeasurements,
    currentAvatar?.bodyMeasurements,
    currentAvatar?.creationMode,
    currentAvatar?.gender,
    currentAvatar?.quickMode,
    currentAvatar?.quickModeSettings,
    currentAvatar?.source,
    effectiveAvatarId,
    loadAvatarFromBackend,
    lowHipCircumference,
    maxAvatars,
    navigate,
    selectedBodyShape,
    storedMetadata?.morphTargets,
    storedMetadata?.ageRange,
    storedMetadata?.avatarId,
    storedMetadata?.avatarName,
    storedMetadata?.basicMeasurements,
    storedMetadata?.bodyMeasurements,
    storedMetadata?.creationMode,
    storedMetadata?.gender,
    storedMetadata?.quickMode,
    storedMetadata?.quickModeSettings,
    storedMetadata?.source,
    updateAvatarMeasurements,
    updateAvatars,
    waistCircumference,
    isSubmitting,
  ])

  return (
    <div className={styles.quickmodePage}>
      <div className={styles.canvas}>
        {/* Header */}
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
                  className={`${styles.athleticCircle} ${athleticLevel === 0
                      ? styles.level0
                      : athleticLevel === 1
                        ? styles.level1
                        : styles.level2
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
