import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import GlassesBig from '../../assets/glasses-b.svg?react' // placeholder i za ostale tipove
import Skin1Icon from '../../assets/skin1.svg?react'
import styles from './ExtrasAccordion.module.scss'

import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useQueuedUnreal } from '../../services/queuedUnreal'
import TriToneSelector from '../TriToneSelector/TriToneSelector'

// Tipovi “extra” itema
const EXTRA_TYPES = ['Earrings', 'Glasses', 'Hats'] as const
type ExtraType = typeof EXTRA_TYPES[number]

// Koliko stilova po tipu (zamijeni stvarnim vrijednostima kad budeš imala)
const STYLE_COUNTS: Record<ExtraType, number> = {
  Earrings: 5,
  Glasses: 5,
  Hats: 5,
}

// Unreal očekuje IDs u rasponu 0-11, pri čemu 11 predstavlja "bez dodatka".
// UI i backend mogu koristiti proizvoljne duljine kolekcija, ali prije slanja u UE
// mapiramo odabrani indeks na dopušteni raspon kako bismo izbjegli slučajno slanje
// izvan raspona. Ako je korisnik odabrao zadnji element u kolekciji, šaljemo ID 11.
const STYLE_ID_RANGE = { min: 0, max: 11 } as const

// Unreal paleta je pojednostavljena na dva ID-a: 0 = neutralne/metalne nijanse,
// 1 = sve ostale boje. UI i backend i dalje mogu koristiti proširenu paletu za vizualni
// odabir, ali prije slanja u UE mapiramo indeks na pripadajući ID.
const COLOR_ID_RANGE = { min: 0, max: 1 } as const

// Ključevi koje spremamo u quickModeSettings.measurements (samo brojevi!)
const EXTRA_KEYS = {
  typeIndex: 'extraTypeIndex',

  // Glasses
  glassesStyleIndex: 'glassesStyleIndex',
  glassesColorIndex: 'glassesColorIndex',
  glassesColorPacked: 'glassesColorPacked',

  // Earrings
  earringsStyleIndex: 'earringsStyleIndex',
  earringsColorIndex: 'earringsColorIndex',
  earringsColorPacked: 'earringsColorPacked',

  // Hats
  hatsStyleIndex: 'hatsStyleIndex',
  hatsColorIndex: 'hatsColorIndex',
  hatsColorPacked: 'hatsColorPacked',
} as const

// Mala util: broj ↔︎ siguran broj
const toNum = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN)
  return Number.isFinite(n) ? n : undefined
}

// Generiraj paletu boja programatski (24 nijanse + 6 neutralnih)
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (0 <= h && h < 60) [r, g, b] = [c, x, 0]
  else if (60 <= h && h < 120) [r, g, b] = [x, c, 0]
  else if (120 <= h && h < 180) [r, g, b] = [0, c, x]
  else if (180 <= h && h < 240) [r, g, b] = [0, x, c]
  else if (240 <= h && h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const R = Math.round((r + m) * 255)
  const G = Math.round((g + m) * 255)
  const B = Math.round((b + m) * 255)
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(R)}${hex(G)}${hex(B)}`
}

function buildPalette(): string[] {
  // 24 nijanse oko kotača + 6 neutralnih (crna→bijela)
  const hues = Array.from({ length: 24 }, (_, i) => hslToHex((i * 360) / 24, 65, 45))
  const neutrals = ['#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF']
  return [...neutrals, ...hues]
}

const PALETTE = buildPalette()

const NEUTRAL_COLOR_COUNT = 6 // prvih 6 nijansi su neutralne; sve ostalo spada u "accent"

const mapStyleIndexToUnreal = (
  index: number,
  totalForType: number,
): number => {
  if (totalForType <= 0) return STYLE_ID_RANGE.max

  const safeIndex = Math.max(0, Math.min(index, totalForType - 1))

  if (safeIndex === totalForType - 1) {
    return STYLE_ID_RANGE.max
  }

  const relativeId = Math.min(safeIndex, STYLE_ID_RANGE.max - 1)

  // Ako ikada dobijemo više od 11 stilova po tipu, morat ćemo dogovoriti novu mapu.
  // Za sada jednostavno mapiramo 0 → 0, 1 → 1, ... unutar raspona.
  return STYLE_ID_RANGE.min + relativeId
}

const mapColorIndexToUnreal = (index: number): number => {
  const safeIndex = Math.max(0, Math.min(index, PALETTE.length - 1))
  return safeIndex < NEUTRAL_COLOR_COUNT ? COLOR_ID_RANGE.min : COLOR_ID_RANGE.max
}

const STYLE_KEY_BY_TYPE: Record<ExtraType, keyof typeof EXTRA_KEYS> = {
  Glasses: 'glassesStyleIndex',
  Earrings: 'earringsStyleIndex',
  Hats: 'hatsStyleIndex',
}

const COLOR_KEY_BY_TYPE: Record<ExtraType, keyof typeof EXTRA_KEYS> = {
  Glasses: 'glassesColorIndex',
  Earrings: 'earringsColorIndex',
  Hats: 'hatsColorIndex',
}

const PACKED_KEY_BY_TYPE: Record<ExtraType, keyof typeof EXTRA_KEYS> = {
  Glasses: 'glassesColorPacked',
  Earrings: 'earringsColorPacked',
  Hats: 'hatsColorPacked',
}

export default function ExtrasAccordion() {
  const {
    currentAvatar,
    updateQuickModeMeasurement,
    updateQuickModeMeasurements,
  } = useAvatarConfiguration()

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

  // Učitaj spremljene vrijednosti
  const saved = (currentAvatar?.quickModeSettings?.measurements ?? {}) as Record<string, unknown>

  // aktivni tip (stack u lijevom stupcu)
  const initialTypeIndex = (() => {
    const n = toNum(saved[EXTRA_KEYS.typeIndex])
    return n != null ? Math.max(0, Math.min(n, EXTRA_TYPES.length - 1)) : 1 // default: Glasses u sredini
  })()
  const [typeIndex, setTypeIndex] = useState<number>(initialTypeIndex)
  const activeType: ExtraType = EXTRA_TYPES[typeIndex]

  // style index po tipu
  const initialStyleByType: Record<ExtraType, number> = {
    Glasses: Math.min(toNum(saved[EXTRA_KEYS.glassesStyleIndex]) ?? 0, STYLE_COUNTS.Glasses - 1),
    Earrings: Math.min(toNum(saved[EXTRA_KEYS.earringsStyleIndex]) ?? 0, STYLE_COUNTS.Earrings - 1),
    Hats: Math.min(toNum(saved[EXTRA_KEYS.hatsStyleIndex]) ?? 0, STYLE_COUNTS.Hats - 1),
  }
  const [styleByType, setStyleByType] = useState<Record<ExtraType, number>>(initialStyleByType)

  // color index po tipu (čuvamo index + šaljemo i packed hex u backend)
  const initialColorByType: Record<ExtraType, number> = {
    Glasses: Math.min(toNum(saved[EXTRA_KEYS.glassesColorIndex]) ?? 0, PALETTE.length - 1),
    Earrings: Math.min(toNum(saved[EXTRA_KEYS.earringsColorIndex]) ?? 0, PALETTE.length - 1),
    Hats: Math.min(toNum(saved[EXTRA_KEYS.hatsColorIndex]) ?? 0, PALETTE.length - 1),
  }
  const [colorByType, setColorByType] = useState<Record<ExtraType, number>>(initialColorByType)

  const [showDesktopSwatches, setShowDesktopSwatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 1024px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const media = window.matchMedia('(min-width: 1024px)')
    const update = (event: MediaQueryList | MediaQueryListEvent) => {
      setShowDesktopSwatches(event.matches)
    }

    update(media)

    if (typeof media.addEventListener === 'function') {
      const handler = (event: MediaQueryListEvent) => update(event)
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    }

    const legacyHandler = (event: MediaQueryListEvent) => update(event)
    media.addListener(legacyHandler)
    return () => media.removeListener(legacyHandler)
  }, [])

  // izvedenice za aktivni tip
  const totalForActive = STYLE_COUNTS[activeType]
  const styleIndex = styleByType[activeType]
  const colorIndex = colorByType[activeType]
  const isNoneSelected = useMemo(
    () => totalForActive > 0 && styleIndex === totalForActive - 1,
    [styleIndex, totalForActive],
  )
  const base = useMemo(() => PALETTE[colorIndex], [colorIndex])
  const leftColor = useMemo(
    () => PALETTE[(colorIndex + PALETTE.length - 1) % PALETTE.length],
    [colorIndex]
  )
  const rightColor = useMemo(
    () => PALETTE[(colorIndex + 1) % PALETTE.length],
    [colorIndex]
  )

  const sendExtrasStyle = useCallback((type: ExtraType, styleIdx: number) => {
    const typeForCommand = type.toLowerCase() as Lowercase<ExtraType>
    const id = mapStyleIndexToUnreal(styleIdx, STYLE_COUNTS[type])

    sendQueued(
      'updateExtras',
      {
        type: typeForCommand,
        id,
      },
      'extras style update',
    )
  }, [sendQueued])

  const sendExtrasColor = useCallback((colorIdx: number) => {
    const id = mapColorIndexToUnreal(colorIdx)
    sendQueued(
      'updateExtras',
      {
        type: 'color',
        id,
      },
      'extras color update',
    )
  }, [sendQueued])

  const updateMeasurementsForType = useCallback((type: ExtraType, styleIdx: number, colorIdx: number, packed: number) => {
    updateQuickModeMeasurements({
      [EXTRA_KEYS[STYLE_KEY_BY_TYPE[type]]]: styleIdx,
      [EXTRA_KEYS[COLOR_KEY_BY_TYPE[type]]]: colorIdx,
      [EXTRA_KEYS[PACKED_KEY_BY_TYPE[type]]]: packed,
    }, { section: 'quickMode.extras' })
  }, [updateQuickModeMeasurements])

  const applyTypeIndex = useCallback((nextIndex: number) => {
    const normalized = ((nextIndex % EXTRA_TYPES.length) + EXTRA_TYPES.length) % EXTRA_TYPES.length
    if (normalized === typeIndex) return

    const nextType = EXTRA_TYPES[normalized]
    setTypeIndex(normalized)
    updateQuickModeMeasurement(EXTRA_KEYS.typeIndex, normalized, { section: 'quickMode.extras' })

    const nextStyle = styleByType[nextType]
    const nextColor = colorByType[nextType]
    const nextColorHex = PALETTE[nextColor] ?? '#000000'
    const packed = nextStyle === STYLE_COUNTS[nextType] - 1 ? 0 : parseInt(nextColorHex.slice(1), 16) || 0

    sendExtrasStyle(nextType, nextStyle)
    sendExtrasColor(nextColor)
    updateMeasurementsForType(nextType, nextStyle, nextColor, packed)
  }, [
    colorByType,
    styleByType,
    typeIndex,
    updateQuickModeMeasurement,
    sendExtrasStyle,
    sendExtrasColor,
    updateMeasurementsForType,
  ])

  const applyStyleForActiveType = useCallback((nextIndex: number) => {
    const total = STYLE_COUNTS[activeType]
    if (total <= 0) return

    const normalized = ((nextIndex % total) + total) % total
    if (normalized === styleByType[activeType]) return

    setStyleByType(prev => ({ ...prev, [activeType]: normalized }))

    const activeColorHex = PALETTE[colorByType[activeType]] ?? '#000000'
    const packed = normalized === total - 1 ? 0 : parseInt(activeColorHex.slice(1), 16) || 0

    sendExtrasStyle(activeType, normalized)
    sendExtrasColor(colorByType[activeType])
    updateQuickModeMeasurements({
      [EXTRA_KEYS[STYLE_KEY_BY_TYPE[activeType]]]: normalized,
      [EXTRA_KEYS[PACKED_KEY_BY_TYPE[activeType]]]: packed,
    }, { section: 'quickMode.extras' })
  }, [
    activeType,
    colorByType,
    sendExtrasColor,
    sendExtrasStyle,
    styleByType,
    updateQuickModeMeasurements,
  ])

  const applyColorForActiveType = useCallback((nextIndex: number) => {
    const total = PALETTE.length
    if (total === 0) return

    const normalized = ((nextIndex % total) + total) % total
    if (normalized === colorByType[activeType]) return

    setColorByType(prev => ({ ...prev, [activeType]: normalized }))

    const nextHex = PALETTE[normalized] ?? '#000000'
    const packed = isNoneSelected ? 0 : parseInt(nextHex.slice(1), 16) || 0

    sendExtrasStyle(activeType, styleByType[activeType])
    sendExtrasColor(normalized)
    updateQuickModeMeasurements({
      [EXTRA_KEYS[COLOR_KEY_BY_TYPE[activeType]]]: normalized,
      [EXTRA_KEYS[PACKED_KEY_BY_TYPE[activeType]]]: packed,
    }, { section: 'quickMode.extras' })
  }, [
    activeType,
    colorByType,
    isNoneSelected,
    sendExtrasColor,
    sendExtrasStyle,
    styleByType,
    updateQuickModeMeasurements,
  ])

  // UI helpers
  const shiftType = (dir: 1 | -1) => applyTypeIndex(typeIndex + dir)

  const prevStyle = () => applyStyleForActiveType(styleIndex - 1)
  const nextStyle = () => applyStyleForActiveType(styleIndex + 1)

  const prevColor = useCallback(() => {
    applyColorForActiveType(colorIndex - 1)
  }, [applyColorForActiveType, colorIndex])

  const nextColor = useCallback(() => {
    applyColorForActiveType(colorIndex + 1)
  }, [applyColorForActiveType, colorIndex])

  const initialSyncRef = useRef(false)

  useEffect(() => {
    if (initialSyncRef.current) return
    initialSyncRef.current = true
    sendExtrasStyle(activeType, styleIndex)
    sendExtrasColor(colorIndex)
  }, [activeType, styleIndex, colorIndex, sendExtrasStyle, sendExtrasColor])

  // --- Render ---
  const at = (offset: number) => EXTRA_TYPES[(typeIndex + offset + EXTRA_TYPES.length) % EXTRA_TYPES.length]
  const leftIdx = (styleIndex + totalForActive - 1) % totalForActive
  const rightIdx = (styleIndex + 1) % totalForActive

  return (
    <div className={styles.container}>
      {/* Left: stack tipova */}
      <div className={styles.left}>
        <button
          type="button"
          className={`${styles.vArrow} ${styles.up}`}
          onClick={() => shiftType(-1)}
          aria-label="Previous"
        >
          <img src={ArrowUp} alt="Up" />
        </button>

        <div className={styles.stack}>
          <div className={`${styles.stackItem} ${styles.small}`} style={{ opacity: 0.6 }}>{at(-1)}</div>
          <div className={`${styles.stackItem} ${styles.big}`}>{at(0)}</div>
          <div className={`${styles.stackItem} ${styles.small}`} style={{ opacity: 0.6 }}>{at(1)}</div>
        </div>

        <button
          type="button"
          className={`${styles.vArrow} ${styles.down}`}
          onClick={() => shiftType(1)}
          aria-label="Next"
        >
          <img src={ArrowDown} alt="Down" />
        </button>
      </div>

      {/* Center: carousel stilova za aktivni tip (placeholder SVG) */}
      <div className={styles.center}>
        <div className={styles.centerInner}>
          <button type="button" className={styles.hArrow} onClick={prevStyle} aria-label="Prev style">
            <img src={ArrowLeft} alt="Prev" />
          </button>

          <div className={styles.centerStrip}>
            <div className={styles.thumbSmall} title={`${activeType} ${leftIdx + 1}`}>
              <GlassesBig className={styles.glassesSmallIcon} style={{ color: leftColor }} />
            </div>

            <div className={styles.thumbBig} title={`${activeType} ${styleIndex + 1}`}>
              <GlassesBig className={styles.glassesBigIcon} style={{ color: base }} />
              <div className={styles.glassesIndex}>{styleIndex + 1}</div>
            </div>

            <div className={styles.thumbSmall} title={`${activeType} ${rightIdx + 1}`}>
              <GlassesBig className={styles.glassesSmallIcon} style={{ color: rightColor }} />
            </div>
          </div>

          <button type="button" className={styles.hArrow} onClick={nextStyle} aria-label="Next style">
            <img src={ArrowRight} alt="Next" />
          </button>
        </div>
      </div>

      {/* Right: color “swatches” za aktivni tip */}
      <div className={styles.right}>
        <div className={styles.colorPicker}>
          <button type="button" className={styles.vArrow} onClick={prevColor} aria-label="Prev color">
            <img src={ArrowUp} alt="Up" />
          </button>


          {/* MOBILE: jedan swatch 40x40 */}
          <div className={styles.colorPreview}>
            <Skin1Icon className={styles.previewIcon} style={{ color: base }} />
          </div>

          {/* DESKTOP: tri swatcha (40,50,40) */}
          {showDesktopSwatches && (
            <TriToneSelector
              className={styles.colorSwatches}
              icons={[Skin1Icon, Skin1Icon, Skin1Icon]}
              colors={[leftColor, base, rightColor]}
              orientation="vertical"
              interactive={false}
              buttonClassName={styles.swatch}
              buttonClassNames={[styles.swatchSide, styles.swatchCenter, styles.swatchSide]}
              iconClassName={styles.previewIcon}
            />
          )}

          <button type="button" className={styles.vArrow} onClick={nextColor} aria-label="Next color">
            <img src={ArrowDown} alt="Down" />
          </button>
        </div>
      </div>
    </div>
  )
}