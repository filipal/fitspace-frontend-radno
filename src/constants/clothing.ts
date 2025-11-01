/* import FalconIcon from '../assets/falcon-icon.svg'
import ShellIcon from '../assets/shell-uh03.svg'
import MilitaryJacket from '../assets/military-jacket.png'
import Hoodie from '../assets/hoodie.png' */
import TommyTokyo from '../assets/virtualtryon/tops/tommy_tokyo.png'
import MikeRedSkull from '../assets/virtualtryon/tops/mike_red_skull_1.png'
import MikeMotoWing from '../assets/virtualtryon/tops/mike_moto_wing_1.png'
import MikeDontDie from '../assets/virtualtryon/tops/mike_dont_die.png'
import LukeTokyo from '../assets/virtualtryon/tops/luke_tokyo.png'
import LukeDontDie from '../assets/virtualtryon/tops/luke_dont_die.png'
import AlexRunaAcid from '../assets/virtualtryon/tops/alex_runa_acid.png'
import AirTateJacket from '../assets/virtualtryon/tops/air_tate_jacket.png'
import CapoCor02 from '../assets/virtualtryon/tops/capo_cor_02.png'
import CapoCor03 from '../assets/virtualtryon/tops/capo_cor_03.png'
import FalconLeatherAviatorJacket from '../assets/virtualtryon/tops/falcon_leather_aviator_jacket.png'
import HuskyJacket from '../assets/virtualtryon/tops/husky_jacket.png'
import M65WpJacket from '../assets/virtualtryon/tops/m65_wp_jacket.png'
import TatamiLt01 from '../assets/virtualtryon/tops/tatami_lt_01.png'
import TwinLeatherJacket from '../assets/virtualtryon/tops/twin_leather_jacket.png'
import BiaBlack from '../assets/virtualtryon/tops/bia_black.png'
import BiaGrey from '../assets/virtualtryon/tops/bia_grey.png'
import BaseLayersTop3 from '../assets/virtualtryon/tops/baseLayers_top_3.png'
import CommandoUhBlack from '../assets/virtualtryon/tops/commando_uh_black.png'
import CommandoUhGrey from '../assets/virtualtryon/tops/commando_uh_grey.png'
import ShellUh03 from '../assets/virtualtryon/tops/shell_uh_03.png'
import ShellWwBlack02 from '../assets/virtualtryon/tops/shell_ww_black_02.png'
import JohnSkull01 from '../assets/virtualtryon/tops/john_skull_01.png'
import MaxDontDie from '../assets/virtualtryon/tops/max_dont_die.png'
import MaxPain from '../assets/virtualtryon/tops/max_pain.png'
import MaxTokyo from '../assets/virtualtryon/tops/max_tokyo.png'
import BossDyn01 from '../assets/boss-dyn01.png'
import Pants1 from '../assets/pants-1.png'
import Pants2 from '../assets/pants-2.png'
import Pants3 from '../assets/pants-3.png'
import Pants4 from '../assets/pants-4.png'
import Pants5 from '../assets/pants-5.png'
import ArnieSlim from '../assets/virtualtryon/bottoms/arnie_slim.png'
import BossDyn01Jeans from '../assets/virtualtryon/bottoms/boss_dyn_01.png'
import CasualRobby03 from '../assets/virtualtryon/bottoms/casual_robby_03.png'
import DesertCargo from '../assets/virtualtryon/bottoms/desert_cargo.png'
import JamesRegular from '../assets/virtualtryon/bottoms/james_regular.png'
import KarlDevil9 from '../assets/virtualtryon/bottoms/karl_devil_9.png'
import KarlDevilAaa from '../assets/virtualtryon/bottoms/karl_devil_aaa.png'
import KarldoSlim from '../assets/virtualtryon/bottoms/karldo_slim.png'
import MarkAaa from '../assets/virtualtryon/bottoms/mark_aaa.png'
import MarkKev02 from '../assets/virtualtryon/bottoms/mark_kev_02.png'
import RobbyArm01 from '../assets/virtualtryon/bottoms/robby_arm_01.png'
import RobbyArm02 from '../assets/virtualtryon/bottoms/robby_arm_02.png'
import RobbySlim from '../assets/virtualtryon/bottoms/robby_slim.png'
import Steel02 from '../assets/virtualtryon/bottoms/steel_02.png'
import SkinUh03 from '../assets/virtualtryon/bottoms/skin_uh_03.png'
import SkinUhAaa from '../assets/virtualtryon/bottoms/skin_uh_aaa.png'
import ApexSneakers from '../assets/virtualtryon/bottoms/apex_sneakers.png'

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
  /**
   * Izvorno ime asseta (bez ekstenzije) koje koristimo za prikaz teksta.
   */
  name: string
}

type ClothingCatalog = Record<ClothingCategory, ClothingItemConfig[]>

const clothingCatalog: ClothingCatalog = {
  top: [
    { itemId: 0, subCategory: 'T-Shirts', asset: TommyTokyo, name: 'tommy_tokyo' },
    { itemId: 1, subCategory: 'T-Shirts', asset: MikeRedSkull, name: 'mike_red_skull_1' },
    { itemId: 2, subCategory: 'T-Shirts', asset: MikeMotoWing, name: 'mike_moto_wing_1' },
    { itemId: 3, subCategory: 'T-Shirts', asset: MikeDontDie, name: 'mike_dont_die' },
    { itemId: 4, subCategory: 'T-Shirts', asset: LukeTokyo, name: 'luke_tokyo' },
    { itemId: 5, subCategory: 'T-Shirts', asset: LukeDontDie, name: 'luke_dont_die' },
    { itemId: 6, subCategory: 'T-Shirts', asset: AlexRunaAcid, name: 'alex_runa_acid' },
    { itemId: 7, subCategory: 'Jackets', asset: AirTateJacket, name: 'air_tate_jacket' },
    { itemId: 8, subCategory: 'Jackets', asset: CapoCor02, name: 'capo_cor_02' },
    { itemId: 9, subCategory: 'Jackets', asset: CapoCor03, name: 'capo_cor_03' },
    {
      itemId: 10,
      subCategory: 'Jackets',
      asset: FalconLeatherAviatorJacket,
      name: 'falcon_leather_aviator_jacket',
    },
    { itemId: 11, subCategory: 'Jackets', asset: HuskyJacket, name: 'husky_jacket' },
    { itemId: 12, subCategory: 'Jackets', asset: M65WpJacket, name: 'm65_wp_jacket' },
    { itemId: 13, subCategory: 'Jackets', asset: TatamiLt01, name: 'tatami_lt_01' },
    { itemId: 14, subCategory: 'Jackets', asset: TwinLeatherJacket, name: 'twin_leather_jacket' },
    { itemId: 15, subCategory: 'Base Layer', asset: BiaBlack, name: 'bia_black' },
    { itemId: 16, subCategory: 'Base Layer', asset: BiaGrey, name: 'bia_grey' },
    { itemId: 17, subCategory: 'Base Layer', asset: BaseLayersTop3, name: 'baseLayers_top_3' },
    { itemId: 18, subCategory: 'Base Layer', asset: CommandoUhBlack, name: 'commando_uh_black' },
    { itemId: 19, subCategory: 'Base Layer', asset: CommandoUhGrey, name: 'commando_uh_grey' },
    { itemId: 20, subCategory: 'Base Layer', asset: ShellUh03, name: 'shell_uh_03' },
    { itemId: 21, subCategory: 'Base Layer', asset: ShellWwBlack02, name: 'shell_ww_black_02' },
    { itemId: 22, subCategory: 'Hoodies', asset: JohnSkull01, name: 'john_skull_01' },
    { itemId: 23, subCategory: 'Hoodies', asset: MaxDontDie, name: 'max_dont_die' },
    { itemId: 24, subCategory: 'Hoodies', asset: MaxPain, name: 'max_pain' },
    { itemId: 25, subCategory: 'Hoodies', asset: MaxTokyo, name: 'max_tokyo' },
  ],
  bottom: [
    { itemId: 0, subCategory: 'Pants', asset: BossDyn01, name: 'pants_falcon' },
    { itemId: 1, subCategory: 'Pants', asset: Pants1, name: 'pants_1' },
    { itemId: 2, subCategory: 'Pants', asset: Pants2, name: 'pants_2' },
    { itemId: 3, subCategory: 'Pants', asset: Pants3, name: 'pants_3' },
    { itemId: 4, subCategory: 'Pants', asset: Pants4, name: 'pants_4' },
    { itemId: 5, subCategory: 'Pants', asset: Pants5, name: 'pants_5' },
    { itemId: 6, subCategory: 'Jeans', asset: ArnieSlim, name: 'arnie_slim' },
    { itemId: 7, subCategory: 'Jeans', asset: BossDyn01Jeans, name: 'boss_dyn_01' },
    { itemId: 8, subCategory: 'Jeans', asset: CasualRobby03, name: 'casual_robby_03' },
    { itemId: 9, subCategory: 'Jeans', asset: DesertCargo, name: 'desert_cargo' },
    { itemId: 10, subCategory: 'Jeans', asset: JamesRegular, name: 'james_regular' },
    { itemId: 11, subCategory: 'Jeans', asset: KarlDevil9, name: 'karl_devil_9' },
    { itemId: 12, subCategory: 'Jeans', asset: KarlDevilAaa, name: 'karl_devil_aaa' },
    { itemId: 13, subCategory: 'Jeans', asset: KarldoSlim, name: 'karldo_slim' },
    { itemId: 14, subCategory: 'Jeans', asset: MarkAaa, name: 'mark_aaa' },
    { itemId: 15, subCategory: 'Jeans', asset: MarkKev02, name: 'mark_kev_02' },
    { itemId: 16, subCategory: 'Jeans', asset: RobbyArm01, name: 'robby_arm_01' },
    { itemId: 17, subCategory: 'Jeans', asset: RobbyArm02, name: 'robby_arm_02' },
    { itemId: 18, subCategory: 'Jeans', asset: RobbySlim, name: 'robby_slim' },
    { itemId: 19, subCategory: 'Jeans', asset: Steel02, name: 'steel_02' },
    { itemId: 20, subCategory: 'Base Layer', asset: SkinUh03, name: 'skin_uh_03' },
    { itemId: 21, subCategory: 'Base Layer', asset: SkinUhAaa, name: 'skin_uh_aaa' },
    { itemId: 22, subCategory: 'Boots', asset: ApexSneakers, name: 'apex_sneakers' },
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
    const lower = subCategory.toLowerCase()
    if (!seen.has(lower)) {
      orderedSubCategories.push(subCategory)
      seen.add(lower)
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

export interface ClothingOption extends ClothingItemConfig {
  index: number
}

export const getClothingOptionsForSubCategory = (
  category: ClothingCategory,
  subCategory: string,
): ClothingOption[] => {
  const lowerDesired = subCategory.toLowerCase()

  return clothingCatalog[category]
    .map((item, index) => ({ ...item, index }))
    .filter(({ subCategory: entrySubCategory }) => entrySubCategory.toLowerCase() === lowerDesired)
}