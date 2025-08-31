import { useMemo, useState } from 'react'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import HairBig from '../../assets/woman-hair-beauty-b.svg?react'
import Skin1Icon from '../../assets/skin1.svg?react'
import { darkenHex, lightenHex } from '../../utils/color'
import styles from './HairAccordion.module.scss'

const HAIR_COLORS = [
  '#000000', // black
  '#3B2A1A', // dark brown
  '#5C4033', // brown
  '#8B5A2B', // light brown
  '#A0522D', // sienna
  '#C68642', // caramel
  '#D2B48C', // tan / blonde dark
  '#E6CBA8', // blonde
  '#F1E3B1', // light blonde
  '#6B4E71', // plum brown
  '#4B5320', // dark olive (dyed)
]

export default function HairAccordion() {
  const [colorIndex, setColorIndex] = useState(2)

  const base = useMemo(() => HAIR_COLORS[colorIndex], [colorIndex])
  const light = useMemo(() => lightenHex(base), [base])
  const dark = useMemo(() => darkenHex(base), [base])

  const prevColor = () => setColorIndex((i) => (i + HAIR_COLORS.length - 1) % HAIR_COLORS.length)
  const nextColor = () => setColorIndex((i) => (i + 1) % HAIR_COLORS.length)

  // Left arrow carousel handlers (could be wired later to change styles)
  const prevStyle = () => {/* placeholder for cycling hair style left */}
  const nextStyle = () => {/* placeholder for cycling hair style right */}

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <button type="button" className={styles.hArrow} onClick={prevStyle} aria-label="Previous style">
          <img src={ArrowLeft} alt="Prev" />
        </button>

        <div className={styles.iconStrip}>
      {/* Use the big, colorizable SVG at 60x60 for the side thumbnails to ensure hair fill color changes */}
      <HairBig className={styles.iconSmall} style={{ color: light }} />
      <HairBig className={styles.iconBig} style={{ color: base }} />
      <HairBig className={styles.iconSmall} style={{ color: dark }} />
        </div>

        <button type="button" className={styles.hArrow} onClick={nextStyle} aria-label="Next style">
          <img src={ArrowRight} alt="Next" />
        </button>
      </div>
      <div className={styles.right}>
        <div className={styles.colorPicker}>
          <button type="button" className={styles.vArrow} onClick={prevColor} aria-label="Darker">
            <img src={ArrowUp} alt="Up" />
          </button>

          <Skin1Icon className={styles.previewIcon} style={{ color: base }} />

          <button type="button" className={styles.vArrow} onClick={nextColor} aria-label="Lighter">
            <img src={ArrowDown} alt="Down" />
          </button>
        </div>
      </div>
    </div>
  )
}