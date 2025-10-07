import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import HairBig from '../../assets/woman-hair-beauty-b.svg?react'
import Skin1Icon from '../../assets/skin1.svg?react'
import { darkenHex, lightenHex } from '../../utils/color'
import styles from './HairAccordion.module.scss'
import { useAvatarApi } from '../../services/avatarApi'
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useQueuedUnreal } from '../../services/queuedUnreal'

// Paleta boja kose
const HAIR_COLORS = [
  '#000000', '#3B2A1A', '#5C4033', '#8B5A2B', '#A0522D', '#C68642',
  '#D2B48C', '#E6CBA8', '#F1E3B1', '#6B4E71', '#4B5320',
]

// (primjer) preset ID-evi frizura — zamijeni stvarnim ako imaš
const HAIR_STYLE_PRESETS = [0, 1, 2, 3, 4] as const

// Ključevi koje čuvamo u quickModeSettings.measurements (samo brojevi!)
const HAIR_KEYS = {
  styleIndex: 'hairStyleIndex',
  colorIndex: 'hairColorIndex',
} as const

export default function HairAccordion() {
  const { currentAvatar } = useAvatarConfiguration()
  const { updateAvatarMeasurements } = useAvatarApi()

  // Pixel Streaming
  const { sendFittingRoomCommand, connectionState } = usePixelStreaming()
  const simpleState = useMemo<'connected' | 'connecting' | 'disconnected'>(() => {
    return connectionState === 'connected'
      ? 'connected'
      : connectionState === 'connecting'
        ? 'connecting'
        : 'disconnected'
  }, [connectionState])
  const sendQueued = useQueuedUnreal(sendFittingRoomCommand, simpleState)

  // --- Init iz spremljenih vrijednosti ---
  const savedMeas = (currentAvatar?.quickModeSettings?.measurements ?? {}) as Record<string, unknown>

  const initialStyleIndex = (() => {
    const raw = Number(savedMeas[HAIR_KEYS.styleIndex])
    return Number.isFinite(raw)
      ? Math.max(0, Math.min(raw, HAIR_STYLE_PRESETS.length - 1))
      : 0
  })()

  const initialColorIndex = (() => {
    const raw = Number(savedMeas[HAIR_KEYS.colorIndex])
    return Number.isFinite(raw)
      ? Math.max(0, Math.min(raw, HAIR_COLORS.length - 1))
      : 2 // npr. "brown" default
  })()

  // --- UI state ---
  const [styleIndex, setStyleIndex] = useState<number>(initialStyleIndex)
  const [colorIndex, setColorIndex] = useState<number>(initialColorIndex)

  // izvedene boje (svjetlija/baza/tamnija) za vizual
  const base = useMemo(() => HAIR_COLORS[colorIndex], [colorIndex])
  const light = useMemo(() => lightenHex(base), [base])
  const dark = useMemo(() => darkenHex(base), [base])

  // Carousel (stvarni preview-ovi bi bili različiti po stilu)
  const prevStyle = () =>
    setStyleIndex(i => (i + HAIR_STYLE_PRESETS.length - 1) % HAIR_STYLE_PRESETS.length)
  const nextStyle = () =>
    setStyleIndex(i => (i + 1) % HAIR_STYLE_PRESETS.length)

  const prevColor = () =>
    setColorIndex(i => (i + HAIR_COLORS.length - 1) % HAIR_COLORS.length)
  const nextColor = () =>
    setColorIndex(i => (i + 1) % HAIR_COLORS.length)

  // --- Debounced spremanje u backend ---
  const saveTimerRef = useRef<number | null>(null)
  const batchRef = useRef<Record<string, number>>({})

  const flushSave = useCallback(async () => {
    const pending = batchRef.current
    batchRef.current = {}

    const avatarId = currentAvatar?.avatarId
    if (!avatarId) return

    const safeName = currentAvatar?.avatarName ?? (currentAvatar as any)?.name ?? 'Avatar'
    const safeAgeRange = currentAvatar?.ageRange ?? ''

    try {
      await updateAvatarMeasurements(avatarId, {
        name: safeName,
        gender: currentAvatar!.gender,
        ageRange: safeAgeRange,
        quickModeSettings: {
          measurements: {
            ...(currentAvatar?.quickModeSettings?.measurements ?? {}),
            ...pending, // ⬅️ samo brojevi!
          },
        },
      })
    } catch (err) {
      console.error('Saving hair settings failed', err)
    }
  }, [currentAvatar, updateAvatarMeasurements])

  const scheduleSave = useCallback((patch: Record<string, number>) => {
    batchRef.current = { ...batchRef.current, ...patch }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(flushSave, 500)
  }, [flushSave])

  // --- Slanje u Unreal (queued + throttled kroz useQueuedUnreal) ---
  const pushToUnreal = useCallback(() => {
    const colorHex = base
    sendQueued(
      'configureAvatar',
      {
        action: 'setHair',
        styleIndex,
        stylePreset: HAIR_STYLE_PRESETS[styleIndex], // ako UE želi konkretan ID
        colorIndex,
        color: colorHex, // hex samo za UE (ne spremamo u backend)
      },
      'hair update'
    )
  }, [base, colorIndex, styleIndex, sendQueued])

  // Svaka promjena ide i u UE i u backend (debounce)
  useEffect(() => {
    pushToUnreal()

    const colorPacked = parseInt(base.slice(1), 16) // 0xRRGGBB kao broj
    scheduleSave({
      [HAIR_KEYS.styleIndex]: styleIndex,
      [HAIR_KEYS.colorIndex]: colorIndex,
      hairColorPacked: Number.isFinite(colorPacked) ? colorPacked : 0,
    })
  }, [styleIndex, colorIndex, base, pushToUnreal, scheduleSave])

  // --- Render ---
  const prevIdx = (styleIndex + HAIR_STYLE_PRESETS.length - 1) % HAIR_STYLE_PRESETS.length
  const nextIdx = (styleIndex + 1) % HAIR_STYLE_PRESETS.length

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <button type="button" className={styles.hArrow} onClick={prevStyle} aria-label="Previous style">
          <img src={ArrowLeft} alt="Prev" className={styles.arrowHorizontal} />
        </button>

        <div className={styles.iconStrip}>
          {/* Lijevo malo, centar veliko, desno malo – stilovi (za preview koristimo boju) */}
          <HairBig className={styles.iconSmall} style={{ color: base }} key={`prev-${prevIdx}`} />
          <HairBig className={styles.iconBig}   style={{ color: base }} key={`cur-${styleIndex}`} />
          <HairBig className={styles.iconSmall} style={{ color: base }} key={`next-${nextIdx}`} />
        </div>

        <button type="button" className={styles.hArrow} onClick={nextStyle} aria-label="Next style">
          <img src={ArrowRight} alt="Next" className={styles.arrowHorizontal} />
        </button>
      </div>

      <div className={styles.right}>
        <div className={styles.colorPicker}>
          <button type="button" className={styles.vArrow} onClick={prevColor} aria-label="Darker">
            <img src={ArrowUp} alt="Up" />
          </button>

          <div className={styles.colorSwatches}>
            <div className={`${styles.swatch} ${styles.swatchSide}`}>
              <Skin1Icon className={styles.previewIcon} style={{ color: light }} />
            </div>
            <div className={`${styles.swatch} ${styles.swatchCenter}`}>
              <Skin1Icon className={styles.previewIcon} style={{ color: base }} />
            </div>
            <div className={`${styles.swatch} ${styles.swatchSide}`}>
              <Skin1Icon className={styles.previewIcon} style={{ color: dark }} />
            </div>
          </div>

          <button type="button" className={styles.vArrow} onClick={nextColor} aria-label="Lighter">
            <img src={ArrowDown} alt="Down" />
          </button>
        </div>
      </div>
    </div>
  )
}
