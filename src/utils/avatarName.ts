import type { AvatarConfiguration } from '../context/AvatarConfigurationContext'

export interface AvatarNameSource {
  avatarName?: string | null
  name?: string | null
  avatarId?: string | null
}

const normalizeName = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const getAvatarDisplayName = (
  avatar: AvatarNameSource | AvatarConfiguration | null | undefined,
  fallback = 'Avatar'
): string => {
  if (!avatar) {
    return fallback
  }

  const preferredName = normalizeName('avatarName' in avatar ? avatar.avatarName : undefined)
  if (preferredName) {
    return preferredName
  }

  const legacyName = normalizeName('name' in avatar ? avatar.name : undefined)
  if (legacyName) {
    return legacyName
  }

  if ('avatarId' in avatar) {
    const identifier = normalizeName(avatar.avatarId) ?? avatar.avatarId
    if (identifier) {
      return `Avatar ${identifier}`
    }
  }

  return fallback
}