import FalconIcon from '../assets/falcon-icon.svg'
import ShellIcon from '../assets/shell-uh03.svg'
import MilitaryJacket from '../assets/military-jacket.png'
import Hoodie from '../assets/hoodie.png'
import BossDyn01 from '../assets/boss-dyn01.png'
import Pants1 from '../assets/pants-1.png'
import Pants2 from '../assets/pants-2.png'
import Pants3 from '../assets/pants-3.png'
import Pants4 from '../assets/pants-4.png'
import Pants5 from '../assets/pants-5.png'

export type ClothingCategory = 'top' | 'bottom'

export interface ClothingIdentifier {
  /**
   * Numerički identifikator artikla koji očekuje Unreal (0-1 za demo potrebe).
   */
  itemId: number
  /**
   * Logička potkategorija (npr. "Jackets", "Jeans"...).
   */
  subCategory: string
}

export interface ClothingItemConfig extends ClothingIdentifier {
  /**
   * Asset korišten u pojedinim UI komponentama (carousel, pregled, ...).
   */
  asset: string
}

type ClothingCatalog = Record<ClothingCategory, ClothingItemConfig[]>

const clothingCatalog: ClothingCatalog = {
  top: [
    { itemId: 0, subCategory: 'T-Shirts', asset: FalconIcon },
    { itemId: 1, subCategory: 'Jackets', asset: ShellIcon },
    { itemId: 0, subCategory: 'Base Layer', asset: MilitaryJacket },
    { itemId: 1, subCategory: 'Jackets', asset: Hoodie },
  ],
  bottom: [
    { itemId: 0, subCategory: 'Shorts', asset: BossDyn01 },
    { itemId: 1, subCategory: 'Jeans', asset: Pants1 },
    { itemId: 0, subCategory: 'Base Layer', asset: Pants2 },
    { itemId: 1, subCategory: 'Jeans', asset: Pants3 },
    { itemId: 0, subCategory: 'Shorts', asset: Pants4 },
    { itemId: 1, subCategory: 'Base Layer', asset: Pants5 },
  ],
}

export const getClothingCatalog = () => clothingCatalog

export const getClothingIdentifierForIndex = (
  category: ClothingCategory,
  index: number,
): ClothingIdentifier => {
  const items = clothingCatalog[category]
  if (!items.length) {
    return { itemId: 0, subCategory: 'default' }
  }

  const normalizedIndex = ((index % items.length) + items.length) % items.length
  const { itemId, subCategory } = items[normalizedIndex]

  return { itemId, subCategory }
}

export const getClothingAssetForIndex = (category: ClothingCategory, index: number): string => {
  const items = clothingCatalog[category]
  if (!items.length) {
    return ''
  }

  const normalizedIndex = ((index % items.length) + items.length) % items.length
  return items[normalizedIndex].asset
}

export const getClothingSubCategoryList = (category: ClothingCategory): string[] => {
  const seen = new Set<string>()
  const orderedSubCategories: string[] = []

  clothingCatalog[category].forEach(({ subCategory }) => {
    if (!seen.has(subCategory)) {
      orderedSubCategories.push(subCategory)
      seen.add(subCategory)
    }
  })

  return orderedSubCategories
}

export const getClothingIdentifierBySubCategory = (
  category: ClothingCategory,
  desiredSubCategory: string,
): ClothingIdentifier => {
  const lowerDesired = desiredSubCategory.toLowerCase()
  const match = clothingCatalog[category].find(
    ({ subCategory }) => subCategory.toLowerCase() === lowerDesired,
  )

  if (match) {
    return { itemId: match.itemId, subCategory: match.subCategory }
  }

  return getClothingIdentifierForIndex(category, 0)
}

export const getDefaultClothingSelection = (category: ClothingCategory): ClothingIdentifier =>
  getClothingIdentifierForIndex(category, 0)