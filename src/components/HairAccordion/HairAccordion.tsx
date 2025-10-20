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
import { getAvatarDisplayName } from '../../utils/avatarName'
import TriToneSelector from '../TriToneSelector/TriToneSelector'

// Paleta boja kose (ograničena na dopuštenih 0-7 ID-eva)
const HAIR_COLORS = [
  { id: 0, hex: '#000000' }, // jet black
  { id: 1, hex: '#3B2A1A' }, // dark brown
  { id: 2, hex: '#5C4033' }, // medium brown
  { id: 3, hex: '#8B5A2B' }, // chestnut
  { id: 4, hex: '#A0522D' }, // auburn
  { id: 5, hex: '#C68642' }, // caramel
  { id: 6, hex: '#D2B48C' }, // sandy blonde
  { id: 7, hex: '#F1E3B1' }, // platinum blonde
] as const

// Preset ID-evi frizura u dopuštenom rasponu 0-7
const HAIR_STYLE_PRESETS = [0, 1, 2, 3, 4, 5, 6, 7] as const

// Ključevi koje čuvamo u quickModeSettings.measurements (samo brojevi!)
const HAIR_KEYS = {
  styleIndex: 'hairStyleIndex',
  colorIndex: 'hairColorIndex',
} as const

export default function HairAccordion() {
  const { currentAvatar } = useAvatarConfiguration()
  const { updateAvatarMeasurements } = useAvatarApi()

  // Pixel Streaming
  const { sendFitSpaceCommand, connectionState } = usePixelStreaming()
  const simpleState = useMemo<'connected' | 'connecting' | 'disconnected'>(() => {
    return connectionState === 'connected'
      ? 'connected'
      : connectionState === 'connecting'
        ? 'connecting'
        : 'disconnected'
  }, [connectionState])
  const sendQueued = useQueuedUnreal(sendFitSpaceCommand, simpleState)

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
  const colorOption = useMemo(() => {
    return HAIR_COLORS[colorIndex] ?? HAIR_COLORS[0]
  }, [colorIndex])
  const base = useMemo(() => colorOption.hex, [colorOption])
  const light = useMemo(() => lightenHex(base), [base])
  const dark = useMemo(() => darkenHex(base), [base])

  // Carousel (stvarni preview-ovi bi bili različiti po stilu)
  const prevStyle = () =>
    setStyleIndex(i => (i + HAIR_STYLE_PRESETS.length - 1) % HAIR_STYLE_PRESETS.length)
  const nextStyle = () =>
    setStyleIndex(i => (i + 1) % HAIR_STYLE_PRESETS.length)

  const prevColor = useCallback(
    () => setColorIndex(i => (i + HAIR_COLORS.length - 1) % HAIR_COLORS.length),
    [],
  )
  const nextColor = useCallback(
    () => setColorIndex(i => (i + 1) % HAIR_COLORS.length),
    [],
  )

  // --- Debounced spremanje u backend ---
  const saveTimerRef = useRef<number | null>(null)
  const batchRef = useRef<Record<string, number>>({})

  const flushSave = useCallback(async () => {
    const pending = batchRef.current
    batchRef.current = {}

    const avatarId = currentAvatar?.avatarId
    if (!avatarId) return

    const safeName = getAvatarDisplayName(currentAvatar)
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
  const styleId = useMemo(() => HAIR_STYLE_PRESETS[styleIndex] ?? HAIR_STYLE_PRESETS[0], [styleIndex])

  // Svaka promjena ide i u UE i u backend (debounce)
  useEffect(() => {
    if (styleId === undefined) return
    sendQueued(
      'updateHair',
      {
        mode: 'style',
        id: styleId,
      },
      'hair style update'
    )
  }, [sendQueued, styleId])

  const { id: colorId } = colorOption

  useEffect(() => {
    sendQueued(
      'updateHair',
      {
        mode: 'color',
        id: colorId,
        hex: base,
      },
      'hair color update'
    )
  }, [base, colorId, sendQueued])

  useEffect(() => {
    const colorPacked = parseInt(base.slice(1), 16) // 0xRRGGBB kao broj
    scheduleSave({
      [HAIR_KEYS.styleIndex]: styleIndex,
      [HAIR_KEYS.colorIndex]: colorIndex,
      hairColorPacked: Number.isFinite(colorPacked) ? colorPacked : 0,
    })
  }, [styleIndex, colorIndex, base, scheduleSave])

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

          <TriToneSelector
            className={styles.colorSwatches}
            icons={[Skin1Icon, Skin1Icon, Skin1Icon]}
            colors={[light, base, dark]}
            orientation="vertical"
            interactive={false}
            buttonClassName={styles.swatch}
            buttonClassNames={[styles.swatchSide, styles.swatchCenter, styles.swatchSide]}
            iconClassName={styles.previewIcon}
          />

          <button type="button" className={styles.vArrow} onClick={nextColor} aria-label="Lighter">
            <img src={ArrowDown} alt="Down" />
          </button>
        </div>
      </div>
    </div>
  )
}
