import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import Skin1 from '../../assets/skin1.svg?react'
import Skin2 from '../../assets/skin2.svg?react'
import Skin3 from '../../assets/skin3.svg?react'
import { darkenHex, lightenHex } from '../../utils/color'
import { SKIN_TONE_BASE_HEXES } from '../../constants/avatarColors'
import styles from './SkinAccordion.module.scss'
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useQueuedUnreal } from '../../services/queuedUnreal'

interface SkinAccordionProps {
  defaultRightExpanded?: boolean
}

const SKIN_KEYS = {
  baseIndex: 'skinBaseIndex',
  tonePercent: 'skinTone',
  variantIndex: 'skinVariant',
} as const

const SKIN_VARIANT_COUNT = 3

// Mapping helpers -----------------------------------------------------------
// Skin tone values in Unreal are expressed as a discrete range [0, 12].
// We map our palette selection (baseIndex) and variant focus (focusedIndex)
// onto that range by treating each base as a "bucket" of three tones:
//   baseIndex * 2 gives us the bucket start, and the variant shifts us within it
//   (light:0, mid:1, dark:2). When no variant is focused we default to the mid tone.
// This keeps the mapping easy to reason about and guarantees the final value
// stays inside the supported 0–12 range while preserving a monotonic ordering.
const mapToSkinTone = (baseIndex: number, variantIndex: number | null) => {
  const normalizedVariant = Number.isFinite(variantIndex ?? NaN)
    ? Math.min(Math.max(variantIndex as number, 0), 2)
    : 1
  const bucketed = baseIndex * 2 + normalizedVariant
  return Math.min(Math.max(bucketed, 0), 12)
}

// Unreal expects brightness in the range [0.25, 1.75]. Our UI slider stores
// percentages (0–100), so we apply a simple linear transformation between the
// two domains for easier maintenance and reuse in tests.
const mapToBrightness = (tonePercent: number) => {
  const clamped = Math.min(Math.max(tonePercent, 0), 100)
  const min = 0.25
  const max = 1.75
  return min + (clamped / 100) * (max - min)
}

export default function SkinAccordion({ defaultRightExpanded = false }: SkinAccordionProps) {
  const {
    currentAvatar,
    updateQuickModeMeasurements,
  } = useAvatarConfiguration()

  const { sendFitSpaceCommand, connectionState } = usePixelStreaming();
  const simpleState = useMemo<'connected' | 'connecting' | 'disconnected'>(() => {
    return connectionState === 'connected'
      ? 'connected'
      : connectionState === 'connecting'
        ? 'connecting'
        : 'disconnected';
  }, [connectionState])

  const sendQueued = useQueuedUnreal(sendFitSpaceCommand, simpleState /*, 50 */)


  // Paleta baza (svjetlije ←→ tamnije)
  const basePalette = SKIN_TONE_BASE_HEXES

  // Učitaj spremljene vrijednosti
  const savedMeas = (currentAvatar?.quickModeSettings?.measurements ?? {}) as Record<string, unknown>

  const initialBaseIndex = (() => {
    const raw = Number(savedMeas[SKIN_KEYS.baseIndex])
    return Number.isFinite(raw) ? Math.min(Math.max(raw, 0), basePalette.length - 1) : 2
  })()

  const initialTonePct = (() => {
    const raw = Number(savedMeas[SKIN_KEYS.tonePercent])
    return Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 100) : 50
  })()

  // UI state, lijevi dio (varijante ikonica), desni dio (slider)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null) // ili initialVariant ako želiš odmah “single” view
  const [rightExpanded, setRightExpanded] = useState(defaultRightExpanded)

  // Stanje za bazu, varijantu i “tone” (0–100)
  const [baseIndex, setBaseIndex] = useState(initialBaseIndex)
  const [tonePct, setTonePct] = useState(initialTonePct)

  // izvedene boje (za UI prikaz)
  const base = basePalette[baseIndex]
  const light = lightenHex(base)
  const dark = darkenHex(base)

  // orijentacija slidera --- Desni slider: horizontalno na mobu, vertikalno >=1024px ---
  const [isVertical, setIsVertical] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)
  const [posPx, setPosPx] = useState(0)

  // Center the thumb based on the real rendered width of the bar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setIsVertical(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Pomoćna: postavi `posPx` iz tonePct kada znamo dimenzije bara
  const recalcPosFromPercent = useCallback(() => {
    const bar = barRef.current
    if (!bar) return
    const length = isVertical ? bar.offsetHeight : bar.offsetWidth
    setPosPx((tonePct / 100) * length)
  }, [tonePct, isVertical])

  useEffect(() => {
    recalcPosFromPercent()
  }, [recalcPosFromPercent])

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const ro = new ResizeObserver(() => recalcPosFromPercent())
    ro.observe(bar)
    return () => ro.disconnect()
  }, [recalcPosFromPercent])

  const emitSkinCommands = useCallback((base: number, tone: number, variant: number | null) => {
    const nextSkinTone = mapToSkinTone(base, variant)
    const nextBrightness = mapToBrightness(tone)

    sendQueued(
      'updateSkin',
      {
        skin_tone: nextSkinTone,
      },
      'skin update',
    )
    sendQueued(
      'updateSkinBrightness',
      {
        brightness: nextBrightness,
      },
      'skin brightness',
    )
  }, [sendQueued])

  const applySkinState = useCallback((changes: {
    baseIndex?: number
    tonePct?: number
    focusedIndex?: number | null
  }) => {
    const nextBase = changes.baseIndex ?? baseIndex
    const nextTone = changes.tonePct ?? tonePct
    const hasFocusedIndex = Object.prototype.hasOwnProperty.call(changes, 'focusedIndex')
    const nextFocused = hasFocusedIndex ? changes.focusedIndex ?? null : focusedIndex

    const baseChanged = nextBase !== baseIndex
    const toneChanged = nextTone !== tonePct
    const focusedChanged = nextFocused !== focusedIndex

    if (baseChanged) setBaseIndex(nextBase)
    if (toneChanged) setTonePct(nextTone)
    if (focusedChanged) setFocusedIndex(nextFocused)

    if (!baseChanged && !toneChanged && !focusedChanged) {
      return
    }

    emitSkinCommands(nextBase, nextTone, nextFocused)

    updateQuickModeMeasurements({
      [SKIN_KEYS.baseIndex]: nextBase,
      [SKIN_KEYS.tonePercent]: nextTone,
      [SKIN_KEYS.variantIndex]: nextFocused,
    }, { section: 'quickMode.skin' })
  }, [
    baseIndex,
    tonePct,
    focusedIndex,
    emitSkinCommands,
    updateQuickModeMeasurements,
  ])

  const initialSyncRef = useRef(false)

  useEffect(() => {
    if (initialSyncRef.current) return
    initialSyncRef.current = true
    emitSkinCommands(baseIndex, tonePct, focusedIndex)
  }, [baseIndex, tonePct, focusedIndex, emitSkinCommands])

  // --- Handleri za promjene UI-a + spremanje ---
  const handlePrev = () => {
    const nextBase = (baseIndex + basePalette.length - 1) % basePalette.length
    const nextFocused =
      focusedIndex !== null
        ? (focusedIndex + SKIN_VARIANT_COUNT - 1) % SKIN_VARIANT_COUNT
        : focusedIndex
    applySkinState({
      baseIndex: nextBase,
      ...(focusedIndex !== null ? { focusedIndex: nextFocused } : {}),
    })
  }

  const handleNext = () => {
    const nextBase = (baseIndex + 1) % basePalette.length
    const nextFocused =
      focusedIndex !== null
        ? (focusedIndex + 1) % SKIN_VARIANT_COUNT
        : focusedIndex
    applySkinState({
      baseIndex: nextBase,
      ...(focusedIndex !== null ? { focusedIndex: nextFocused } : {}),
    })
  }

  const onSelectIcon = (idx: number) => {
    applySkinState({ focusedIndex: idx })
  }

  const onStartDrag = (startEvent: PointerEvent) => {
    const bar = barRef.current
    if (!bar) return
    startEvent.preventDefault()
    const rect = bar.getBoundingClientRect()

    const updateFromCoords = (clientX: number, clientY: number) => {
      const length = isVertical ? rect.height : rect.width
      const raw = isVertical ? clientY - rect.top : clientX - rect.left
      const clampedPx = Math.max(0, Math.min(length, raw))
      setPosPx(clampedPx)
      const pct = Math.round((clampedPx / length) * 100)
      applySkinState({ tonePct: pct })
    }

    updateFromCoords(startEvent.clientX, startEvent.clientY)
    const onMove = (e: PointerEvent) => updateFromCoords(e.clientX, e.clientY)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className={`${styles.container} ${rightExpanded ? styles.expandedRight : ''}`}>
      <div className={styles.left} role="button" tabIndex={0}>
        <div className={styles.group} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.arrow} onClick={handlePrev}>
            <img src={ArrowLeft} alt="Prev" />
          </button>

          {focusedIndex === null ? (
            <div className={styles.iconsThree}>
              <button type="button" className={styles.iconBtn} onClick={() => onSelectIcon(0)}>
                <Skin1 className={styles.iconSmall} style={{ color: light }} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => onSelectIcon(1)}>
                <Skin2 className={styles.iconLarge} style={{ color: base }} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => onSelectIcon(2)}>
                <Skin3 className={styles.iconSmall} style={{ color: dark }} />
              </button>
            </div>
          ) : (
            <div className={styles.iconOne}>
              <button type="button" className={styles.iconBtn} onClick={() => applySkinState({ focusedIndex: null })}>
                {focusedIndex === 0 && <Skin1 className={styles.iconLarge} style={{ color: light }} />}
                {focusedIndex === 1 && <Skin2 className={styles.iconLarge} style={{ color: base }} />}
                {focusedIndex === 2 && <Skin3 className={styles.iconLarge} style={{ color: dark }} />}
              </button>
            </div>
          )}

          <button type="button" className={styles.arrow} onClick={handleNext}>
            <img src={ArrowRight} alt="Next" />
          </button>
        </div>
      </div>

      <div
        className={styles.right}
        role="button"
        tabIndex={0}
        onClick={() => setRightExpanded((v) => !v)}
      >
        <div className={styles.rightContent}>
          <div className={styles.frameTop} />

          <div className={styles.toneBarGroup}>
            <div className={styles.toneBar} ref={barRef}>
              <button
                type="button"
                className={styles.thumb}
                style={isVertical ? { top: `${posPx}px`, left: '50%' } : { left: `${posPx}px` }}
                onPointerDown={(e) => { e.stopPropagation(); onStartDrag(e.nativeEvent) }}
                aria-label="Adjust tone"
              />
            </div>
          </div>

          <div className={styles.frameBottom} />

          <div className={styles.frames}>
            <div className={styles.frameB} />
            <div className={styles.frameG} />
            <div className={styles.frameW} />
          </div>
        </div>
      </div>
    </div>
  )
}