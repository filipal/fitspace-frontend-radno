import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import Skin1 from '../../assets/skin1.svg?react'
import Skin2 from '../../assets/skin2.svg?react'
import Skin3 from '../../assets/skin3.svg?react'
import { darkenHex, lightenHex } from '../../utils/color'
import styles from './SkinAccordion.module.scss'
import { useAvatarApi } from '../../services/avatarApi'
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useQueuedUnreal } from '../../services/queuedUnreal'
import { getAvatarDisplayName } from '../../utils/avatarName'

interface SkinAccordionProps {
  defaultRightExpanded?: boolean
}

const SKIN_KEYS = {
  baseIndex: 'skinBaseIndex',
  tonePercent: 'skinTone',
  variantIndex: 'skinVariant',
} as const

// Pomoćne funkcije za miješanje boja
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return { r: 255, g: 255, b: 255 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => n.toString(16).padStart(2, '0')
  return `#${c(Math.round(r))}${c(Math.round(g))}${c(Math.round(b))}`
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function mixHex(aHex: string, bHex: string, t: number) {
  const a = hexToRgb(aHex); const b = hexToRgb(bHex)
  return rgbToHex(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t))
}

export default function SkinAccordion({ defaultRightExpanded = false }: SkinAccordionProps) {
  const { currentAvatar } = useAvatarConfiguration()
  const { updateAvatarMeasurements } = useAvatarApi()

  const { sendFittingRoomCommand, connectionState } = usePixelStreaming();
  const simpleState = useMemo<'connected' | 'connecting' | 'disconnected'>(() => {
    return connectionState === 'connected'
      ? 'connected'
      : connectionState === 'connecting'
        ? 'connecting'
        : 'disconnected';
  }, [connectionState])

const sendQueued = useQueuedUnreal(sendFittingRoomCommand, simpleState /*, 50 */)


  // Paleta baza (svjetlije ←→ tamnije)
  const basePalette = useMemo(
    () => ['#f5e0d0', '#eac3a6', '#d7a381', '#b47b57', '#8a573b', '#5d3b2a'],
    [],
  )

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
  const items = [Skin1, Skin2, Skin3]
  const base = basePalette[baseIndex]
  const light = lightenHex(base)
  const dark = darkenHex(base)

  // BOJA ZA UNREAL (lerp između light i dark po slideru)
  const toneHex = useMemo(() => {
    const t = Math.max(0, Math.min(1, tonePct / 100))
    return mixHex(light, dark, t)
  }, [light, dark, tonePct])

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

  // --- Debounced spremanje u backend (quickModeSettings.measurements) ---
  const saveTimerRef = useRef<number | null>(null)
  const batchRef = useRef<Record<string, number>>({})

  const flushSave = useCallback(async () => {
    const pending = batchRef.current
    batchRef.current = {}

    // GUARD: avatarId mora postojati i biti string/number
    const avatarId = currentAvatar?.avatarId
    if (!avatarId) return

    // Siguran payload (fallbackovi za TS)
    const safeName = getAvatarDisplayName(currentAvatar)
    const safeAgeRange = currentAvatar?.ageRange ?? ''

    try {
      await updateAvatarMeasurements(avatarId, {
        name: safeName,
        gender: currentAvatar!.gender,
        ageRange: safeAgeRange,
        quickModeSettings: {
          // uključujemo postojeće mjere (koliko ih imamo u memoriji) + patch
          measurements: {
            ...(currentAvatar?.quickModeSettings?.measurements ?? {}),
            ...pending,
          },
        },
      })
    } catch (err) {
      console.error('Saving skin settings failed', err)
    }
  }, [currentAvatar, updateAvatarMeasurements])

  const scheduleSave = useCallback((patch: Record<string, number>) => {
    // merge u batch
    batchRef.current = { ...batchRef.current, ...patch }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(flushSave, 500)
  }, [flushSave])

  const pushToUnreal = useCallback(() => {
    // pretpostavljam da već imaš toneHex; ako nemaš, postavi ga iz base/tonePct
    sendQueued(
      'configureAvatar',
      {
        action: 'setSkin',
        baseIndex,
        variantIndex: focusedIndex ?? 1,
        tonePercent: tonePct,
        color: toneHex,
      },
      'skin update'
    )
  }, [baseIndex, focusedIndex, tonePct, toneHex, sendQueued])

  // Svaka promjena statea šalje u UE + sprema u backend (debounce)
  useEffect(() => {
    pushToUnreal()
    // ne spremamo variant kad je null; bazu/tone spremamo uvijek
    scheduleSave({
      [SKIN_KEYS.baseIndex]: baseIndex,
      [SKIN_KEYS.tonePercent]: tonePct,
      ...(focusedIndex !== null ? { [SKIN_KEYS.variantIndex]: focusedIndex } : {}),
    })
  }, [baseIndex, tonePct, focusedIndex, pushToUnreal, scheduleSave])

  // --- Handleri za promjene UI-a + spremanje ---
  const handlePrev = () => {
    if (focusedIndex !== null) {
      const nextVar = (focusedIndex + items.length - 1) % items.length
      setFocusedIndex(nextVar)
    }
    const nextBase = (baseIndex + basePalette.length - 1) % basePalette.length
    setBaseIndex(nextBase)
  }

  const handleNext = () => {
    if (focusedIndex !== null) {
      const nextVar = (focusedIndex + 1) % items.length
      setFocusedIndex(nextVar)
    }
    const nextBase = (baseIndex + 1) % basePalette.length
    setBaseIndex(nextBase)
  }

  const onSelectIcon = (idx: number) => {
    setFocusedIndex(idx)
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
      setTonePct(pct)
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
                <Skin1 className={styles.iconSmall} style={{ color: lightenHex(basePalette[baseIndex]) }} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => onSelectIcon(1)}>
                <Skin2 className={styles.iconLarge} style={{ color: basePalette[baseIndex] }} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => onSelectIcon(2)}>
                <Skin3 className={styles.iconSmall} style={{ color: darkenHex(basePalette[baseIndex]) }} />
              </button>
            </div>
          ) : (
            <div className={styles.iconOne}>
              <button type="button" className={styles.iconBtn} onClick={() => setFocusedIndex(null)}>
                {focusedIndex === 0 && <Skin1 className={styles.iconLarge} style={{ color: lightenHex(base) }} />}
                {focusedIndex === 1 && <Skin2 className={styles.iconLarge} style={{ color: base }} />}
                {focusedIndex === 2 && <Skin3 className={styles.iconLarge} style={{ color: darkenHex(base) }} />}
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
