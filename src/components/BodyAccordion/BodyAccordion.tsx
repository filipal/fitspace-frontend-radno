import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ArrowRight from '../../assets/arrow-right.svg'
import { morphAttributes } from '../../data/morphAttributes';
import type { MorphAttribute } from '../../data/morphAttributes';
import styles from './BodyAccordion.module.scss'

import type { BasicMeasurements, BodyMeasurements } from '../../context/AvatarConfigurationContext';
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext';

export type Avatar = {
  avatarId: string;
  avatarName?: string;
  gender?: string;     // ili 'male' | 'female'
  ageRange?: string;
  morphValues?: { morphId: number; value: number }[];
  basicMeasurements?: Partial<BasicMeasurements> | null;
  bodyMeasurements?: Partial<BodyMeasurements> | null;
};

const EMPTY_MORPH_VALUES: { morphId: number; value: number }[] = []

export interface BodyAccordionProps {
  avatar: Avatar | null; // ⬅️ BodyAccordion sada prima avatar kroz prop
  updateMorph?: (morphId: number, morphName: string, percentage: number) => void
}

export default function BodyAccordion({ avatar, updateMorph }: BodyAccordionProps) {
  const { updateMorphValue } = useAvatarConfiguration()

  const emitMorphChange = useCallback((morphId: number, morphName: string, percent: number) => {
    if (updateMorph) {
      updateMorph(morphId, morphName, percent)
      return
    }

    updateMorphValue(morphId, percent)
  }, [updateMorph, updateMorphValue])

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
  const activeSliderRef = useRef<number | null>(null)
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  // Track viewport size to switch behavior at the ≥1024px breakpoint
  const [isLarge, setIsLarge] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
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
  // Mobile: prikaži cijeli popis i oslanjaj se na nativni scroll (.rows overflow-y: auto)
  const view = list

  // Slider row component
  const morphValueMap = useMemo(() => {
    const map = new Map<number, number>()
    const morphValues = avatar?.morphValues ?? EMPTY_MORPH_VALUES
    for (const morph of morphValues) {
      const numeric =
        typeof morph.value === 'number' && Number.isFinite(morph.value)
          ? morph.value
          : 50
      map.set(morph.morphId, numeric)
    }
    return map
  }, [avatar?.morphValues])

  function SliderRow({ attr }: { attr: MorphAttribute }) {
    const barRef = useRef<HTMLDivElement | null>(null)
    const morphValue = morphValueMap.get(attr.morphId) ?? 50

    const [val, setVal] = useState(morphValue)
    const [barWidth, setBarWidth] = useState(0)
    const lastEmittedRef = useRef(morphValue)
    const pointerOffsetRef = useRef(0)

    useLayoutEffect(() => {
      setBarWidth(barRef.current?.clientWidth ?? 0)
    }, [])

    useLayoutEffect(() => {
      if (activeSliderRef.current === attr.morphId) return
      lastEmittedRef.current = morphValue
      setVal(prev => (prev === morphValue ? prev : morphValue))
    }, [attr.morphId, morphValue])

    const onStart = (event: PointerEvent, fromThumb: boolean) => {
      const bar = barRef.current;
      if (!bar) return;

      event.preventDefault();

      const rect = bar.getBoundingClientRect();
      draggingRef.current = true;
      activeSliderRef.current = attr.morphId;

      const barWidthPx = rect.width;
      const currentPx = (val / 100) * barWidthPx;
      const pointerPx = event.clientX - rect.left;
      pointerOffsetRef.current = fromThumb ? pointerPx - currentPx : 0;

      const clearSelection = () => {
        if (typeof window === 'undefined') return;
        const selection = window.getSelection();
        if (!selection) return;
        if (selection.type !== 'None') selection.removeAllRanges();
      };

      const update = (x: number) => {
        const rel = x - rect.left - pointerOffsetRef.current;
        const width = rect.width;
        const pct = clamp(Math.round((rel / width) * 100), 0, 100);
        setVal(pct);

        if (pct !== lastEmittedRef.current) {
          lastEmittedRef.current = pct;
          emitMorphChange(attr.morphId, attr.morphName, pct);
        }

        clearSelection();
      };

      const move = (e: PointerEvent) => {
        e.preventDefault();
        update(e.clientX);
      };

      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        draggingRef.current = false;
        activeSliderRef.current = null;
        pointerOffsetRef.current = 0;
      };

      clearSelection();
      update(event.clientX);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', stop, { passive: false });
      window.addEventListener('pointercancel', stop, { passive: false });
    };

    const leftPx = (val / 100) * barWidth;

    return (
      <div className={styles.row}>
        <div className={styles.rowLabel} title={attr.labelName}>{attr.labelName}</div>
        <div className={styles.sliderGroup}>
          <div
            className={styles.sliderBar}
            ref={barRef}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStart(e.nativeEvent, false);
            }}
          >
            <button
              type="button"
              className={styles.sliderThumb}
              style={{ left: `${leftPx}px` }}
              aria-label={`Adjust ${attr.labelName}`}
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStart(e.nativeEvent, true);
              }}
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