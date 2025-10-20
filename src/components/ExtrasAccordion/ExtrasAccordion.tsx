import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import GlassesBig from '../../assets/glasses-b.svg?react' // placeholder i za ostale tipove
import Skin1Icon from '../../assets/skin1.svg?react'
import styles from './ExtrasAccordion.module.scss'

import { useAvatarApi } from '../../services/avatarApi'
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useQueuedUnreal } from '../../services/queuedUnreal'
import { getAvatarDisplayName } from '../../utils/avatarName'

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

export default function ExtrasAccordion() {
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

  // izvedenice za aktivni tip
  const totalForActive = STYLE_COUNTS[activeType]
  const styleIndex = styleByType[activeType]
  const colorIndex = colorByType[activeType]
  const unrealStyleId = useMemo(
    () => mapStyleIndexToUnreal(styleIndex, totalForActive),
    [styleIndex, totalForActive],
  )
  const unrealColorId = useMemo(
    () => mapColorIndexToUnreal(colorIndex),
    [colorIndex],
  )
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

  // UI helpers
  const shiftType = (dir: 1 | -1) =>
    setTypeIndex(i => (i + dir + EXTRA_TYPES.length) % EXTRA_TYPES.length)

  const prevStyle = () =>
    setStyleByType(prev => ({ ...prev, [activeType]: (styleIndex + totalForActive - 1) % totalForActive }))
  const nextStyle = () =>
    setStyleByType(prev => ({ ...prev, [activeType]: (styleIndex + 1) % totalForActive }))

  const prevColor = () =>
    setColorByType(prev => ({ ...prev, [activeType]: (colorIndex + PALETTE.length - 1) % PALETTE.length }))
  const nextColor = () =>
    setColorByType(prev => ({ ...prev, [activeType]: (colorIndex + 1) % PALETTE.length }))

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
            ...pending, // samo brojevi!
          },
        },
      })
    } catch (err) {
      console.error('Saving extras settings failed', err)
    }
  }, [currentAvatar, updateAvatarMeasurements])

  const scheduleSave = useCallback((patch: Record<string, number>) => {
    batchRef.current = { ...batchRef.current, ...patch }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(flushSave, 500)
  }, [flushSave])

  // helper za packed boju (0xRRGGBB)
  const colorPacked = useMemo(
    () => (isNoneSelected ? 0 : parseInt(base.slice(1), 16) || 0),
    [base, isNoneSelected],
  )

  // --- Slanje u Unreal (queued) ---
  const pushToUnreal = useCallback(() => {
    // pošalji aktivni item; UE neka odluči kako mijenja ostale
    sendQueued(
      'updateExtras',
      {
        type: activeType.toLowerCase(), // 'glasses' | 'earrings' | 'hats'
        styleIndex: unrealStyleId,
        colorIndex: unrealColorId,
        color: base,         // hex za UE
        colorPacked,         // pogodnije za materijale ako treba broj
      },
      'extras update'
    )
  }, [activeType, unrealStyleId, unrealColorId, base, colorPacked, sendQueued])

  // Svaka promjena (tip, stil, boja) -> UE + backend (debounce)
  useEffect(() => {
    // spremi koji je tip aktivan (da UI može vratiti kontekst po reloadu)
    scheduleSave({ [EXTRA_KEYS.typeIndex]: typeIndex })

    // spremi/stisni per-tip vrijednosti
    const patches: Record<string, number> = {
      // style
      [EXTRA_KEYS.glassesStyleIndex]: styleByType.Glasses,
      [EXTRA_KEYS.earringsStyleIndex]: styleByType.Earrings,
      [EXTRA_KEYS.hatsStyleIndex]: styleByType.Hats,
      // color index
      [EXTRA_KEYS.glassesColorIndex]: colorByType.Glasses,
      [EXTRA_KEYS.earringsColorIndex]: colorByType.Earrings,
      [EXTRA_KEYS.hatsColorIndex]: colorByType.Hats,
    }

    // packed boje – samo za aktivni tip ovdje (možeš i za sva tri, ali nije nužno)
    if (activeType === 'Glasses') patches[EXTRA_KEYS.glassesColorPacked] = colorPacked
    if (activeType === 'Earrings') patches[EXTRA_KEYS.earringsColorPacked] = colorPacked
    if (activeType === 'Hats') patches[EXTRA_KEYS.hatsColorPacked] = colorPacked

    scheduleSave(patches)
    pushToUnreal()
  }, [
    typeIndex,
    styleByType, colorByType,
    activeType, colorPacked,
    scheduleSave, pushToUnreal,
  ])

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
          <div className={styles.colorSwatches}>
            <div className={`${styles.swatch} ${styles.swatchSide}`}>
              <Skin1Icon className={styles.previewIcon} style={{ color: leftColor }} />
            </div>
            <div className={`${styles.swatch} ${styles.swatchCenter}`}>
              <Skin1Icon className={styles.previewIcon} style={{ color: base }} />
            </div>
            <div className={`${styles.swatch} ${styles.swatchSide}`}>
              <Skin1Icon className={styles.previewIcon} style={{ color: rightColor }} />
            </div>
          </div>

          <button type="button" className={styles.vArrow} onClick={nextColor} aria-label="Next color">
            <img src={ArrowDown} alt="Down" />
          </button>
        </div>
      </div>
    </div>
  )
}
