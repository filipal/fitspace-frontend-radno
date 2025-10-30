import { darkenHex, lightenHex } from '../utils/color'

export interface AvatarBaseColor {
  /**
   * Deterministički identifikator boje koji se može koristiti kao stabilan ključ pri slanju prema UE/backendu.
   */
  id: number
  /**
   * Osnovni HEX ton iz kojeg deriviramo svjetlije i tamnije nijanse.
   */
  hex: string
}

export const AVATAR_BASE_COLORS: readonly AvatarBaseColor[] = [
  { id: 0, hex: '#f5e0d0' },
  { id: 1, hex: '#eac3a6' },
  { id: 2, hex: '#d7a381' },
  { id: 3, hex: '#b47b57' },
  { id: 4, hex: '#8a573b' },
  { id: 5, hex: '#5d3b2a' },
] as const

export const AVATAR_COLOR_SHADE_COUNT = 3 as const

export const SKIN_TONE_BASE_HEXES = AVATAR_BASE_COLORS.map(color => color.hex) as readonly string[]

export const CLOTHING_BASE_COLOR_HEXES = SKIN_TONE_BASE_HEXES

export type SkinToneBaseHex = typeof SKIN_TONE_BASE_HEXES[number]
export type ClothingBaseColorHex = typeof CLOTHING_BASE_COLOR_HEXES[number]

export const normalizeAvatarColorHex = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed.length) {
    return null
  }

  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!match) {
    return null
  }

  const [, hex] = match
  const expanded = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex
  return `#${expanded.toLowerCase()}`
}

export const getAvatarColorShades = (
  paletteIndex: number,
): readonly [string, string, string] => {
  const normalizedIndex = ((paletteIndex % AVATAR_BASE_COLORS.length) + AVATAR_BASE_COLORS.length) %
    AVATAR_BASE_COLORS.length
  const baseHex = AVATAR_BASE_COLORS[normalizedIndex]?.hex ?? AVATAR_BASE_COLORS[0].hex
  return [lightenHex(baseHex), baseHex, darkenHex(baseHex)] as const
}

export interface AvatarColorShade {
  paletteIndex: number
  shadeIndex: number
  colorHex: string
  colorId: number
  shades: readonly [string, string, string]
}

export const resolveAvatarColorShade = (
  paletteIndex: number,
  shadeIndex: number,
): AvatarColorShade => {
  const shades = getAvatarColorShades(paletteIndex)
  const normalizedPaletteIndex = ((paletteIndex % AVATAR_BASE_COLORS.length) + AVATAR_BASE_COLORS.length) %
    AVATAR_BASE_COLORS.length
  const normalizedShadeIndex = ((shadeIndex % AVATAR_COLOR_SHADE_COUNT) + AVATAR_COLOR_SHADE_COUNT) %
    AVATAR_COLOR_SHADE_COUNT

  const baseColor = AVATAR_BASE_COLORS[normalizedPaletteIndex] ?? AVATAR_BASE_COLORS[0]
  const colorHex = shades[normalizedShadeIndex] ?? baseColor.hex
  const colorId = baseColor.id * AVATAR_COLOR_SHADE_COUNT + normalizedShadeIndex

  return {
    paletteIndex: normalizedPaletteIndex,
    shadeIndex: normalizedShadeIndex,
    colorHex,
    colorId,
    shades,
  }
}

export const resolveAvatarColorById = (colorId: number | null | undefined): AvatarColorShade | null => {
  if (colorId == null || !Number.isFinite(colorId)) {
    return null
  }

  const normalizedId = Math.trunc(Number(colorId))
  const shadeIndex = ((normalizedId % AVATAR_COLOR_SHADE_COUNT) + AVATAR_COLOR_SHADE_COUNT) % AVATAR_COLOR_SHADE_COUNT
  const baseId = Math.trunc(normalizedId / AVATAR_COLOR_SHADE_COUNT)
  const paletteIndex = AVATAR_BASE_COLORS.findIndex(color => color.id === baseId)
  if (paletteIndex < 0) {
    return null
  }

  return resolveAvatarColorShade(paletteIndex, shadeIndex)
}

export const matchAvatarColorShade = (
  colorHex: string | null | undefined,
): AvatarColorShade | null => {
  const normalized = normalizeAvatarColorHex(colorHex ?? null)
  if (!normalized) {
    return null
  }

  for (let paletteIndex = 0; paletteIndex < AVATAR_BASE_COLORS.length; paletteIndex += 1) {
    const shades = getAvatarColorShades(paletteIndex)
    for (let shadeIndex = 0; shadeIndex < shades.length; shadeIndex += 1) {
      if (shades[shadeIndex].toLowerCase() === normalized) {
        const baseColor = AVATAR_BASE_COLORS[paletteIndex]
        const colorId = baseColor.id * AVATAR_COLOR_SHADE_COUNT + shadeIndex
        return {
          paletteIndex,
          shadeIndex,
          colorHex: shades[shadeIndex],
          colorId,
          shades,
        }
      }
    }
  }

  return null
}