import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ArrowRight from '../../assets/arrow-right.svg'
import { morphAttributes } from '../../data/morphAttributes';
import type { MorphAttribute } from '../../data/morphAttributes';
import styles from './BodyAccordion.module.scss'


export interface BodyAccordionProps {
  updateMorph?: (morphId: number, morphName: string, value: number) => void
}


export default function BodyAccordion({ updateMorph }: BodyAccordionProps) {
  // Categories grouped for body editing; values wiring will come later
  const categories = useMemo(
    () => [
      { key: 'Waist', label: 'Waist' },
      { key: 'Hips', label: 'Hips' },
      { key: 'Arms', label: 'Arms' },
      { key: 'Hand', label: 'Hand' },
      { key: 'Chest', label: 'Chest' },
      { key: 'Neck', label: 'Neck' },
      { key: 'Head', label: 'Head' },
      { key: 'Legs', label: 'Legs' },
      { key: 'Torso', label: 'Torso' },
      { key: 'Base', label: 'Base' },
    ],
    []
  )

  const [centerIdx, setCenterIdx] = useState<number>(2) // default to 'Chest' (index 2)

  const at = (offset: number) => {
    const n = categories.length
    let i = (centerIdx + offset) % n
    if (i < 0) i += n
    return categories[i]
  }

  const handleUp = () => setCenterIdx((i) => (i - 1 + categories.length) % categories.length)
  const handleDown = () => setCenterIdx((i) => (i + 1) % categories.length)

  // Prikaz svih atributa iz morphAttributes za odabranu kategoriju
  const selected = at(0)
  const list: MorphAttribute[] = useMemo(
    () => morphAttributes.filter(attr => attr.category === selected.label),
    [selected.label]
  )
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  // Track viewport size to switch behavior at the desktop breakpoint
  const [isLarge, setIsLarge] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1440px)')
    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    setIsLarge(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ----- Mobile (default) list slicing logic -----
  const VISIBLE = 5
  const [scrollIndex, setScrollIndex] = useState(0)
  const total = list.length
  const visibleCount = Math.min(VISIBLE, total)
  const maxScroll = Math.max(0, total - VISIBLE)

  const onWheel = (e: React.WheelEvent) => {
    if (isLarge) return
    if (draggingRef.current) return
    if (!maxScroll) return
    const dir = e.deltaY > 0 ? 1 : -1
    setScrollIndex((i) => clamp(i + dir, 0, maxScroll))
  }

  useEffect(() => {
    if (isLarge) return
    setScrollIndex(0)
  }, [selected.label, isLarge])
  useEffect(() => {
    if (isLarge) return
    setScrollIndex((i) => clamp(i, 0, Math.max(0, (list.length || 0) - VISIBLE)))
  }, [list.length, isLarge])

  // ----- Desktop scroll tracking -----
  const [scrollTop, setScrollTop] = useState(0)
  const [clientH, setClientH] = useState(0)
  const [scrollH, setScrollH] = useState(0)
  const [trackH, setTrackH] = useState(0)

  const updateMetrics = () => {
    const el = rowsRef.current
    const track = trackRef.current
    if (el) {
      setClientH(el.clientHeight)
      setScrollH(el.scrollHeight)
      setScrollTop(el.scrollTop)
    }
    if (track) setTrackH(track.clientHeight)
  }

  useLayoutEffect(() => {
    if (!isLarge) return
    updateMetrics()
    window.addEventListener('resize', updateMetrics)
    return () => window.removeEventListener('resize', updateMetrics)
  }, [isLarge, list.length])

  const onScroll = () => {
    if (!isLarge) return
    const el = rowsRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
  }

  const onTrackStart = (clientY: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    draggingRef.current = true

    if (isLarge) {
      const el = rowsRef.current
      if (!el || scrollH <= clientH) return
      const update = (y: number) => {
        const rel = y - rect.top
        const pct = clamp(rel / trackH, 0, 1)
        const newTop = pct * (scrollH - clientH)
        el.scrollTop = newTop
        setScrollTop(newTop)
      }
      update(clientY)
      const move = (e: PointerEvent) => update(e.clientY)
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        draggingRef.current = false
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    } else {
      if (!maxScroll) return
      const update = (y: number) => {
        const rel = y - rect.top
        const pct = clamp(rel / 130, 0, 1)
        setScrollIndex(Math.round(pct * maxScroll))
      }
      update(clientY)
      const move = (e: PointerEvent) => update(e.clientY)
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        draggingRef.current = false
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }

  const scrollable = isLarge && scrollH > clientH
  let fillH = 0
  let fillTop = 0
  if (isLarge) {
    fillH = scrollable && trackH > 0 ? (clientH / scrollH) * trackH : trackH
    fillTop = scrollable && trackH > 0
      ? (scrollTop / (scrollH - clientH)) * (trackH - fillH)
      : 0
  } else {
    const trackSmall = 130
    fillH = total > 0 ? (visibleCount / total) * trackSmall : 0
    fillTop = total > visibleCount && maxScroll > 0
      ? (scrollIndex / maxScroll) * (trackSmall - fillH)
      : 0
  }
  const view = isLarge ? list : list.slice(scrollIndex, scrollIndex + VISIBLE)
  // Slider row component
  // Function to convert slider percentage into morph value

  function sliderToMorphValue(pct: number, min: number, max: number): number {
    return min + (pct / 100) * (max - min)
  }


  function SliderRow({ attr }: { attr: MorphAttribute }) {
    // Always show thumb and value, start centered at 50%
    const barRef = useRef<HTMLDivElement | null>(null);
    const [val, setVal] = useState(50);
    const [barWidth, setBarWidth] = useState(0);
    useLayoutEffect(() => {
      setBarWidth(barRef.current?.clientWidth ?? 0);
    }, []);
    // Reset slider to midpoint when attribute changes
    useEffect(() => {
      setVal(50);
    }, [attr.morphId]);
    const onStart = (clientX: number) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      draggingRef.current = true;
      const update = (x: number) => {
        const rel = x - rect.left
        const width = rect.width
        const pct = clamp(Math.round((rel / width) * 100), 0, 100)
        setVal(pct)
        updateMorph?.(
          attr.morphId,
          attr.morphName,
          sliderToMorphValue(pct, attr.min, attr.max)
        )
      }
      update(clientX);
      const move = (e: PointerEvent) => update(e.clientX);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        draggingRef.current = false;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    const leftPx = (val / 100) * barWidth;
    return (
      <div className={styles.row}>
        <div className={styles.rowLabel} title={attr.labelName}>{attr.labelName}</div>
        <div className={styles.sliderGroup}>
          <div className={styles.sliderBar} ref={barRef} onPointerDown={(e) => onStart(e.clientX)}>
            <button
              type="button"
              className={styles.sliderThumb}
              style={{ left: `${leftPx}px` }}
              aria-label={`Adjust ${attr.labelName}`}
              tabIndex={0}
              onPointerDown={(e) => { e.stopPropagation(); onStart(e.clientX); }}
            />
          </div>
        </div>
        <div className={styles.rowPct}>{Math.round(val)}%</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left selector */}
      <div className={styles.leftSection}>
        <div className={styles.left}>
          <button
            type="button"
            className={`${styles.arrowBtn} ${styles.arrowUp}`}
            onClick={handleUp}
            aria-label="Previous"
         >
            <img src={ArrowRight} alt="Up" />
          </button>

          <div className={styles.stack}>
            <div className={`${styles.item} ${styles.topSmall}`} title={at(-2).label}>{at(-2).label}</div>
            <div className={`${styles.item} ${styles.upper}`} title={at(-1).label}>{at(-1).label}</div>
            <div className={`${styles.item} ${styles.selected}`} title={at(0).label}>{at(0).label}</div>
            <div className={`${styles.item} ${styles.lower}`} title={at(1).label}>{at(1).label}</div>
            <div className={`${styles.item} ${styles.bottomSmall}`} title={at(2).label}>{at(2).label}</div>
          </div>
          <button
            type="button"
            className={`${styles.arrowBtn} ${styles.arrowDown}`}
            onClick={handleDown}
            aria-label="Next"
          >
            <img src={ArrowRight} alt="Down" />
          </button>
        </div>
      </div>

      {/* Right panel 350x171 (content depends on selected category) */}
      <div
        className={`${styles.right} ${scrollable ? styles.scrollable : ''}`}
        onWheel={isLarge ? undefined : onWheel}
      >
        <div className={styles.rightInner}>
          <div
            className={styles.rows}
            ref={rowsRef}
            onScroll={isLarge ? onScroll : undefined}
          >
            {view.map((attr, i) => (
              <SliderRow key={`${attr.morphId}-${i}`} attr={attr} />
            ))}
          </div>
        </div>
        <div
          className={styles.vTrack}
          ref={trackRef}
          onPointerDown={(e) => onTrackStart(e.clientY)}
        >
          <div className={styles.vBar} />
          <div
            className={styles.vFill}
            style={{ top: `${fillTop}px`, height: `${fillH}px` }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onTrackStart(e.clientY)
            }}
          />
        </div>
      </div>
    </div>
  )
}