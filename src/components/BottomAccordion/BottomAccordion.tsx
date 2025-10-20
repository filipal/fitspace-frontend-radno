import { useState } from 'react'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import styles from './BottomAccordion.module.scss'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import BossDyn01 from '../../assets/boss-dyn01.png'
import Pants1 from '../../assets/pants-1.png'
import Pants2 from '../../assets/pants-2.png'
import Pants3 from '../../assets/pants-3.png'
import Pants4 from '../../assets/pants-4.png'
import Pants5 from '../../assets/pants-5.png'

const carouselItems: string[] = [BossDyn01, Pants1, Pants2, Pants3, Pants4, Pants5]

interface BottomAccordionProps {
  variant?: 'mobile' | 'desktop'
}

export default function BottomAccordion({ variant = 'mobile' }: BottomAccordionProps) {
  const { sendFitSpaceCommand, connectionState } = usePixelStreaming()
  const [index, setIndex] = useState(0)
  const prev = () => {
    setIndex(i => {
      const newIndex = (i + carouselItems.length - 1) % carouselItems.length
      // Send selectClothing command for bottoms (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFitSpaceCommand('selectClothing', { itemId, category: 'bottom' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=bottom`)
      }
      return newIndex
    })
  }
  const next = () => {
    setIndex(i => {
      const newIndex = (i + 1) % carouselItems.length
      // Send selectClothing command for bottoms (map to 0-2 range)  
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFitSpaceCommand('selectClothing', { itemId, category: 'bottom' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=bottom`)
      }
      return newIndex
    })
  }
  const len = carouselItems.length
  const leftIdx = (index + len - 1) % len
  const rightIdx = (index + 1) % len
  const Left = carouselItems[leftIdx]
  const Center = carouselItems[index]
  const Right = carouselItems[rightIdx]
  if (variant === 'desktop') {
    return (
      <div className={`${styles.container} ${styles.desktop}`}>
        <div className={styles.carouselRow}>
          <button type="button" className={styles.arrowBtn} onClick={prev}>
            <img src={ArrowUp} alt="Previous" />
          </button>
          <div className={styles.centerItem}>
            <img src={Center} alt="Current" />
          </div>
          <button type="button" className={styles.arrowBtn} onClick={next}>
            <img src={ArrowDown} alt="Next" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.brandBar}>Pando Moto</div>
      <div className={styles.carouselRow}>
        <button type="button" className={styles.arrowBtn} onClick={prev}>
          <img src={ArrowLeft} alt="Prev" />
        </button>
        <div className={styles.carouselInner}>
          <div className={styles.sideItem}>
            <img src={Left} alt="Prev" />
          </div>
          <div className={styles.centerItem}>
            <img src={Center} alt="Current" />
          </div>
          <div className={styles.sideItem}>
            <img src={Right} alt="Next" />
          </div>
        </div>
        <button type="button" className={styles.arrowBtn} onClick={next}>
          <img src={ArrowRight} alt="Next" />
        </button>
      </div>
      <div className={styles.productTitle}>FALCON LEATHER AVIATOR PANTS</div>
    </div>
  )
}
