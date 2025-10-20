import { useState } from 'react'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import styles from './TopAccordion.module.scss'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import ShellIcon from '../../assets/shell-uh03.svg'
import FalconIcon from '../../assets/falcon-icon.svg'
import MilitaryJacket from '../../assets/military-jacket.png'
import Hoodie from '../../assets/hoodie.png'

// Four distinct items rotate; supports png + svg mixed
const carouselItems: string[] = [FalconIcon, ShellIcon, MilitaryJacket, Hoodie]

interface TopAccordionProps {
  variant?: 'mobile' | 'desktop'
}

export default function TopAccordion({ variant = 'mobile' }: TopAccordionProps) {
  const { sendFitSpaceCommand, connectionState } = usePixelStreaming()
  const [index, setIndex] = useState(0)
  const prev = () => {
    setIndex(i => {
      const newIndex = (i + carouselItems.length - 1) % carouselItems.length
      // Send selectClothing command for tops (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFitSpaceCommand('selectClothing', { itemId, category: 'top' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=top`)
      }
      return newIndex
    })
  }
  const next = () => {
    setIndex(i => {
      const newIndex = (i + 1) % carouselItems.length
      // Send selectClothing command for tops (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFitSpaceCommand('selectClothing', { itemId, category: 'top' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=top`)
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
      <div className={styles.productTitle}>FALCON LEATHER AVIATOR JACKET</div>
    </div>
  )
}
