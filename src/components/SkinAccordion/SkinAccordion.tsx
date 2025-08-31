import { useEffect, useRef, useState } from 'react'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import Skin1 from '../../assets/skin1.svg?react'
import Skin2 from '../../assets/skin2.svg?react'
import Skin3 from '../../assets/skin3.svg?react'
import { darkenHex, lightenHex } from '../../utils/color'
import styles from './SkinAccordion.module.scss'

interface SkinAccordionProps {
  defaultRightExpanded?: boolean
}

export default function SkinAccordion({
  defaultRightExpanded = false,
}: SkinAccordionProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null) // null => show two; number => show one
  const [rightExpanded, setRightExpanded] = useState(defaultRightExpanded)

  const basePalette = ['#f5e0d0', '#eac3a6', '#d7a381', '#b47b57', '#8a573b', '#5d3b2a']
  const [baseIndex, setBaseIndex] = useState(2)

  const items = [Skin1, Skin2, Skin3]
  const base = basePalette[baseIndex]
  const light = lightenHex(base)
  const dark = darkenHex(base)

  const handlePrev = () => {
    if (focusedIndex !== null) {
      setFocusedIndex((focusedIndex + items.length - 1) % items.length)
    }
    setBaseIndex((baseIndex + basePalette.length - 1) % basePalette.length)
  }

  const handleNext = () => {
    if (focusedIndex !== null) {
      setFocusedIndex((focusedIndex + 1) % items.length)
    }
    setBaseIndex((baseIndex + 1) % basePalette.length)
  }

  // Right-side drag bar state
  const [pos, setPos] = useState<number>(65) // will be updated to actual bar center on mount
  const barRef = useRef<HTMLDivElement | null>(null)

  // Center the thumb based on the real rendered width of the bar
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    // initialize
    const setCenter = () => {
      const w = bar.offsetWidth
      setPos(w / 2)
    }
    setCenter()
    // keep centered if the bar resizes
    const ro = new ResizeObserver(setCenter)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  const onStartDrag = (clientX: number) => {
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const update = (x: number) => {
      const rel = x - rect.left
      const width = rect.width
      const clamped = Math.max(0, Math.min(width, rel))
      setPos(clamped)
    }
    update(clientX)
    const onMove = (e: PointerEvent) => {
      update(e.clientX)
    }
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
              <button type="button" className={styles.iconBtn} onClick={() => setFocusedIndex(0)}>
                <Skin1 className={styles.iconSmall} style={{ color: light }} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => setFocusedIndex(1)}>
                <Skin2 className={styles.iconLarge} style={{ color: base }} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => setFocusedIndex(2)}>
                <Skin3 className={styles.iconSmall} style={{ color: dark }} />
              </button>
            </div>
          ) : (
            <div className={styles.iconOne}>
              <button type="button" className={styles.iconBtn} onClick={() => setFocusedIndex(null)}>
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
          {/* Top: 130x25 (bar 130x10 with 25x25 thumb centered vertically) */}
          <div className={styles.toneBarGroup}>
            <div className={styles.toneBar} ref={barRef}>
              <button
                type="button"
                className={styles.thumb}
                style={{ left: `${pos}px` }}
                onPointerDown={(e) => { e.stopPropagation(); onStartDrag(e.clientX) }}
                aria-label="Adjust tone"
              />
            </div>
          </div>

          {/* Gap 2px built via CSS gap */}
          {/* Bottom: 143x13 with three frame icons aligned left/center/right */}
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