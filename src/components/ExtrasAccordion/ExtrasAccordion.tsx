import { useMemo, useState } from 'react'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import GlassesBig from '../../assets/glasses-b.svg?react'
import Skin1Icon from '../../assets/skin1.svg?react'
import styles from './ExtrasAccordion.module.scss'

const EXTRAS = ['Earrings', 'Glasses', 'Hats'] as const

const GLASSES_COLORS = [
  '#000000',
  '#111111',
  '#1E1E1E',
  '#434343',
  '#555555',
  '#666666',
  '#777777', 
  '#888888',
  '#FFFFFF',
  '#F5F5F5', 
  '#EFEFEF',
  '#B8B8B8',
  '#C0C0C0',
  '#D0D0D0',
  '#E0E0E0',
  '#2C3539',
  '#3A4549',
  '#4A5559',
  '#B8870B',
  '#D4AF37',
  '#E6C55F',
  '#B76E79',
  '#C5837F',
  '#D9A6A6',
  '#5A381F',
  '#7A4A25',
  '#8B4513',
  '#A65A2E',
  '#C0703A',
  '#4B2E21',
  '#5C3A27',
  '#704628',
  '#8B5A2B',
  '#A86F3A',
  '#0B2C4D',
  '#123A63',
  '#1B4D7F',
  '#0F3B21',
  '#14522C',
  '#1C6B39',
  '#4A0E23',
  '#611630',
  '#7A1E3D',
]

export default function ExtrasAccordion() {
  // Left stack state
  const [centerIdx, setCenterIdx] = useState(1) // default to Glasses in middle
  const at = (offset: number) => EXTRAS[(centerIdx + offset + EXTRAS.length) % EXTRAS.length]

  // Right color state (tints the glasses icons in center panel)
  const [colorIndex, setColorIndex] = useState(0)
  const base = useMemo(() => GLASSES_COLORS[colorIndex], [colorIndex])
  // Umjesto light/dark izvedenica, lijeva i desna ikona imaju vlastite, susjedne boje iz palete
  const leftColor = useMemo(
    () => GLASSES_COLORS[(colorIndex + GLASSES_COLORS.length - 1) % GLASSES_COLORS.length],
    [colorIndex]
  )
  const rightColor = useMemo(
    () => GLASSES_COLORS[(colorIndex + 1) % GLASSES_COLORS.length],
    [colorIndex]
  )
  const prevColor = () => {
    setColorIndex((i) => (i + GLASSES_COLORS.length - 1) % GLASSES_COLORS.length)
    setGlassesIndex((n) => (n - 1 + TOTAL_GLASSES) % TOTAL_GLASSES)
  }
  const nextColor = () => {
    setColorIndex((i) => (i + 1) % GLASSES_COLORS.length)
    setGlassesIndex((n) => (n + 1) % TOTAL_GLASSES)
  }

  // Center carousel index for glasses styles
  const TOTAL_GLASSES = 5
  const [glassesIndex, setGlassesIndex] = useState(0)
  const prevStyle = () => setGlassesIndex((n) => (n - 1 + TOTAL_GLASSES) % TOTAL_GLASSES)
  const nextStyle = () => setGlassesIndex((n) => (n + 1) % TOTAL_GLASSES)

  return (
    <div className={styles.container}>
      {/* Left: like BodyAccordion left but 80x120, stack 51x47 with three rows */}
      <div className={styles.left}>
        <button type="button" className={`${styles.vArrow} ${styles.up}`} onClick={() => setCenterIdx((i) => (i + EXTRAS.length - 1) % EXTRAS.length)} aria-label="Previous">
          <img src={ArrowUp} alt="Up" />
        </button>
        <div className={styles.stack}>
          <div className={`${styles.stackItem} ${styles.small}`} style={{ opacity: 0.6 }}>{at(-1)}</div>
          <div className={`${styles.stackItem} ${styles.big}`}>{at(0)}</div>
          <div className={`${styles.stackItem} ${styles.small}`} style={{ opacity: 0.6 }}>{at(1)}</div>
        </div>
        <button type="button" className={`${styles.vArrow} ${styles.down}`} onClick={() => setCenterIdx((i) => (i + 1) % EXTRAS.length)} aria-label="Next">
          <img src={ArrowDown} alt="Down" />
        </button>
      </div>

      {/* Center: 270x120, inner 230x32.8 with horizontal arrows and three icons */}
      <div className={styles.center}>
        <div className={styles.centerInner}>
          <button type="button" className={styles.hArrow} onClick={prevStyle} aria-label="Prev style">
            <img src={ArrowUp} alt="Prev" />
          </button>

          <div className={styles.centerStrip}>
            {/* Side thumbnails 46.8 x 46.8 use the big colorizable SVG scaled down; center is 78x78 with big svg icon + index */}
            <div className={styles.thumbSmall}>
              <GlassesBig className={styles.glassesSmallIcon} style={{ color: leftColor }} />
            </div>

            <div className={styles.thumbBig}>
              <GlassesBig className={styles.glassesBigIcon} style={{ color: base }} />
              <div className={styles.glassesIndex}>{(glassesIndex % TOTAL_GLASSES) + 1}</div>
            </div>

            <div className={styles.thumbSmall}>
              <GlassesBig className={styles.glassesSmallIcon} style={{ color: rightColor }} />
            </div>
          </div>

          <button type="button" className={styles.hArrow} onClick={nextStyle} aria-label="Next style">
            <img src={ArrowDown} alt="Next" />
          </button>
        </div>
      </div>

      {/* Right: color picker same as Hair right */}
      <div className={styles.right}>
        <div className={styles.colorPicker}>
          <button type="button" className={styles.vArrow} onClick={prevColor} aria-label="Darker">
            <img src={ArrowUp} alt="Up" />
          </button>

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

          <button type="button" className={styles.vArrow} onClick={nextColor} aria-label="Lighter">
            <img src={ArrowDown} alt="Down" />
          </button>
        </div>
      </div>
    </div>
  )
}
