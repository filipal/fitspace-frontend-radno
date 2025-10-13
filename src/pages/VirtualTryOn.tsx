import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header/Header'
import { usePixelStreaming } from '../context/PixelStreamingContext'
import { PixelStreamingView } from '../components/PixelStreamingView/PixelStreamingView'
// Using ?react variants for unified styling
import avatarBg from '../assets/male-avatar.png'
import avatarsButton from '../assets/avatar-button.svg'
import ArrowLeft from '../assets/arrow-left.svg'
import ArrowRight from '../assets/arrow-right.svg'
import styles from './VirtualTryOn.module.scss'
import { lightenHex, darkenHex } from '../utils/color'
import ColorBtn from '../components/ColorBtn/ColorBtn'
import RLeft from '../assets/r-left.svg?react'
import RRight from '../assets/r-right.svg?react'
import TopZoom from '../assets/tops-detailed-zoom.svg?react'
import BottomZoom from '../assets/bottoms-detailed-zoom.svg?react'
import DownloadIcon from '../assets/download.svg?react'
import UploadIcon from '../assets/upload.svg?react'
import FullScreenIcon from '../assets/full-screen.svg?react'
import HomeButton from '../assets/home-button.svg?react'
import TopAccordion from '../components/TopAccordion/TopAccordion'
import BottomAccordion from '../components/BottomAccordion/BottomAccordion'
import CartButton from '../assets/cart-button.svg'
import FullBodyButton from '../assets/full-body-button.svg'
import TopBotButton from '../assets/top-bot-button.svg'
import AnimationButton from '../assets/animation-button.svg'
import HeatMapButton from '../assets/heat-map-button.svg'
import ArrowUp from '../assets/arrow-up.svg'
import ArrowDown from '../assets/arrow-down.svg'
import HoodieImg from '../assets/hoodie.png'
import MilitaryJacketImg from '../assets/military-jacket.png'
import Jacket1Img from '../assets/jacket-1.png'
import Jacket2Img from '../assets/jacket-2.png'
import Jacket3Img from '../assets/jacket-3.png'
import Jacket4Img from '../assets/jacket-4.png'
import BossDyn01Img from '../assets/boss-dyn01.png'
import Pants1Img from '../assets/pants-1.png'
import Pants2Img from '../assets/pants-2.png'
import Pants3Img from '../assets/pants-3.png'
import Pants4Img from '../assets/pants-4.png'
import Pants5Img from '../assets/pants-5.png'

// View state structure
interface ViewState {
  focus: 'top' | 'bottom' | 'fullBody'
  detail: boolean
}

interface ControlButton {
  key: string
  width: number
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  marginRight: number
}

const DESIGN_WIDTH = 430
const toCqw = (px: number) => (px === 0 ? '0' : `calc(${px} / ${DESIGN_WIDTH} * 100cqw)`)

export default function VirtualTryOn() {
  const navigate = useNavigate()
  const { sendFittingRoomCommand, connectionState, application, devMode } = usePixelStreaming()

  // Connection is now managed by the persistent PixelStreamingContainer
  // No need for reconnection logic here - the container handles seamless transitions
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  )
  const [view, setView] = useState<ViewState>({ focus: 'top', detail: false })
  const [selectedControl, setSelectedControl] = useState<string | null>(null)
  const [topOpen, setTopOpen] = useState(false)
  const [bottomOpen, setBottomOpen] = useState(false)
  const [topExpandedFooter, setTopExpandedFooter] = useState(false)
  const [bottomExpandedFooter, setBottomExpandedFooter] = useState(false)
  const [fullBodyMode, setFullBodyMode] = useState(false)
  const [fullBodyDetail, setFullBodyDetail] = useState(false)
  const [topOptionIndex, setTopOptionIndex] = useState(0) // Option 1..5 => indices 0..4
  const topOptions = ['with armor', 'option 2', 'option 3', 'option 4', 'option 5']
  const [bottomOptionIndex, setBottomOptionIndex] = useState(0)
  const bottomOptions = ['tapered fit', 'regular fit', 'loose fit', 'boot cut', 'straight fit']
  const topCategoryMainRef = useRef<HTMLDivElement | null>(null)
  const bottomCategoryMainRef = useRef<HTMLDivElement | null>(null)
  const [topCategoryWrapped, setTopCategoryWrapped] = useState(false)
  const [bottomCategoryWrapped, setBottomCategoryWrapped] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(event.matches)
    }
    handleChange(mediaQuery)
    const listener = (event: MediaQueryListEvent) => handleChange(event)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener)
    } else {
      mediaQuery.addListener(listener)
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener)
      } else {
        mediaQuery.removeListener(listener)
      }
    }
  }, [])
  useEffect(() => {
    if (isDesktop) {
      setTopOpen(false)
      setBottomOpen(false)
      setTopExpandedFooter(false)
      setBottomExpandedFooter(false)
      setSelectedControl(null)
    }
  }, [isDesktop])
  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return
    }

    if (!isDesktop) {
      setTopCategoryWrapped(false)
      setBottomCategoryWrapped(false)
      return
    }

    const watchers: Array<{ compute: () => void; observer: ResizeObserver }> = []

    const handleWrap = (
      element: HTMLDivElement | null,
      setter: Dispatch<SetStateAction<boolean>>,
    ) => {
      if (!element) return
      const calculate = () => {
        if (element.dataset.measuring === '1') {
          return
        }
        element.dataset.measuring = '1'

        const hadWrapClass = element.classList.contains(
          styles.desktopCategoryTextMainWrapped,
        )
        if (hadWrapClass) {
          element.classList.remove(styles.desktopCategoryTextMainWrapped)
        }

        const previousWhiteSpace = element.style.whiteSpace
        element.style.whiteSpace = 'nowrap'

        const availableWidth = element.clientWidth
        const requiredWidth = element.scrollWidth

        const isWrapped = requiredWidth - availableWidth > 1

        element.style.whiteSpace = previousWhiteSpace
        if (hadWrapClass) {
          element.classList.add(styles.desktopCategoryTextMainWrapped)
        }
        delete element.dataset.measuring
        setter((prev) => (prev === isWrapped ? prev : isWrapped))
      }
      calculate()
      const observer = new ResizeObserver(calculate)
      observer.observe(element)
      watchers.push({ compute: calculate, observer })
    }

    handleWrap(topCategoryMainRef.current, setTopCategoryWrapped)
    handleWrap(bottomCategoryMainRef.current, setBottomCategoryWrapped)

    const handleWindowResize = () => {
      watchers.forEach(({ compute }) => compute())
    }
    window.addEventListener('resize', handleWindowResize)

    return () => {
      watchers.forEach(({ observer }) => observer.disconnect())
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [isDesktop])
  const cycleTopPrev = () => {
    setTopOptionIndex((i) => {
      const newIndex = (i + 5 - 1) % 5
      // Send selectClothing command for tops (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'top' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=top`)
      }
      return newIndex
    })
  }
  const cycleTopNext = () => {
    setTopOptionIndex((i) => {
      const newIndex = (i + 1) % 5
      // Send selectClothing command for tops (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'top' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=top`)
      }
      return newIndex
    })
  }
  const cycleBottomPrev = () => {
    setBottomOptionIndex((i) => {
      const newIndex = (i + bottomOptions.length - 1) % bottomOptions.length
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'bottom' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=bottom`)
      }
      return newIndex
    })
  }
  const cycleBottomNext = () => {
    setBottomOptionIndex((i) => {
      const newIndex = (i + 1) % bottomOptions.length
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'bottom' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=bottom`)
      }
      return newIndex
    })
  }
  // Color group behaves like SkinAccordion iconsThree (light/base/dark) with center selectable enlargement
  const basePalette = ['#f5e0d0', '#eac3a6', '#d7a381', '#b47b57', '#8a573b', '#5d3b2a']
  const [baseColorIndex, setBaseColorIndex] = useState(2)
  const baseColor = basePalette[baseColorIndex]
  const lightShade = lightenHex(baseColor)
  const darkShade = darkenHex(baseColor)
  const shades = [lightShade, baseColor, darkShade]
  const [activeShadeIndex, setActiveShadeIndex] = useState(1) // center default

  // Category selector groups (upper & lower) with cyclic scrolling via arrows
  const upperCategories = ['T-Shirts', 'Jackets', 'Base Layer']
  const lowerCategories = ['Shorts', 'Jeans', 'Base Layer']
  const [upperCenterIdx, setUpperCenterIdx] = useState(1) // 'Jackets'
  const [lowerCenterIdx, setLowerCenterIdx] = useState(1) // 'Jeans'
  const cycleUpper = (dir: 1 | -1) => {
    setUpperCenterIdx((i) => {
      const newIndex = (i + dir + upperCategories.length) % upperCategories.length
      // Send selectClothing command for tops (use index directly as it's already 0-2)
      if (connectionState === 'connected') {
        const itemId = newIndex.toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'top' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=top`)
      }
      return newIndex
    })
  }
  const cycleLower = (dir: 1 | -1) => {
    setLowerCenterIdx((i) => {
      const newIndex = (i + dir + lowerCategories.length) % lowerCategories.length
      // Send selectClothing command for bottoms (use index directly as it's already 0-2)
      if (connectionState === 'connected') {
        const itemId = newIndex.toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'bottom' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=bottom`)
      }
      return newIndex
    })
  }
  const upperTop =
    upperCategories[(upperCenterIdx - 1 + upperCategories.length) % upperCategories.length]
  const upperMain = upperCategories[upperCenterIdx]
  const upperBottom = upperCategories[(upperCenterIdx + 1) % upperCategories.length]
  const lowerTop =
    lowerCategories[(lowerCenterIdx - 1 + lowerCategories.length) % lowerCategories.length]
  const lowerMain = lowerCategories[lowerCenterIdx]
  const lowerBottom = lowerCategories[(lowerCenterIdx + 1) % lowerCategories.length]

  // Full body categories (cyclic) - initial display Jumpsuit (top), Dress (main), Suit (bottom)
  const fullBodyCategories = ['Jumpsuit', 'Dress', 'Suit']
  const [fullBodyCenterIdx, setFullBodyCenterIdx] = useState(1) // 'Dress'
  const cycleFullBody = (dir: 1 | -1) =>
    setFullBodyCenterIdx((i) => (i + dir + fullBodyCategories.length) % fullBodyCategories.length)
  const fbTop =
    fullBodyCategories[
      (fullBodyCenterIdx - 1 + fullBodyCategories.length) % fullBodyCategories.length
    ]
  const fbMain = fullBodyCategories[fullBodyCenterIdx]
  const fbBottom = fullBodyCategories[(fullBodyCenterIdx + 1) % fullBodyCategories.length]

  // Full body detailed categories
  const fullBodyDetailCategories = ['Outfit', 'Style', 'Fit']
  const [fullBodyDetailCenterIdx, setFullBodyDetailCenterIdx] = useState(1) // 'Style'
  const cycleFullBodyDetail = (dir: 1 | -1) =>
    setFullBodyDetailCenterIdx(
      (i) => (i + dir + fullBodyDetailCategories.length) % fullBodyDetailCategories.length,
    )
  const fbdTop =
    fullBodyDetailCategories[
      (fullBodyDetailCenterIdx - 1 + fullBodyDetailCategories.length) %
        fullBodyDetailCategories.length
    ]
  const fbdMain = fullBodyDetailCategories[fullBodyDetailCenterIdx]
  const fbdBottom =
    fullBodyDetailCategories[(fullBodyDetailCenterIdx + 1) % fullBodyDetailCategories.length]

  // Right-side image selectors (jackets & pants) single image display with arrows
  const jacketImages = [
    HoodieImg,
    MilitaryJacketImg,
    Jacket1Img,
    Jacket2Img,
    Jacket3Img,
    Jacket4Img,
  ]
  const pantsImages = [BossDyn01Img, Pants1Img, Pants2Img, Pants3Img, Pants4Img, Pants5Img]
  const [jacketIndex, setJacketIndex] = useState(0)
  const [pantsIndex, setPantsIndex] = useState(0)
  const cycleJackets = (dir: 1 | -1) => {
    setJacketIndex((i) => {
      const newIndex = (i + dir + jacketImages.length) % jacketImages.length
      // Send selectClothing command for tops (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'top' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=top`)
      }
      return newIndex
    })
  }
  const cyclePants = (dir: 1 | -1) => {
    setPantsIndex((i) => {
      const newIndex = (i + dir + pantsImages.length) % pantsImages.length
      // Send selectClothing command for bottoms (map to 0-2 range)
      if (connectionState === 'connected') {
        const itemId = (newIndex % 2).toString()
        sendFittingRoomCommand('selectClothing', { itemId, category: 'bottom' })
        console.log(`Sent selectClothing command: itemId=${itemId}, category=bottom`)
      }
      return newIndex
    })
  }

  // Size selector (shown in right upper arrows when topExpandedFooter)
  const sizeSequence = ['SX', 'S', 'M', 'L', 'XL', 'XXL']
  const [sizeCenterIdx, setSizeCenterIdx] = useState(2) // 'M'
  const cycleSize = (dir: 1 | -1) =>
    setSizeCenterIdx((i) => (i + dir + sizeSequence.length) % sizeSequence.length)
  const sizeAbove = sizeSequence[(sizeCenterIdx - 1 + sizeSequence.length) % sizeSequence.length]
  const sizeMain = sizeSequence[sizeCenterIdx]
  const sizeBelow = sizeSequence[(sizeCenterIdx + 1) % sizeSequence.length]

  // Bottom detailed sizes (Waist/Length pairs) displayed as two-line W## / L##
  const bottomSizes = [
    { w: 28, l: 30 },
    { w: 29, l: 30 },
    { w: 30, l: 30 },
    { w: 31, l: 32 },
    { w: 32, l: 32 },
    { w: 33, l: 32 },
    { w: 34, l: 32 },
  ]
  const [bottomSizeCenterIdx, setBottomSizeCenterIdx] = useState(3) // pick a mid value (31/32)
  const cycleBottomSize = (dir: 1 | -1) =>
    setBottomSizeCenterIdx((i) => (i + dir + bottomSizes.length) % bottomSizes.length)
  const bottomSizeAbove =
    bottomSizes[(bottomSizeCenterIdx - 1 + bottomSizes.length) % bottomSizes.length]
  const bottomSizeMain = bottomSizes[bottomSizeCenterIdx]
  const bottomSizeBelow = bottomSizes[(bottomSizeCenterIdx + 1) % bottomSizes.length]

  // Layout math (container width 410):
  // Desired button widths: 60 (outer) + 50 + 50 + 60 (outer) = 220
  // Keep a small middle gap (10) between the two inner buttons.
  // Remaining horizontal space: 410 - 220 - 10 = 180 -> split evenly left/right as 90 + 90.
  // margin-right sequence becomes: 90, 10, 90, 0
  // This centers the group while preserving the visual rhythm from previous design.
  const leftControlIcon = fullBodyMode && fullBodyDetail ? DownloadIcon : TopZoom
  const rightControlIcon = fullBodyMode && fullBodyDetail ? UploadIcon : BottomZoom
  const baseControls: ControlButton[] = [
    { key: 'rotate-left', width: 60, Icon: RLeft, marginRight: 90 },
    { key: 'top-zoom', width: 50, Icon: leftControlIcon, marginRight: 10 },
    { key: 'bottom-zoom', width: 50, Icon: rightControlIcon, marginRight: 90 },
    { key: 'rotate-right', width: 60, Icon: RRight, marginRight: 0 },
  ]
  const expandedControls: ControlButton[] = [
    { key: 'rotate-left', width: 60, Icon: RLeft, marginRight: 0 },
    { key: 'top-zoom', width: 50, Icon: leftControlIcon, marginRight: 0 },
    { key: 'home', width: 40, Icon: HomeButton, marginRight: 0 },
    { key: 'bottom-zoom', width: 50, Icon: rightControlIcon, marginRight: 0 },
    { key: 'rotate-right', width: 60, Icon: RRight, marginRight: 0 },
  ]
  const accordionOpen = topOpen || bottomOpen
  const controls = accordionOpen ? expandedControls : baseControls
  const desktopControls: ControlButton[] = [
    { key: 'rotate-left', width: 60, Icon: RLeft, marginRight: 40 },
    { key: 'upload', width: 50, Icon: UploadIcon, marginRight: 25 },
    { key: 'fullscreen', width: 40, Icon: FullScreenIcon, marginRight: 25 },
    { key: 'download', width: 50, Icon: DownloadIcon, marginRight: 40 },
    { key: 'rotate-right', width: 60, Icon: RRight, marginRight: 0 },
  ]

  const toggleControl = (key: string) => {
    setSelectedControl((prev) => (prev === key ? null : key))
  }
  const handleDesktopControlClick = (controlKey: string) => {
    setSelectedControl((prev) => (prev === controlKey ? null : controlKey))
    if (connectionState === 'connected') {
      switch (controlKey) {
        case 'rotate-left':
          sendFittingRoomCommand('rotateCamera', { direction: 'left', speed: 1 })
          console.log('Sent rotate left command')
          break
        case 'upload':
          sendFittingRoomCommand('zoomCamera', { direction: 'in', amount: 0.1 })
          console.log('Sent zoom in command')
          break
        case 'fullscreen':
          console.log('Fullscreen button clicked - no command defined yet')
          break
        case 'download':
          sendFittingRoomCommand('moveCamera', { direction: 'up', amount: 0.1 })
          console.log('Sent move camera command')
          break
        case 'rotate-right':
          sendFittingRoomCommand('rotateCamera', { direction: 'right', speed: 1 })
          console.log('Sent rotate right command')
          break
        default:
          console.log(`Control ${controlKey} clicked - no streaming command defined`)
      }
    } else {
      console.log(`Cannot send command - connection state: ${connectionState}`)
    }
  }
  const desktopControlClassMap: Record<string, string> = {
    'rotate-left': styles.desktopRotateLeft,
    upload: styles.desktopUpload,
    fullscreen: styles.desktopFullscreen,
    download: styles.desktopDownload,
    'rotate-right': styles.desktopRotateRight,
  }
  const renderControlButtons = () => {
    if (isDesktop) {
      return (
        <div className={`${styles.controlGroup} ${styles.controlGroupDesktop}`}>
          {desktopControls.map((control) => {
            const controlClass = desktopControlClassMap[control.key] ?? ''
            return (
              <button
                key={control.key}
                type="button"
                className={`${styles.desktopControlButton} ${controlClass} ${
                  selectedControl === control.key ? styles.desktopControlButtonSelected : ''
                }`}
                onClick={() => handleDesktopControlClick(control.key)}
              >
                <control.Icon className={styles.desktopControlIcon} />
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <div className={styles.controlGroup}>
        {controls.map((control, idx) => {
          const selectable = control.key === 'top-zoom' || control.key === 'bottom-zoom'
          // Expanded spacing logic (only when accordion open and 5 buttons rendered)
          let styleMargins: CSSProperties = {
            width: toCqw(control.width),
            height: toCqw(control.width),
            marginRight: toCqw(control.marginRight),
          }
          if (control.marginRight === 0) {
            styleMargins.marginRight = undefined
          }
          if (accordionOpen) {
            // Apply exact gap spec: left offset 20, gaps 40,25,25,40, right offset 20
            // We'll set marginLeft on first button and marginRight values manually ignoring pre-set marginRight
            styleMargins = {
              width: toCqw(control.width),
              height: toCqw(control.width),
            }
            if (idx === 0) {
              styleMargins.marginLeft = toCqw(20)
              styleMargins.marginRight = toCqw(40)
            }
            if (idx === 1) styleMargins.marginRight = toCqw(25)
            if (idx === 2) styleMargins.marginRight = toCqw(25)
            if (idx === 3) styleMargins.marginRight = toCqw(40)
            if (idx === 4) styleMargins.marginRight = toCqw(20)
          }
          return (
            <button
              key={control.key}
              type="button"
              className={`${styles.controlButton} ${
                selectable && selectedControl === control.key ? styles.selected : ''
              }`}
              style={styleMargins}
              onClick={() => {
                // Send pixel streaming commands for rotate buttons
                if (control.key === 'rotate-left' && connectionState === 'connected') {
                  sendFittingRoomCommand('rotateCamera', { direction: 'left', speed: 1 })
                  console.log('Sent rotate left command')
                }
                if (control.key === 'rotate-right' && connectionState === 'connected') {
                  sendFittingRoomCommand('rotateCamera', { direction: 'right', speed: 1 })
                  console.log('Sent rotate right command')
                }

                // Send pixel streaming commands for middle buttons
                if (control.key === 'top-zoom' && connectionState === 'connected') {
                  sendFittingRoomCommand('zoomCamera', { direction: 'in', amount: 0.1 })
                  console.log('Sent zoom camera command')
                }
                if (control.key === 'bottom-zoom' && connectionState === 'connected') {
                  sendFittingRoomCommand('moveCamera', { direction: 'up', amount: 0.1 })
                  console.log('Sent move camera command')
                }

                // Enter full body detailed states via control buttons
                if (fullBodyMode && !fullBodyDetail && control.key === 'rotate-left') {
                  setFullBodyDetail(true)
                  setTopOpen(true)
                  setTopExpandedFooter(true)
                  setBottomExpandedFooter(false)
                  return
                }
                if (fullBodyMode && !fullBodyDetail && control.key === 'top-zoom') {
                  setFullBodyDetail(true)
                  setTopOpen(true)
                  setBottomOpen(false)
                  setTopExpandedFooter(true)
                  setBottomExpandedFooter(false)
                  setSelectedControl('top-zoom')
                  return
                }
                if (fullBodyMode && !fullBodyDetail && control.key === 'bottom-zoom') {
                  setFullBodyDetail(true)
                  setBottomOpen(true)
                  setTopOpen(false)
                  setTopExpandedFooter(false)
                  setBottomExpandedFooter(true)
                  setSelectedControl('bottom-zoom')
                  return
                }
                if (fullBodyMode && fullBodyDetail && control.key === 'top-zoom') {
                  if (topOpen) {
                    setFullBodyDetail(false)
                    setTopOpen(false)
                    setBottomOpen(false)
                    setTopExpandedFooter(false)
                    setBottomExpandedFooter(false)
                    setSelectedControl(null)
                  } else {
                    setTopOpen(true)
                    setBottomOpen(false)
                    setTopExpandedFooter(true)
                    setBottomExpandedFooter(false)
                    setSelectedControl('top-zoom')
                  }
                  return
                }
                if (fullBodyMode && fullBodyDetail && control.key === 'bottom-zoom') {
                  if (bottomOpen) {
                    setFullBodyDetail(false)
                    setTopOpen(false)
                    setBottomOpen(false)
                    setTopExpandedFooter(false)
                    setBottomExpandedFooter(false)
                    setSelectedControl(null)
                  } else {
                    setBottomOpen(true)
                    setTopOpen(false)
                    setTopExpandedFooter(false)
                    setBottomExpandedFooter(true)
                    setSelectedControl('bottom-zoom')
                  }
                  return
                }
                if (control.key === 'home') {
                  setFullBodyMode(false)
                  setFullBodyDetail(false)
                  setTopOpen(false)
                  setBottomOpen(false)
                  setTopExpandedFooter(false)
                  setBottomExpandedFooter(false)
                  setSelectedControl(null)
                  return
                }
                if (selectable) {
                  // Normal virtual try-on mode: inner circles should open accordions like footer buttons
                  if (!fullBodyMode) {
                    if (control.key === 'top-zoom') {
                      setTopOpen(true)
                      setBottomOpen(false)
                      setTopExpandedFooter(true)
                      setBottomExpandedFooter(false)
                      toggleControl(control.key)
                      return
                    }
                    if (control.key === 'bottom-zoom') {
                      setBottomOpen(true)
                      setTopOpen(false)
                      setBottomExpandedFooter(true)
                      setTopExpandedFooter(false)
                      toggleControl(control.key)
                      return
                    }
                  }
                  // Fallback (e.g. potential future full body inner circle usage)
                  toggleControl(control.key)
                  if (control.key === 'top-zoom') enterDetail('top')
                  if (control.key === 'bottom-zoom') enterDetail('bottom')
                } else {
                  // rotation action placeholder; no selection highlight
                }
              }}
            >
              {/* For top/bottom zoom buttons we need a fixed white inner circle that does NOT change color; selection adds an outer transparent ring. */}
              {['top-zoom', 'bottom-zoom'].includes(control.key) ? (
                <>
                  <div className={styles.selectionRing} />
                  <div className={styles.innerCircle} />
                  <control.Icon className={styles.controlIcon} />
                </>
              ) : control.key === 'home' ? (
                <>
                  <div className={styles.fillCircle} />
                  <div className={styles.outerCircle} />
                  <control.Icon className={styles.controlIcon} />
                </>
              ) : (
                <>
                  <div className={styles.fillCircle} />
                  <div className={styles.outerCircle} />
                  <control.Icon className={styles.controlIcon} />
                </>
              )}
            </button>
          )
        })}
      </div>
    )
  }
  const renderDesktopSizeSelector = (focus: 'top' | 'bottom') => {
    const isTop = focus === 'top'
    const handleCycle = (dir: 1 | -1) =>
      isTop ? cycleSize(dir) : cycleBottomSize(dir)
    return (
      <div className={styles.desktopSizeSelector}>
        <button
          type="button"
          className={styles.desktopVerticalArrow}
          onClick={() => handleCycle(-1)}
        >
          <img src={ArrowUp} alt="Previous size" />
        </button>
        {isTop ? (
          <div className={styles.desktopSizeDisplay}>
            <div className={styles.desktopSizeSmall}>{sizeAbove}</div>
            <div className={styles.desktopSizeMain}>{sizeMain}</div>
            <div className={styles.desktopSizeSmall}>{sizeBelow}</div>
          </div>
        ) : (
          <div className={styles.desktopSizeDisplayBottom}>
            <div className={styles.desktopSizeSmallBottom}>
              W{bottomSizeAbove.w}
              L{bottomSizeAbove.l}
            </div>
            <div className={styles.desktopSizeMainBottom}>
              W{bottomSizeMain.w}
              L{bottomSizeMain.l}
            </div>
            <div className={styles.desktopSizeSmallBottom}>
              W{bottomSizeBelow.w}
              L{bottomSizeBelow.l}
            </div>
          </div>
        )}
        <button
          type="button"
          className={styles.desktopVerticalArrow}
          onClick={() => handleCycle(1)}
        >
          <img src={ArrowDown} alt="Next size" />
        </button>
      </div>
    )
  }

  const renderDesktopCategorySelector = (focus: 'top' | 'bottom') => {
    const cycle = focus === 'top' ? cycleUpper : cycleLower
    const textTop = focus === 'top' ? upperTop : lowerTop
    const textMain = focus === 'top' ? upperMain : lowerMain
    const textBottom = focus === 'top' ? upperBottom : lowerBottom
    return (
      <div className={styles.desktopCategorySelector}>
        <button
          type="button"
          className={styles.desktopVerticalArrow}
          onClick={() => cycle(-1)}
        >
          <img src={ArrowUp} alt="Previous category" />
        </button>
        <div className={styles.desktopCategoryTexts}>
          <div className={styles.desktopCategoryTextTop}>{textTop}</div>
          <div
            ref={focus === 'top' ? topCategoryMainRef : bottomCategoryMainRef}
            className={`${styles.desktopCategoryTextMain} ${
              (focus === 'top' ? topCategoryWrapped : bottomCategoryWrapped)
                ? styles.desktopCategoryTextMainWrapped
                : ''
            }`}
          >
            {textMain}
          </div>
          <div className={styles.desktopCategoryTextBottom}>{textBottom}</div>
        </div>
        <button
          type="button"
          className={styles.desktopVerticalArrow}
          onClick={() => cycle(1)}
        >
          <img src={ArrowDown} alt="Next category" />
        </button>
      </div>
    )
  }

  const renderDesktopOptionSelector = (focus: 'top' | 'bottom') => {
    const isTop = focus === 'top'
    const mainLabel = isTop
      ? `Option ${topOptionIndex + 1}`
      : `Option ${bottomOptionIndex + 1}`
    const subLabel = isTop ? topOptions[topOptionIndex] : bottomOptions[bottomOptionIndex]
    const prev = isTop ? cycleTopPrev : cycleBottomPrev
    const next = isTop ? cycleTopNext : cycleBottomNext
    return (
      <div className={styles.desktopOptionSelector}>
        <button
          type="button"
          className={styles.desktopHorizontalArrow}
          onClick={prev}
        >
          <img src={ArrowLeft} alt="Previous option" />
        </button>
        <div className={styles.desktopOptionText}>
          <div className={styles.desktopOptionTitle}>{mainLabel}</div>
          <div className={styles.desktopOptionSubtitle}>{subLabel}</div>
        </div>
        <button
          type="button"
          className={styles.desktopHorizontalArrow}
          onClick={next}
        >
          <img src={ArrowRight} alt="Next option" />
        </button>
      </div>
    )
  }

  const renderDesktopColorSelector = () => (
    <div className={styles.desktopColorSelector}>
      <button
        type="button"
        className={styles.desktopVerticalArrow}
        onClick={() =>
          setBaseColorIndex((i) => (i + basePalette.length - 1) % basePalette.length)
        }
      >
        <img src={ArrowUp} alt="Previous palette" />
      </button>
      <button
        type="button"
        className={styles.desktopColorButton}
        onClick={() =>
          setActiveShadeIndex((idx) => (idx + 1) % shades.length)
        }
      >
        <ColorBtn size={45} color={shades[activeShadeIndex]} active />
      </button>
      <button
        type="button"
        className={styles.desktopVerticalArrow}
        onClick={() => setBaseColorIndex((i) => (i + 1) % basePalette.length)}
      >
        <img src={ArrowDown} alt="Next palette" />
      </button>
    </div>
  )

  const renderDesktopFooterSection = (focus: 'top' | 'bottom') => (
    <div className={styles.desktopFooterSection} key={focus}>
      <div className={styles.desktopFooterHeading}>{focus === 'top' ? 'TOP' : 'BOTTOM'}</div>
      <div className={styles.desktopFooterBody}>
        <div className={styles.desktopFooterLeft}>
          <div className={styles.desktopFooterLeftTop}>
            {focus === 'top' ? (
              <TopAccordion variant="desktop" />
            ) : (
              <BottomAccordion variant="desktop" />
            )}
          </div>
          <div className={styles.desktopFooterLeftBottom} />
        </div>
        <div className={styles.desktopFooterRight}>
          <div className={styles.desktopFooterRightTop}>
            <div className={styles.desktopFooterRightCol}>
              {renderDesktopSizeSelector(focus)}
            </div>
            <div className={styles.desktopFooterRightCol}>
              {renderDesktopCategorySelector(focus)}
            </div>
          </div>
          <div className={styles.desktopFooterRightBottom}>
            <div className={styles.desktopFooterRightCol}>{renderDesktopColorSelector()}</div>
            <div className={styles.desktopFooterRightCol}>
              {renderDesktopOptionSelector(focus)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const title = fullBodyMode
    ? fullBodyDetail
      ? 'Full Body - Detailed'
      : 'Virtual Try-on'
    : topExpandedFooter
      ? 'Top - Detailed'
      : bottomExpandedFooter
        ? 'Bottom - Detailed'
        : bottomOpen
          ? 'Bottom - Detailed'
          : view.detail
            ? view.focus === 'top'
              ? 'Top - Detailed'
              : view.focus === 'bottom'
                ? 'Bottom - Detailed'
                : 'Full Body - Detailed'
            : 'Virtual Try-on'

  const enterDetail = (focus: ViewState['focus']) => {
    setView({ focus, detail: true })
  }

  // (detail view toggles not used in new footer version; kept view state placeholder for future)

  return (
    <div className={`${styles.page} ${isDesktop ? styles.pageDesktop : ''}`}>
      <Header
        variant="dark"
        title={title}
        onExit={() => navigate(-1)}
        rightContent={
          <button
            className={styles.avatarButton}
            onClick={() => navigate('/unreal-measurements')}
            type="button"
          >
            <img src={avatarsButton} alt="Avatars" />
          </button>
        }
      />

      <div className={`${styles.mainLayout} ${isDesktop ? styles.mainLayoutDesktop : ''}`}>
        <div className={`${styles.canvasColumn} ${isDesktop ? styles.canvasColumnDesktop : ''}`}>
          <div
            className={`${styles.canvasWrapper} ${
              accordionOpen && !isDesktop ? styles.withAccordion : ''
            } ${topOpen && !(fullBodyMode && fullBodyDetail) ? styles.topZoom : ''} ${
              bottomOpen && !(fullBodyMode && fullBodyDetail) ? styles.bottomZoom : ''
            } ${topExpandedFooter ? styles.footerTopExpanded : ''} ${
              bottomExpandedFooter ? styles.footerBotExpanded : ''
            } ${fullBodyMode && fullBodyDetail ? styles.fullBodyDetail : ''} ${
              isDesktop ? styles.canvasWrapperDesktop : ''
            }`}
          >
            {/* PixelStreaming kad je stvarno connected (ili u localhost DEV), inače fallback slika */}
            {(connectionState === 'connected' && application) || devMode === 'localhost' ? (
              <PixelStreamingView
                className={`${styles.avatarImage} ${isDesktop ? styles.avatarImageDesktop : ''}`}
                autoConnect={devMode === 'localhost'}
              />
            ) : (
              <img
                src={avatarBg}
                alt="Avatar"
                className={`${styles.avatarImage} ${isDesktop ? styles.avatarImageDesktop : ''}`}
              />
            )}

            <button
              type="button"
              className={`${styles.topBotFloating} ${((topOpen || bottomOpen) && !fullBodyMode) || (fullBodyMode && fullBodyDetail) ? styles.cartVariant : ''} ${fullBodyMode && !fullBodyDetail ? styles.fullBodyVariant : ''}`}
              onClick={() => {
                if (fullBodyMode) {
                  // exit full body (any variant)
                  setFullBodyMode(false)
                  setFullBodyDetail(false)
                  setTopOpen(false)
                  setBottomOpen(false)
                  setTopExpandedFooter(false)
                  setBottomExpandedFooter(false)
                  setSelectedControl(null)
                  return
                }
                if (!topOpen && !bottomOpen) {
                  // enter simple full body (no detail)
                  setFullBodyMode(true)
                  setFullBodyDetail(false)
                  setTopOpen(false)
                  setBottomOpen(false)
                  setTopExpandedFooter(false)
                  setBottomExpandedFooter(false)
                }
              }}
            >
              <img
                src={
                  fullBodyMode && fullBodyDetail
                    ? CartButton
                    : fullBodyMode
                      ? FullBodyButton
                      : topOpen || bottomOpen
                        ? CartButton
                        : TopBotButton
                }
                alt={
                  fullBodyMode && fullBodyDetail
                    ? 'Cart'
                    : fullBodyMode
                      ? 'Full Body'
                      : topOpen || bottomOpen
                        ? 'Cart'
                        : 'Top/Bot'
                }
              />
            </button>
            <button type="button" className={styles.animationFloating}>
              <img src={AnimationButton} alt="Animation" />
            </button>
            <button type="button" className={styles.heatMapFloating}>
              <img src={HeatMapButton} alt="Heat Map" />
            </button>

            {/* Full body overlay (simplified) */}
            {!isDesktop && fullBodyMode && !fullBodyDetail && (
              <>
                {/* Left full body arrows */}
                <div className={`${styles.categoryArrows} ${styles.categoryArrowsFullBody}`}>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleFullBody(-1)}
                  >
                    <img src={ArrowUp} alt="Previous category" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleFullBody(1)}
                  >
                    <img src={ArrowDown} alt="Next category" />
                  </button>
                </div>
                {/* Left full body text group */}
                <div className={`${styles.fullBodyCategory} ${styles.categoryTextGroupFullBody}`}>
                  <div className={styles.categoryTextTop}>{fbTop}</div>
                  <div className={styles.categoryTextMain}>{fbMain}</div>
                  <div className={styles.categoryTextBottom}>{fbBottom}</div>
                </div>
                {/* Right full body arrows */}
                <div
                  className={`${styles.imageArrows} ${styles.imageArrowsFullBody} ${styles.fullBodyImageArrows}`}
                >
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cyclePants(-1)}
                  >
                    <img src={ArrowUp} alt="Previous item" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cyclePants(1)}
                  >
                    <img src={ArrowDown} alt="Next item" />
                  </button>
                </div>
                {/* Right full body image display */}
                <div className={`${styles.imageDisplay} ${styles.imageDisplayFullBody}`}>
                  <img src={pantsImages[pantsIndex]} alt="Full Body Item" />
                </div>
              </>
            )}
            {!isDesktop && fullBodyMode && fullBodyDetail && (
              <>
                <div className={`${styles.categoryArrows} ${styles.categoryArrowsFirst}`}>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleFullBodyDetail(-1)}
                  >
                    <img src={ArrowUp} alt="Previous category" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleFullBodyDetail(1)}
                  >
                    <img src={ArrowDown} alt="Next category" />
                  </button>
                </div>
                <div className={`${styles.categoryTextGroup} ${styles.categoryTextGroupFirst}`}>
                  <div className={styles.categoryTextTop}>{fbdTop}</div>
                  <div className={styles.categoryTextMain}>{fbdMain}</div>
                  <div className={styles.categoryTextBottom}>{fbdBottom}</div>
                </div>
                {topOpen && (
                  <div className={`${styles.sizeArrows} ${styles.sizeArrowsFirst}`}>
                    <button
                      type="button"
                      className={styles.categoryArrowBtn}
                      onClick={() => cycleSize(-1)}
                    >
                      <img src={ArrowUp} alt="Previous size" />
                    </button>
                    <div className={styles.sizeDisplay}>
                      <div className={styles.sizeSmall}>{sizeAbove}</div>
                      <div className={styles.sizeMain}>{sizeMain}</div>
                      <div className={styles.sizeSmall}>{sizeBelow}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.categoryArrowBtn}
                      onClick={() => cycleSize(1)}
                    >
                      <img src={ArrowDown} alt="Next size" />
                    </button>
                  </div>
                )}
                {bottomOpen && (
                  <div className={`${styles.sizeArrows} ${styles.sizeArrowsFirst}`}>
                    <button
                      type="button"
                      className={styles.categoryArrowBtn}
                      onClick={() => cycleBottomSize(-1)}
                    >
                      <img src={ArrowUp} alt="Previous size" />
                    </button>
                    <div className={styles.sizeDisplayBottom}>
                      <div className={styles.sizeSmallBottom}>
                        W{bottomSizeAbove.w}
                        <br />L{bottomSizeAbove.l}
                      </div>
                      <div className={styles.sizeMainBottom}>
                        W{bottomSizeMain.w}
                        <br />L{bottomSizeMain.l}
                      </div>
                      <div className={styles.sizeSmallBottom}>
                        W{bottomSizeBelow.w}
                        <br />L{bottomSizeBelow.l}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.categoryArrowBtn}
                      onClick={() => cycleBottomSize(1)}
                    >
                      <img src={ArrowDown} alt="Next size" />
                    </button>
                  </div>
                )}
              </>
            )}
            {/* Left side selectors (normal modes) */}
            {!isDesktop && !bottomOpen && !fullBodyMode && (
              <>
                <div
                  className={`${styles.categoryArrows} ${styles.categoryArrowsFirst} ${topExpandedFooter ? styles.categoryArrowsCompact : ''}`}
                >
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleUpper(-1)}
                  >
                    <img src={ArrowUp} alt="Previous category" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleUpper(1)}
                  >
                    <img src={ArrowDown} alt="Next category" />
                  </button>
                </div>
                <div
                  className={`${styles.categoryTextGroup} ${styles.categoryTextGroupFirst} ${topExpandedFooter ? styles.categoryTextGroupCompact : ''}`}
                >
                  <div className={styles.categoryTextTop}>{upperTop}</div>
                  <div className={styles.categoryTextMain}>{upperMain}</div>
                  <div className={styles.categoryTextBottom}>{upperBottom}</div>
                </div>
                {!topExpandedFooter && (
                  <>
                    <div className={`${styles.categoryArrows} ${styles.categoryArrowsSecond}`}>
                      <button
                        type="button"
                        className={styles.categoryArrowBtn}
                        onClick={() => cycleLower(-1)}
                      >
                        <img src={ArrowUp} alt="Previous category" />
                      </button>
                      <button
                        type="button"
                        className={styles.categoryArrowBtn}
                        onClick={() => cycleLower(1)}
                      >
                        <img src={ArrowDown} alt="Next category" />
                      </button>
                    </div>
                    <div
                      className={`${styles.categoryTextGroup} ${styles.categoryTextGroupSecond}`}
                    >
                      <div className={styles.categoryTextTop}>{lowerTop}</div>
                      <div className={styles.categoryTextMain}>{lowerMain}</div>
                      <div className={styles.categoryTextBottom}>{lowerBottom}</div>
                    </div>
                  </>
                )}
              </>
            )}
            {!isDesktop && bottomOpen && !fullBodyMode && (
              <>
                <div className={`${styles.categoryArrows} ${styles.categoryArrowsFirst}`}>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleLower(-1)}
                  >
                    <img src={ArrowUp} alt="Previous category" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleLower(1)}
                  >
                    <img src={ArrowDown} alt="Next category" />
                  </button>
                </div>
                <div className={`${styles.categoryTextGroup} ${styles.categoryTextGroupFirst}`}>
                  <div className={styles.categoryTextTop}>{lowerTop}</div>
                  <div className={styles.categoryTextMain}>{lowerMain}</div>
                  <div className={styles.categoryTextBottom}>{lowerBottom}</div>
                </div>
              </>
            )}

            {/* Right side selectors */}
            {!isDesktop && !bottomOpen && !topExpandedFooter && !fullBodyMode && (
              <>
                <div className={`${styles.imageArrows} ${styles.imageArrowsFirst}`}>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleJackets(-1)}
                  >
                    <img src={ArrowUp} alt="Previous jacket" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cycleJackets(1)}
                  >
                    <img src={ArrowDown} alt="Next jacket" />
                  </button>
                </div>
                <div className={`${styles.imageDisplay} ${styles.imageDisplayFirst}`}>
                  <img src={jacketImages[jacketIndex]} alt="Jacket" />
                </div>
              </>
            )}
            {/* Size selector in top expanded OR bottom accordion mode */}
            {!isDesktop && !bottomOpen && topExpandedFooter && !fullBodyMode && (
              <div className={`${styles.sizeArrows} ${styles.sizeArrowsFirst}`}>
                <button
                  type="button"
                  className={styles.categoryArrowBtn}
                  onClick={() => cycleSize(-1)}
                >
                  <img src={ArrowUp} alt="Previous size" />
                </button>
                <div className={styles.sizeDisplay}>
                  <div className={styles.sizeSmall}>{sizeAbove}</div>
                  <div className={styles.sizeMain}>{sizeMain}</div>
                  <div className={styles.sizeSmall}>{sizeBelow}</div>
                </div>
                <button
                  type="button"
                  className={styles.categoryArrowBtn}
                  onClick={() => cycleSize(1)}
                >
                  <img src={ArrowDown} alt="Next size" />
                </button>
              </div>
            )}
            {!isDesktop && bottomOpen && !fullBodyMode && (
              <div className={`${styles.sizeArrows} ${styles.sizeArrowsFirst}`}>
                <button
                  type="button"
                  className={styles.categoryArrowBtn}
                  onClick={() => cycleBottomSize(-1)}
                >
                  <img src={ArrowUp} alt="Previous size" />
                </button>
                <div className={styles.sizeDisplayBottom}>
                  <div className={styles.sizeSmallBottom}>
                    W{bottomSizeAbove.w}
                    <br />L{bottomSizeAbove.l}
                  </div>
                  <div className={styles.sizeMainBottom}>
                    W{bottomSizeMain.w}
                    <br />L{bottomSizeMain.l}
                  </div>
                  <div className={styles.sizeSmallBottom}>
                    W{bottomSizeBelow.w}
                    <br />L{bottomSizeBelow.l}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.categoryArrowBtn}
                  onClick={() => cycleBottomSize(1)}
                >
                  <img src={ArrowDown} alt="Next size" />
                </button>
              </div>
            )}
            {/* Second pants row only when no accordion open */}
            {!isDesktop && !topOpen && !bottomOpen && !fullBodyMode && (
              <>
                <div className={`${styles.imageArrows} ${styles.imageArrowsSecond}`}>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cyclePants(-1)}
                  >
                    <img src={ArrowUp} alt="Previous pants" />
                  </button>
                  <button
                    type="button"
                    className={styles.categoryArrowBtn}
                    onClick={() => cyclePants(1)}
                  >
                    <img src={ArrowDown} alt="Next pants" />
                  </button>
                </div>
                <div className={`${styles.imageDisplay} ${styles.imageDisplaySecond}`}>
                  <img src={pantsImages[pantsIndex]} alt="Pants" />
                </div>
              </>
            )}
            {renderControlButtons()}
          </div>

          {/* Accordion area (reduces canvas height instead of pushing footer off) */}
          {!isDesktop && (topOpen || bottomOpen) && (
            <div className={styles.accordionArea}>
              {topOpen && <TopAccordion />}
              {bottomOpen && <BottomAccordion />}
            </div>
          )}
        </div>

        <div className={`${styles.footerColumn} ${isDesktop ? styles.footerColumnDesktop : ''}`}>
          <div
            className={`${styles.footer} ${
              topExpandedFooter
                ? styles.expandedTop
                : bottomExpandedFooter
                  ? styles.expandedBot
                  : fullBodyMode
                    ? styles.footerFullBody
                    : ''
            } ${isDesktop ? styles.desktopFooterRoot : ''}`}
          >
            {isDesktop ? (
              <div className={styles.desktopFooter}>
                {(['top', 'bottom'] as const).map((focus) =>
                  renderDesktopFooterSection(focus),
                )}
              </div>
            ) : (
              <>
                {fullBodyMode && !topExpandedFooter && !bottomExpandedFooter && (
                  <>
                    <div className={styles.footerFullBodyTitle}>FALCON LEATHER AVIATOR JACKET</div>
                    <div className={styles.footerFullBodyLabel}>FULL BODY</div>
                  </>
                )}
                {topExpandedFooter && (
                  <>
                    <div className={styles.topExpandedLeft}>
                      <div className={styles.topExpandedLeftInner}>
                        <button
                          type="button"
                          className={styles.topExpandedArrowsBtn}
                          onClick={cycleTopPrev}
                        >
                          <img src={ArrowLeft} alt="Prev" width={22} height={30} />
                        </button>
                        <div className={styles.topExpandedTextBlock}>
                          <div
                            className={styles.topExpandedMain}
                          >{`Option ${topOptionIndex + 1}`}</div>
                          <div className={styles.topExpandedSub}>{topOptions[topOptionIndex]}</div>
                        </div>
                        <button
                          type="button"
                          className={styles.topExpandedArrowsBtn}
                          onClick={cycleTopNext}
                        >
                          <img src={ArrowRight} alt="Next" width={22} height={30} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.topExpandedRight}>
                      <div className={styles.topExpandedColorsInner}>
                        <button
                          type="button"
                          className={styles.colorArrowBtn}
                          onClick={() =>
                            setBaseColorIndex(
                              (i) => (i + basePalette.length - 1) % basePalette.length,
                            )
                          }
                        >
                          <img src={ArrowLeft} alt="Prev Palette" width={22} height={30} />
                        </button>
                        <div className={styles.colorCircles}>
                          {shades.map((shade, idx) => (
                            <button
                              key={shade + idx}
                              type="button"
                              className={styles.colorCircleBtnWrapper}
                              onClick={() => setActiveShadeIndex(idx)}
                            >
                              <ColorBtn
                                size={idx === activeShadeIndex ? 45 : 32}
                                color={shade}
                                active={idx === activeShadeIndex}
                              />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={styles.colorArrowBtn}
                          onClick={() => setBaseColorIndex((i) => (i + 1) % basePalette.length)}
                        >
                          <img src={ArrowRight} alt="Next Palette" width={22} height={30} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {bottomExpandedFooter && (
                  <>
                    <div className={styles.topExpandedLeft}>
                      <div className={styles.topExpandedLeftInner}>
                        <button
                          type="button"
                          className={styles.topExpandedArrowsBtn}
                          onClick={cycleTopPrev}
                        >
                          <img src={ArrowLeft} alt="Prev" width={22} height={30} />
                        </button>
                        <div className={styles.topExpandedTextBlock}>
                          <div
                            className={styles.topExpandedMain}
                          >{`Option ${topOptionIndex + 1}`}</div>
                          <div className={styles.topExpandedSub}>{topOptions[topOptionIndex]}</div>
                        </div>
                        <button
                          type="button"
                          className={styles.topExpandedArrowsBtn}
                          onClick={cycleTopNext}
                        >
                          <img src={ArrowRight} alt="Next" width={22} height={30} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.topExpandedRight}>
                      <div className={styles.topExpandedColorsInner}>
                        <button
                          type="button"
                          className={styles.colorArrowBtn}
                          onClick={() =>
                            setBaseColorIndex(
                              (i) => (i + basePalette.length - 1) % basePalette.length,
                            )
                          }
                        >
                          <img src={ArrowLeft} alt="Prev Palette" width={22} height={30} />
                        </button>
                        <div className={styles.colorCircles}>
                          {shades.map((shade, idx) => (
                            <button
                              key={shade + idx}
                              type="button"
                              className={styles.colorCircleBtnWrapper}
                              onClick={() => setActiveShadeIndex(idx)}
                            >
                              <ColorBtn
                                size={idx === activeShadeIndex ? 45 : 32}
                                color={shade}
                                active={idx === activeShadeIndex}
                              />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={styles.colorArrowBtn}
                          onClick={() => setBaseColorIndex((i) => (i + 1) % basePalette.length)}
                        >
                          <img src={ArrowRight} alt="Next Palette" width={22} height={30} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {!topExpandedFooter && !bottomExpandedFooter && !fullBodyMode && (
                  <div className={styles.footerLeft}>
                    <div className={styles.titleBox}>
                      {bottomOpen
                        ? 'FALCON LEATHER AVIATOR PANTS'
                        : 'FALCON LEATHER AVIATOR JACKET'}
                    </div>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.topButton}`}
                      onClick={() => {
                        setTopOpen((o) => !o)
                        if (bottomOpen) setBottomOpen(false)
                        setTopExpandedFooter((t) => !t)
                        if (bottomExpandedFooter) setBottomExpandedFooter(false)
                      }}
                    >
                      TOP
                    </button>
                  </div>
                )}
                {!topExpandedFooter && !bottomExpandedFooter && !fullBodyMode && (
                  <div className={styles.footerRight}>
                    <button
                      type="button"
                      className={`${styles.footerButton} ${styles.botButton}`}
                      onClick={() => {
                        setBottomOpen((o) => !o)
                        if (topOpen) setTopOpen(false)
                        setBottomExpandedFooter((b) => !b)
                        if (topExpandedFooter) setTopExpandedFooter(false)
                      }}
                    >
                      BOT
                    </button>
                    <div className={styles.infoBox}>BOSS DYN 01</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}