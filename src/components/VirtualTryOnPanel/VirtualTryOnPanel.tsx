import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
  type CSSProperties,
} from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../Header/Header'
import { usePixelStreaming } from '../../context/PixelStreamingContext'
import { useAvatarConfiguration } from '../../context/AvatarConfigurationContext'
import type { AvatarClothingSelection } from '../../context/AvatarConfigurationContext'
import { PixelStreamingView } from '../PixelStreamingView/PixelStreamingView'
// Using ?react variants for unified styling
import avatarBg from '../../assets/male-avatar.png'
import avatarsButton from '../../assets/avatar-button.svg'
import ArrowLeft from '../../assets/arrow-left.svg'
import ArrowRight from '../../assets/arrow-right.svg'
import styles from './VirtualTryOnPanel.module.scss'
import ColorBtn from '../ColorBtn/ColorBtn'
import RLeft from '../../assets/r-left.svg?react'
import RRight from '../../assets/r-right.svg?react'
import TopZoom from '../../assets/tops-detailed-zoom.svg?react'
import BottomZoom from '../../assets/bottoms-detailed-zoom.svg?react'
import DownloadIcon from '../../assets/download.svg?react'
import UploadIcon from '../../assets/upload.svg?react'
import FullScreenIcon from '../../assets/full-screen.svg?react'
import HomeButton from '../../assets/home-button.svg?react'
import TopAccordion from '../TopAccordion/TopAccordion'
import BottomAccordion from '../BottomAccordion/BottomAccordion'
import CartButton from '../../assets/cart-button.svg'
import cartIcon from '../../assets/cart.svg'
import AddToCartIcon from '../../assets/add-to-cart.svg'
import FullBodyButton from '../../assets/full-body-button.svg'
import TopBotButton from '../../assets/top-bot-button.svg'
import AnimationButton from '../../assets/animation-button.svg'
import HeatMapButton from '../../assets/heat-map-button.svg'
import TensionMapButton from '../../assets/tension-map-button.svg'
import {
  type ClothingCategory,
  getClothingCatalog,
  getClothingIdentifierForIndex,
  getClothingSubCategoryList,
} from '../../constants/clothing'
import ArrowUp from '../../assets/arrow-up.svg'
import ArrowDown from '../../assets/arrow-down.svg'
import { useQueuedUnreal } from '../../services/queuedUnreal'
import { useAuthData } from '../../hooks/useAuthData'
import {
  getAvatarColorShades,
  matchAvatarColorShade,
  resolveAvatarColorById,
  resolveAvatarColorShade,
} from '../../constants/avatarColors'

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

const catalog = getClothingCatalog()
const upperCategories = getClothingSubCategoryList('top')
const lowerCategories = getClothingSubCategoryList('bottom')

const DESIGN_WIDTH = 430
const toCqw = (px: number) => (px === 0 ? '0' : `calc(${px} / ${DESIGN_WIDTH} * 100cqw)`)

const DEFAULT_COLOR_STATE = { paletteIndex: 2, shadeIndex: 1 } as const

const SIZE_SEQUENCE = ['SX', 'S', 'M', 'L', 'XL', 'XXL'] as const
const DEFAULT_TOP_SIZE_INDEX = 2
const BOTTOM_SIZES = [
  { w: 28, l: 30 },
  { w: 29, l: 30 },
  { w: 30, l: 30 },
  { w: 31, l: 32 },
  { w: 32, l: 32 },
  { w: 33, l: 32 },
  { w: 34, l: 32 },
] as const
const DEFAULT_BOTTOM_SIZE_INDEX = 3

const normalizeFiniteInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }

  return null
}

const resolveTopSizeIndex = (
  selection: AvatarClothingSelection | null | undefined,
): number => {
  const label = selection?.sizeLabel
  if (typeof label === 'string' && label.trim().length) {
    const normalized = label.trim().toUpperCase()
    const matchIndex = SIZE_SEQUENCE.findIndex(
      entry => entry.toUpperCase() === normalized,
    )
    if (matchIndex >= 0) {
      return matchIndex
    }
  }

  return DEFAULT_TOP_SIZE_INDEX
}

const resolveBottomSizeIndex = (
  selection: AvatarClothingSelection | null | undefined,
): number => {
  const waist = normalizeFiniteInteger(selection?.bottomWaist ?? null)
  const length = normalizeFiniteInteger(selection?.bottomLength ?? null)
  if (waist != null && length != null) {
    const matchIndex = BOTTOM_SIZES.findIndex(
      size => size.w === waist && size.l === length,
    )
    if (matchIndex >= 0) {
      return matchIndex
    }
  }

  return DEFAULT_BOTTOM_SIZE_INDEX
}

const resolveInitialColorState = (
  selection: AvatarClothingSelection | null | undefined,
): { paletteIndex: number; shadeIndex: number } => {
  if (!selection) {
    return { ...DEFAULT_COLOR_STATE }
  }

  if (
    selection.colorPaletteIndex != null &&
    selection.colorShadeIndex != null
  ) {
    const resolved = resolveAvatarColorShade(
      selection.colorPaletteIndex,
      selection.colorShadeIndex,
    )
    return { paletteIndex: resolved.paletteIndex, shadeIndex: resolved.shadeIndex }
  }

  if (selection.colorId != null) {
    const resolvedById = resolveAvatarColorById(selection.colorId)
    if (resolvedById) {
      return { paletteIndex: resolvedById.paletteIndex, shadeIndex: resolvedById.shadeIndex }
    }
  }

  const matched = matchAvatarColorShade(selection.colorHex ?? null)
  if (matched) {
    return { paletteIndex: matched.paletteIndex, shadeIndex: matched.shadeIndex }
  }

  return { ...DEFAULT_COLOR_STATE }
}

export interface VirtualTryOnHeaderState {
  title: string
  showCartButton: boolean
}

export interface VirtualTryOnPanelProps {
  embedded?: boolean
  onRequestExit?: () => void
  onRequestAvatarList?: () => void
  onHeaderStateChange?: (state: VirtualTryOnHeaderState) => void
}

function VirtualTryOnPanel({
  embedded = false,
  onRequestExit,
  onRequestAvatarList,
  onHeaderStateChange,
}: VirtualTryOnPanelProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthData()
  const { updateClothingSelection, currentAvatar } = useAvatarConfiguration()
  const clothingSelections = currentAvatar?.clothingSelections ?? null

  const handleExit = useCallback(() => {
    if (embedded) {
      onRequestExit?.()
    } else if (isAuthenticated) {
      navigate('/')
    } else {
      navigate('/exit-guest-user')
    }
  }, [embedded, isAuthenticated, navigate, onRequestExit])

  const handleAvatarClick = useCallback(() => {
    if (embedded) {
      const fallback = onRequestAvatarList ?? onRequestExit
      fallback?.()
    } else {
      navigate('/')
    }
  }, [embedded, navigate, onRequestAvatarList, onRequestExit])
  const { sendFitSpaceCommand, connectionState, application, devMode } = usePixelStreaming()

  const simpleState = useMemo<'connected' | 'connecting' | 'disconnected'>(() => {
    return connectionState === 'connected'
      ? 'connected'
      : connectionState === 'connecting'
        ? 'connecting'
        : 'disconnected'
  }, [connectionState])

  const sendQueued = useQueuedUnreal(sendFitSpaceCommand, simpleState)

  const findClothingIndex = useCallback(
    (
      category: ClothingCategory,
      selection: { itemId: number; subCategory?: string | null } | null,
    ): number | null => {
      if (!selection) return null
      const items = catalog[category]
      const normalizedSubCategory = selection.subCategory?.toLowerCase() ?? null
      const preciseMatch = items.findIndex(item => {
        const sameItem = Number(item.itemId) === Number(selection.itemId)
        const sameSubCategory = normalizedSubCategory
          ? item.subCategory.toLowerCase() === normalizedSubCategory
          : true
        return sameItem && sameSubCategory
      })
      if (preciseMatch >= 0) return preciseMatch
      const fallbackMatch = items.findIndex(
        item => Number(item.itemId) === Number(selection.itemId),
      )
      return fallbackMatch >= 0 ? fallbackMatch : null
    },
    [],
  )

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
  const [topOptionIndex, setTopOptionIndex] = useState(() => {
    const selection = currentAvatar?.clothingSelections?.top ?? null
    const index = findClothingIndex('top', selection)
    return index ?? 0
  }) // Option 1..5 => indices 0..4
  const topOptions = ['with armor', 'option 2', 'option 3', 'option 4', 'option 5']
  const [bottomOptionIndex, setBottomOptionIndex] = useState(() => {
    const selection = currentAvatar?.clothingSelections?.bottom ?? null
    const index = findClothingIndex('bottom', selection)
    return index ?? 0
  })
  const bottomOptions = ['tapered fit', 'regular fit', 'loose fit', 'boot cut', 'straight fit']
  const topClothingSelection = currentAvatar?.clothingSelections?.top ?? null
  const bottomClothingSelection = currentAvatar?.clothingSelections?.bottom ?? null
  const [baseColorIndex, setBaseColorIndex] = useState(() =>
    resolveInitialColorState(topClothingSelection).paletteIndex,
  )
  const [activeShadeIndex, setActiveShadeIndex] = useState(() =>
    resolveInitialColorState(topClothingSelection).shadeIndex,
  )
  useEffect(() => {
    const state = resolveInitialColorState(topClothingSelection)
    setBaseColorIndex(prev => (prev === state.paletteIndex ? prev : state.paletteIndex))
    setActiveShadeIndex(prev => (prev === state.shadeIndex ? prev : state.shadeIndex))
  }, [topClothingSelection])

  const [sizeCenterIdx, setSizeCenterIdx] = useState(() =>
    resolveTopSizeIndex(topClothingSelection),
  )
  const [bottomSizeCenterIdx, setBottomSizeCenterIdx] = useState(() =>
    resolveBottomSizeIndex(bottomClothingSelection),
  )

  useEffect(() => {
    const nextIndex = resolveTopSizeIndex(topClothingSelection)
    setSizeCenterIdx(prev => (prev === nextIndex ? prev : nextIndex))
  }, [topClothingSelection])

  useEffect(() => {
    const nextIndex = resolveBottomSizeIndex(bottomClothingSelection)
    setBottomSizeCenterIdx(prev => (prev === nextIndex ? prev : nextIndex))
  }, [bottomClothingSelection])

  const sizeSequence = SIZE_SEQUENCE
  const sizeAbove = sizeSequence[(sizeCenterIdx - 1 + sizeSequence.length) % sizeSequence.length]
  const sizeMain = sizeSequence[sizeCenterIdx]
  const sizeBelow = sizeSequence[(sizeCenterIdx + 1) % sizeSequence.length]

  const bottomSizes = BOTTOM_SIZES
  const bottomSizeAbove =
    bottomSizes[(bottomSizeCenterIdx - 1 + bottomSizes.length) % bottomSizes.length]
  const bottomSizeMain = bottomSizes[bottomSizeCenterIdx]
  const bottomSizeBelow = bottomSizes[(bottomSizeCenterIdx + 1) % bottomSizes.length]

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
    const resolvedTopIndex = findClothingIndex('top', topClothingSelection)
    if (resolvedTopIndex != null) {
      setTopOptionIndex(prev => (prev === resolvedTopIndex ? prev : resolvedTopIndex))
      setJacketIndex(prev => (prev === resolvedTopIndex ? prev : resolvedTopIndex))
    }
    if (topClothingSelection?.subCategory) {
      const normalizedTopSub = topClothingSelection.subCategory.toLowerCase()
      const categoryIndex = upperCategories.findIndex(
        entry => entry.toLowerCase() === normalizedTopSub,
      )
      if (categoryIndex >= 0) {
        setUpperCenterIdx(prev => (prev === categoryIndex ? prev : categoryIndex))
      }
    }

    const resolvedBottomIndex = findClothingIndex('bottom', bottomClothingSelection)
    if (resolvedBottomIndex != null) {
      setBottomOptionIndex(prev => (prev === resolvedBottomIndex ? prev : resolvedBottomIndex))
      setPantsIndex(prev => (prev === resolvedBottomIndex ? prev : resolvedBottomIndex))
    }
    if (bottomClothingSelection?.subCategory) {
      const normalizedBottomSub = bottomClothingSelection.subCategory.toLowerCase()
      const categoryIndex = lowerCategories.findIndex(
        entry => entry.toLowerCase() === normalizedBottomSub,
      )
      if (categoryIndex >= 0) {
        setLowerCenterIdx(prev => (prev === categoryIndex ? prev : categoryIndex))
      }
    }
  }, [topClothingSelection, bottomClothingSelection, findClothingIndex])

  const shouldShrinkCategoryText = (text: string) => text.trim().length >= 10
  const sendClothingSelection = useCallback(
    (category: ClothingCategory, itemIndex: number, overrideSubCategory?: string) => {
      const { itemId, subCategory } = getClothingIdentifierForIndex(category, itemIndex)
      const effectiveSubCategory = overrideSubCategory ?? subCategory
      const label = `selectClothing/${category}/${effectiveSubCategory ?? itemId}`

      sendQueued(
        'selectClothing',
        {
          category,
          subCategory: effectiveSubCategory,
          itemId,
        },
        label,
      )
      const sizePayload =
        category === 'top'
          ? { sizeLabel: sizeSequence[sizeCenterIdx] }
          : {
              bottomWaist: bottomSizes[bottomSizeCenterIdx].w,
              bottomLength: bottomSizes[bottomSizeCenterIdx].l,
            }

      updateClothingSelection(category, {
        itemId,
        subCategory: effectiveSubCategory,
        ...sizePayload,
      })
      console.log(
        `Queued selectClothing command: itemId=${itemId}, category=${category}, subCategory=${effectiveSubCategory}`,
      )
    },
    [
      bottomSizeCenterIdx,
      bottomSizes,
      sendQueued,
      sizeCenterIdx,
      sizeSequence,
      updateClothingSelection,
    ],
  )

  const getSelectionIdentifier = useCallback(
    (category: ClothingCategory) => {
      const existingSelection = clothingSelections?.[category] ?? null
      const selectionIndex = findClothingIndex(category, existingSelection)
      const fallbackIndex =
        selectionIndex != null
          ? selectionIndex
          : category === 'top'
            ? topOptionIndex
            : bottomOptionIndex

      return getClothingIdentifierForIndex(category, fallbackIndex)
    },
    [bottomOptionIndex, clothingSelections, findClothingIndex, topOptionIndex],
  )

  const persistClothingSelectionUpdates = useCallback(
    (category: ClothingCategory, updates: Partial<AvatarClothingSelection>) => {
      const existing = clothingSelections?.[category] ?? null
      const baseSelection = existing
        ? { ...existing }
        : { ...getSelectionIdentifier(category) }

      updateClothingSelection(category, { ...baseSelection, ...updates })
    },
    [clothingSelections, getSelectionIdentifier, updateClothingSelection],
  )

  const applyClothingColor = useCallback(
    (category: ClothingCategory, paletteIndex: number, shadeIndex: number) => {
      const resolved = resolveAvatarColorShade(paletteIndex, shadeIndex)
      const { itemId, subCategory } = getSelectionIdentifier(category)

      sendQueued(
        'selectClothing',
        {
          category,
          subCategory,
          itemId,
          colorHex: resolved.colorHex,
        },
        `selectClothing/${category}/${subCategory ?? itemId}/color`,
      )

      updateClothingSelection(category, {
        itemId,
        subCategory,
        colorHex: resolved.colorHex,
        colorPaletteIndex: resolved.paletteIndex,
        colorShadeIndex: resolved.shadeIndex,
        colorId: resolved.colorId,
      })

      console.log(
        `Queued selectClothing color: itemId=${itemId}, category=${category}, palette=${resolved.paletteIndex}, shade=${resolved.shadeIndex}, color=${resolved.colorHex}`,
      )

      return resolved
    },
    [getSelectionIdentifier, sendQueued, updateClothingSelection],
  )

  const handlePaletteShift = useCallback(
    (category: ClothingCategory, direction: 1 | -1) => {
      const resolved = applyClothingColor(category, baseColorIndex + direction, activeShadeIndex)
      setBaseColorIndex(resolved.paletteIndex)
      setActiveShadeIndex(resolved.shadeIndex)
    },
    [activeShadeIndex, applyClothingColor, baseColorIndex],
  )

  const handleShadeSelect = useCallback(
    (category: ClothingCategory, shadeIdx: number) => {
      const resolved = applyClothingColor(category, baseColorIndex, shadeIdx)
      setBaseColorIndex(resolved.paletteIndex)
      setActiveShadeIndex(resolved.shadeIndex)
    },
    [applyClothingColor, baseColorIndex],
  )

  const cycleShade = useCallback(
    (category: ClothingCategory) => {
      const resolved = applyClothingColor(category, baseColorIndex, activeShadeIndex + 1)
      setBaseColorIndex(resolved.paletteIndex)
      setActiveShadeIndex(resolved.shadeIndex)
    },
    [activeShadeIndex, applyClothingColor, baseColorIndex],
  )

  const cycleSize = (dir: 1 | -1) => {
    setSizeCenterIdx((i) => {
      const nextIndex = (i + dir + sizeSequence.length) % sizeSequence.length
      const sizeLabel = sizeSequence[nextIndex]
      persistClothingSelectionUpdates('top', { sizeLabel })
      return nextIndex
    })
  }

  const cycleBottomSize = (dir: 1 | -1) => {
    setBottomSizeCenterIdx((i) => {
      const nextIndex = (i + dir + bottomSizes.length) % bottomSizes.length
      const selection = bottomSizes[nextIndex]
      persistClothingSelectionUpdates('bottom', {
        bottomWaist: selection.w,
        bottomLength: selection.l,
      })
      return nextIndex
    })
  }

  const cycleTopPrev = () => {
    setTopOptionIndex((i) => {
      const newIndex = (i + 5 - 1) % 5
      sendClothingSelection('top', newIndex)
      return newIndex
    })
  }
  const cycleTopNext = () => {
    setTopOptionIndex((i) => {
      const newIndex = (i + 1) % 5
      sendClothingSelection('top', newIndex)
      return newIndex
    })
  }
  const cycleBottomPrev = () => {
    setBottomOptionIndex((i) => {
      const newIndex = (i + bottomOptions.length - 1) % bottomOptions.length
      sendClothingSelection('bottom', newIndex)
      return newIndex
    })
  }
  const cycleBottomNext = () => {
    setBottomOptionIndex((i) => {
      const newIndex = (i + 1) % bottomOptions.length
      sendClothingSelection('bottom', newIndex)
      return newIndex
    })
  }
  // Color group behaves like SkinAccordion iconsThree (light/base/dark) with center selectable enlargement
  const shades = useMemo(() => getAvatarColorShades(baseColorIndex), [baseColorIndex])

  // Category selector groups (upper & lower) with cyclic scrolling via arrows
  const [upperCenterIdx, setUpperCenterIdx] = useState(1) // 'Jackets'
  const [lowerCenterIdx, setLowerCenterIdx] = useState(1) // 'Jeans'
  const cycleUpper = (dir: 1 | -1) => {
    setUpperCenterIdx((i) => {
      const newIndex = (i + dir + upperCategories.length) % upperCategories.length
      // Pošalji selectClothing prema odabranoj potkategoriji gornjeg dijela
      sendClothingSelection('top', newIndex, upperCategories[newIndex])
      return newIndex
    })
  }
  const cycleLower = (dir: 1 | -1) => {
    setLowerCenterIdx((i) => {
      const newIndex = (i + dir + lowerCategories.length) % lowerCategories.length
      // Pošalji selectClothing prema odabranoj potkategoriji donjeg dijela
      sendClothingSelection('bottom', newIndex, lowerCategories[newIndex])
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
  const topCategoryWrapped = isDesktop && shouldShrinkCategoryText(upperMain)
  const bottomCategoryWrapped = isDesktop && shouldShrinkCategoryText(lowerMain)

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
  const { jacketImages, pantsImages } = useMemo(() => {
    const topAssets = catalog.top.map(item => item.asset)
    const bottomAssets = catalog.bottom.map(item => item.asset)

    return {
      jacketImages: topAssets.length > 0 ? topAssets : [''],
      pantsImages: bottomAssets.length > 0 ? bottomAssets : [''],
    }
  }, [])
  const [jacketIndex, setJacketIndex] = useState(() => {
    const selection = currentAvatar?.clothingSelections?.top ?? null
    const index = findClothingIndex('top', selection)
    return index ?? 0
  })
  const [pantsIndex, setPantsIndex] = useState(() => {
    const selection = currentAvatar?.clothingSelections?.bottom ?? null
    const index = findClothingIndex('bottom', selection)
    return index ?? 0
  })
  const cycleJackets = (dir: 1 | -1) => {
    setJacketIndex((i) => {
      const newIndex = (i + dir + jacketImages.length) % jacketImages.length
      // Pošalji selectClothing uz centralizirane identifikatore za gornji dio
      sendClothingSelection('top', newIndex)
      return newIndex
    })
  }
  const cyclePants = (dir: 1 | -1) => {
    setPantsIndex((i) => {
      const newIndex = (i + dir + pantsImages.length) % pantsImages.length
      // Pošalji selectClothing uz centralizirane identifikatore za donji dio
      sendClothingSelection('bottom', newIndex)
      return newIndex
    })
  }

  // Size selector (shown in right upper arrows when topExpandedFooter)
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
          sendFitSpaceCommand('rotateCamera', { direction: 'left', speed: 1 })
          console.log('Sent rotate left command')
          break
        case 'upload':
          sendFitSpaceCommand('zoomCamera', { direction: 'in', amount: 0.1 })
          console.log('Sent zoom in command')
          break
        case 'fullscreen':
          console.log('Fullscreen button clicked - no command defined yet')
          break
        case 'download':
          sendFitSpaceCommand('moveCamera', { direction: 'up', amount: 0.1 })
          console.log('Sent move camera command')
          break
        case 'rotate-right':
          sendFitSpaceCommand('rotateCamera', { direction: 'right', speed: 1 })
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
                  sendFitSpaceCommand('rotateCamera', { direction: 'left', speed: 1 })
                  console.log('Sent rotate left command')
                }
                if (control.key === 'rotate-right' && connectionState === 'connected') {
                  sendFitSpaceCommand('rotateCamera', { direction: 'right', speed: 1 })
                  console.log('Sent rotate right command')
                }

                // Send pixel streaming commands for middle buttons
                if (control.key === 'top-zoom' && connectionState === 'connected') {
                  sendFitSpaceCommand('zoomCamera', { direction: 'in', amount: 0.1 })
                  console.log('Sent zoom camera command')
                }
                if (control.key === 'bottom-zoom' && connectionState === 'connected') {
                  sendFitSpaceCommand('moveCamera', { direction: 'up', amount: 0.1 })
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

  const renderDesktopColorSelector = (focus: 'top' | 'bottom') => (
    <div className={styles.desktopColorSelector}>
      <button
        type="button"
        className={styles.desktopVerticalArrow}
        onClick={() => handlePaletteShift(focus, -1)}
      >
        <img src={ArrowUp} alt="Previous palette" />
      </button>
      <button
        type="button"
        className={styles.desktopColorButton}
        onClick={() => cycleShade(focus)}
      >
        <ColorBtn size={45} color={shades[activeShadeIndex]} active />
      </button>
      <button
        type="button"
        className={styles.desktopVerticalArrow}
        onClick={() => handlePaletteShift(focus, 1)}
      >
        <img src={ArrowDown} alt="Next palette" />
      </button>
    </div>
  )

  const renderDesktopTopDetails = () => (
    <div className={styles.desktopFooterTopDetails}>
      <div className={styles.desktopFooterPriceGroup} aria-label="Price and cart">
        <div className={styles.desktopFooterPrice} aria-label="Price">
          $ 459
        </div>
        <img
          className={styles.desktopFooterAddToCart}
          src={AddToCartIcon}
          alt="Add to cart"
        />
      </div>
      <div className={styles.desktopFooterModelGroup} aria-label="Model details">
        <span className={styles.desktopFooterModel}>FALCON LEATHER</span>
        <span className={styles.desktopFooterProduct}>AVIATOR JACKET</span>
        <span className={styles.desktopFooterBrand}>Pando Moto</span>
      </div>
    </div>
  )

  const renderDesktopBottomDetails = () => (
    <div className={styles.desktopFooterBottomDetails}>
      <div className={styles.desktopFooterPriceGroup} aria-label="Price and cart">
        <div className={styles.desktopFooterPrice} aria-label="Price">
          $ 459
        </div>
        <img
          className={styles.desktopFooterAddToCart}
          src={AddToCartIcon}
          alt="Add to cart"
        />
      </div>
      <div className={styles.desktopFooterBottomInfo} aria-label="Product details">
        <span className={styles.desktopFooterBottomName}>BOSS DYN 01 JEANS</span>
        <span className={styles.desktopFooterBottomBrand}>Pando Moto</span>
      </div>
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
          <div className={styles.desktopFooterLeftBottom}>
            {focus === 'top' ? (
              renderDesktopTopDetails()
            ) : (
              renderDesktopBottomDetails()
            )}
          </div>
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
            <div className={styles.desktopFooterRightCol}>{renderDesktopColorSelector(focus)}</div>
            <div className={styles.desktopFooterRightCol}>
              {renderDesktopOptionSelector(focus)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderDesktopFullBodyFooter = () => (
    <div className={styles.desktopFullBodyFooter}>
      <div className={`${styles.desktopFooterHeading} ${styles.desktopFullBodyHeading}`}>
        FULL BODY
      </div>
      <div className={styles.desktopFullBodyRow}>
        <div className={`${styles.desktopFullBodyCol} ${styles.desktopFullBodySizeCol}`}>
          <div className={styles.desktopFullBodySizeSelector}>
            {renderDesktopSizeSelector('top')}
          </div>
        </div>
        <div className={`${styles.desktopFullBodyCol} ${styles.desktopFullBodyCategoryCol}`}>
          <div className={styles.desktopFullBodyCategoryInner}>
            <div
              className={`${styles.categoryArrows} ${styles.categoryArrowsFullBody} ${styles.desktopFullBodyCategoryArrows}`}
            >
              <button
                type="button"
                className={styles.categoryArrowBtn}
                onClick={() => cycleFullBody(-1)}
              >
                <img src={ArrowUp} alt="Previous category" />
              </button>
              <div
                className={`${styles.fullBodyCategory} ${styles.categoryTextGroupFullBody} ${styles.desktopFullBodyCategoryTexts}`}
              >
                <div className={styles.categoryTextTop}>{fbTop}</div>
                <div className={styles.categoryTextMain}>{fbMain}</div>
                <div className={styles.categoryTextBottom}>{fbBottom}</div>
              </div>
              <button
                type="button"
                className={styles.categoryArrowBtn}
                onClick={() => cycleFullBody(1)}
              >
                <img src={ArrowDown} alt="Next category" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.desktopFullBodyAccordion}>
        <TopAccordion variant="desktop" />
      </div>
      <div className={styles.desktopFullBodyDetails}>{renderDesktopTopDetails()}</div>
      <div className={styles.desktopFullBodyRowBottom}>
        <div className={`${styles.desktopFullBodyCol} ${styles.desktopFullBodyColorCol}`}>
          <div className={styles.desktopFullBodyColorSelector}>
            {renderDesktopColorSelector('top')}
          </div>
        </div>
        <div className={`${styles.desktopFullBodyCol} ${styles.desktopFullBodyOptionCol}`}>
          <div className={styles.desktopFullBodyOptionSelector}>
            {renderDesktopOptionSelector('top')}
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

  useEffect(() => {
    onHeaderStateChange?.({ title, showCartButton: isDesktop })
  }, [title, isDesktop, onHeaderStateChange])

  const headerRight = (
    <div className={styles.headerButtonGroup}>
      {isDesktop ? (
        <button className={styles.cartButton} type="button">
          <img src={cartIcon} alt="Cart" />
        </button>
      ) : null}
      <button
        className={styles.avatarButton}
        onClick={handleAvatarClick}
        type="button"
      >
        <img src={avatarsButton} alt="Avatars" />
      </button>
    </div>
  )

  const pageClassName = [
    styles.page,
    isDesktop ? styles.pageDesktop : '',
    embedded ? styles.embedded : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={pageClassName}>
      {!embedded && (
        <Header variant="dark" title={title} onExit={handleExit} rightContent={headerRight} />
      )}

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
              <img src={isDesktop ? TensionMapButton : HeatMapButton} alt="Tension Map" />
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

        <div
          className={`${styles.footerColumn} ${isDesktop ? styles.footerColumnDesktop : ''} ${
            isDesktop && fullBodyMode && !fullBodyDetail ? styles.footerColumnFullBody : ''
          }`}
        >
          <div
            className={`${styles.footer} ${
              topExpandedFooter
                ? styles.expandedTop
                : bottomExpandedFooter
                  ? styles.expandedBot
                  : fullBodyMode
                    ? styles.footerFullBody
                    : ''
            } ${isDesktop ? styles.desktopFooterRoot : ''} ${
              isDesktop && fullBodyMode && !fullBodyDetail
                ? styles.desktopFooterRootFullBody
                : ''
            }`}
          >
            {isDesktop ? (
              <div
                className={`${styles.desktopFooter} ${
                  fullBodyMode && !fullBodyDetail ? styles.desktopFooterFullBody : ''
                }`}
              >
                {fullBodyMode && !fullBodyDetail
                  ? renderDesktopFullBodyFooter()
                  : (['top', 'bottom'] as const).map((focus) =>
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
                          onClick={() => handlePaletteShift('top', -1)}
                        >
                          <img src={ArrowLeft} alt="Prev Palette" width={22} height={30} />
                        </button>
                        <div className={styles.colorCircles}>
                          {shades.map((shade, idx) => (
                            <button
                              key={shade + idx}
                              type="button"
                              className={styles.colorCircleBtnWrapper}
                              onClick={() => handleShadeSelect('top', idx)}
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
                          onClick={() => handlePaletteShift('top', 1)}
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
                          onClick={() => handlePaletteShift('bottom', -1)}
                        >
                          <img src={ArrowLeft} alt="Prev Palette" width={22} height={30} />
                        </button>
                        <div className={styles.colorCircles}>
                          {shades.map((shade, idx) => (
                            <button
                              key={shade + idx}
                              type="button"
                              className={styles.colorCircleBtnWrapper}
                              onClick={() => handleShadeSelect('bottom', idx)}
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
                          onClick={() => handlePaletteShift('bottom', 1)}
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

export default VirtualTryOnPanel