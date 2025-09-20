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
  const [pos, setPos] = useState<number>(0) // updated to center on mount
  const [isVertical, setIsVertical] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)

  // Center the thumb based on the real rendered width of the bar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const updateOrientation = () => setIsVertical(mediaQuery.matches)
    updateOrientation()
    mediaQuery.addEventListener('change', updateOrientation)
    return () => mediaQuery.removeEventListener('change', updateOrientation)
  }, [])

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const setCenter = () => {
      const length = isVertical ? bar.offsetHeight : bar.offsetWidth
      setPos(length / 2)
    }
    setCenter()
    const ro = new ResizeObserver(setCenter)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [isVertical])

  const onStartDrag = (startEvent: PointerEvent) => {
    const bar = barRef.current
    if (!bar) return
    startEvent.preventDefault()
    const rect = bar.getBoundingClientRect()
    const update = (clientX: number, clientY: number) => {
      const length = isVertical ? rect.height : rect.width
      const raw = isVertical ? clientY - rect.top : clientX - rect.left
      const clamped = Math.max(0, Math.min(length, raw))
      setPos(clamped)
    }
    update(startEvent.clientX, startEvent.clientY)
    const onMove = (e: PointerEvent) => {
      update(e.clientX, e.clientY)
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
          <div className={styles.frameTop} />

          <div className={styles.toneBarGroup}>
            <div className={styles.toneBar} ref={barRef}>
              <button
                type="button"
                className={styles.thumb}
                style={isVertical ? { top: `${pos}px`, left: '50%' } : { left: `${pos}px` }}
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
