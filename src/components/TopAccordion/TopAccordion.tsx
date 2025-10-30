import { useEffect, useMemo, useState } from 'react'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import styles from './TopAccordion.module.scss'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import {
  getClothingCatalog,
  getClothingIdentifierForIndex,
} from '../../constants/clothing'
import { useQueuedUnreal } from '../../services/queuedUnreal'

const catalog = getClothingCatalog()

// Čuvamo lokalni popis asseta preko centralizirane konfiguracije
const carouselItems = catalog.top.map((item) => item.asset)

interface TopAccordionProps {
  variant?: 'mobile' | 'desktop'
}

export default function TopAccordion({ variant = 'mobile' }: TopAccordionProps) {
  const { sendFitSpaceCommand, connectionState } = usePixelStreaming()
  const { updateClothingSelection, currentAvatar } = useAvatarConfiguration()
  const simpleState = useMemo<'connected' | 'connecting' | 'disconnected'>(() => {
    return connectionState === 'connected'
      ? 'connected'
      : connectionState === 'connecting'
        ? 'connecting'
        : 'disconnected'
  }, [connectionState])
  const sendQueued = useQueuedUnreal(sendFitSpaceCommand, simpleState)
  const initialIndex = useMemo(() => {
    const selection = currentAvatar?.clothingSelections?.top
    if (!selection) return 0
    const items = catalog.top
    const normalizedSub = selection.subCategory?.toLowerCase() ?? null
    const matchIndex = items.findIndex(item => {
      const sameItem = Number(item.itemId) === Number(selection.itemId)
      const sameSub = normalizedSub ? item.subCategory.toLowerCase() === normalizedSub : true
      return sameItem && sameSub
    })
    if (matchIndex >= 0) return matchIndex
    const fallback = items.findIndex(item => Number(item.itemId) === Number(selection.itemId))
    return fallback >= 0 ? fallback : 0
  }, [currentAvatar?.clothingSelections])
  const [index, setIndex] = useState(initialIndex)
  useEffect(() => {
    setIndex(prev => (prev === initialIndex ? prev : initialIndex))
  }, [initialIndex])
  const sendClothingSelection = (itemIndex: number) => {
    const identifier = getClothingIdentifierForIndex('top', itemIndex)

    sendQueued(
      'selectClothing',
      {
        category: 'top',
        subCategory: identifier.subCategory,
        itemId: identifier.itemId,
      },
      `selectClothing/top/${identifier.subCategory ?? identifier.itemId}`,
    )

    updateClothingSelection('top', {
      itemId: identifier.itemId,
      subCategory: identifier.subCategory,
    })

    return identifier
  }
  const prev = () => {
    setIndex(i => {
      const newIndex = (i + carouselItems.length - 1) % carouselItems.length
      // Pošalji selectClothing uz centralizirane identifikatore za gornji dio
      const { itemId, subCategory } = sendClothingSelection(newIndex)
      console.log(
        `Queued selectClothing command: itemId=${itemId}, category=top, subCategory=${subCategory}`,
      )
      return newIndex
    })
  }
  const next = () => {
    setIndex(i => {
      const newIndex = (i + 1) % carouselItems.length
      // Pošalji selectClothing uz centralizirane identifikatore za gornji dio
      const { itemId, subCategory } = sendClothingSelection(newIndex)
      console.log(
        `Queued selectClothing command: itemId=${itemId}, category=top, subCategory=${subCategory}`,
      )
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
