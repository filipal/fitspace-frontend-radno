import { useCallback } from 'react';
import { useAuthData } from '../hooks/useAuthData';
import type {
  AvatarClothingSelection,
  AvatarClothingState,
  AvatarCreationMode,
  BackendAvatarData,
  BackendAvatarMorphTarget,
  BasicMeasurements,
  BodyMeasurements,
  QuickModeSettings,
} from '../context/AvatarConfigurationContext';
import type { ClothingCategory } from '../constants/clothing';
import {
  matchAvatarColorShade,
  normalizeAvatarColorHex,
  resolveAvatarColorById,
  resolveAvatarColorShade,
} from '../constants/avatarColors';
import type { CreateAvatarCommand } from '../types/provisioning';

// VITE_AVATAR_API_BASE_URL must be defined; otherwise resolveAvatarUrl throws an AvatarApiError.
const DEFAULT_AVATAR_API_BASE_URL =
  (import.meta.env.VITE_AVATAR_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  '';

export const LAST_LOADED_AVATAR_STORAGE_KEY = 'fitspace:lastAvatarId';
export const LAST_CREATED_AVATAR_METADATA_STORAGE_KEY =
  'fitspace:lastAvatarMetadata';

export interface AvatarDraftMetadata {
  avatarId: string | null;
  name: string;
  avatarName: string;
  gender: 'male' | 'female';
  ageRange: string;
  basicMeasurements: Partial<BasicMeasurements> | null;
  bodyMeasurements: AvatarApiMeasurements | null;
  morphTargets: BackendAvatarMorphTarget[] | null;
  quickMode: boolean | null;
  creationMode: AvatarCreationMode | null;
  quickModeSettings: QuickModeSettings | null;
  source: string | null;
  clothingSelections: AvatarClothingState | null;
}

export interface PersistAvatarDraftParams {
  resolvedId: string;
  command: CreateAvatarCommand;
  metadata: AvatarDraftMetadata;
}

export const persistAvatarDraftToStorage = ({
  resolvedId,
  command,
  metadata,
}: PersistAvatarDraftParams): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem('pendingAvatarData', JSON.stringify(command));
  } catch (error) {
    console.warn('Failed to persist avatar draft command', error);
  }

  try {
    window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, resolvedId);
  } catch (error) {
    console.warn('Failed to persist avatar draft id', error);
  }

  try {
    window.sessionStorage.setItem(
      LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
      JSON.stringify(metadata),
    );
  } catch (error) {
    console.warn('Failed to persist avatar draft metadata', error);
  }
};

export const clearAvatarDraftFromStorage = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem('pendingAvatarData');
  } catch (error) {
    console.warn('Failed to clear avatar draft command', error);
  }
};

export type AvatarApiMeasurements = Partial<BodyMeasurements>;

const CLOTHING_CATEGORIES: ClothingCategory[] = ['top', 'bottom'];

const sanitizeClothingSelectionPayload = (
  value: unknown,
): AvatarClothingSelection | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemId = Number(record.itemId);
  if (!Number.isFinite(itemId)) {
    return null;
  }

  const rawSubCategory = record.subCategory;
  const subCategory =
    typeof rawSubCategory === 'string' && rawSubCategory.trim().length
      ? rawSubCategory.trim()
      : null;

  let paletteIndex = toFiniteNumber(record.colorPaletteIndex);
  let shadeIndex = toFiniteNumber(record.colorShadeIndex);
  let colorId = toFiniteNumber(record.colorId);
  let colorHex = normalizeAvatarColorHex(record.colorHex);
  const rawSizeLabel = record.sizeLabel;
  const sizeLabel =
    typeof rawSizeLabel === 'string' && rawSizeLabel.trim().length
      ? rawSizeLabel.trim()
      : null;
  const rawBottomWaist = toFiniteNumber(record.bottomWaist);
  const rawBottomLength = toFiniteNumber(record.bottomLength);
  const bottomWaist =
    rawBottomWaist != null && Number.isFinite(rawBottomWaist)
      ? Math.trunc(rawBottomWaist)
      : null;
  const bottomLength =
    rawBottomLength != null && Number.isFinite(rawBottomLength)
      ? Math.trunc(rawBottomLength)
      : null;

  if (!colorHex && paletteIndex != null && shadeIndex != null) {
    const resolved = resolveAvatarColorShade(paletteIndex, shadeIndex);
    colorHex = resolved.colorHex;
    paletteIndex = resolved.paletteIndex;
    shadeIndex = resolved.shadeIndex;
    colorId = colorId ?? resolved.colorId;
  }

  if (!colorHex && colorId != null) {
    const resolved = resolveAvatarColorById(colorId);
    if (resolved) {
      colorHex = resolved.colorHex;
      paletteIndex = resolved.paletteIndex;
      shadeIndex = resolved.shadeIndex;
      colorId = resolved.colorId;
    }
  }

  if (colorHex) {
    const matched = matchAvatarColorShade(colorHex);
    if (matched) {
      if (paletteIndex == null) {
        paletteIndex = matched.paletteIndex;
      }
      if (shadeIndex == null) {
        shadeIndex = matched.shadeIndex;
      }
      if (colorId == null) {
        colorId = matched.colorId;
      }
      colorHex = matched.colorHex;
    }
  }

  const selection: AvatarClothingSelection = {
    itemId,
    ...(subCategory ? { subCategory } : {}),
    ...(colorHex ? { colorHex } : {}),
    ...(paletteIndex != null ? { colorPaletteIndex: paletteIndex } : {}),
    ...(shadeIndex != null ? { colorShadeIndex: shadeIndex } : {}),
    ...(colorId != null ? { colorId } : {}),
    ...(sizeLabel ? { sizeLabel } : {}),
    ...(bottomWaist != null ? { bottomWaist } : {}),
    ...(bottomLength != null ? { bottomLength } : {}),
  };

  return selection;
};

const sanitizeClothingSelectionsPayload = (
  source: AvatarClothingState | null | undefined,
): AvatarClothingState | undefined => {
  if (!source) {
    return undefined;
  }

  const normalized: AvatarClothingState = {};

  for (const category of CLOTHING_CATEGORIES) {
    const selection = sanitizeClothingSelectionPayload((source as Record<string, unknown>)[category]);
    if (selection) {
      normalized[category] = selection;
    }
  }

  return Object.keys(normalized).length ? normalized : undefined;
};

// Removed session storage constants as we're bypassing token authentication
const AVATAR_API_KEY = import.meta.env.VITE_AVATAR_API_KEY as string | undefined;

export interface QuickModeSettingsPayload {
  bodyShape?: string | null;
  athleticLevel?: string | null;
  measurements?: Record<string, number>;
  updatedAt?: string | Date | null;
}

export interface AvatarMorphPayload {
  id: string;
  backendKey: string;
  sliderValue: number;
}

export interface AvatarPayload {
  name: string;
  avatarName?: string;
  gender: 'male' | 'female';
  ageRange: string;
  creationMode?: AvatarCreationMode | null;
  quickMode?: boolean;
  source?: string | null;
  basicMeasurements?: Partial<BasicMeasurements>;
  bodyMeasurements?: AvatarApiMeasurements;
  morphTargets?: Record<string, number>;
  morphs?: AvatarMorphPayload[];
  quickModeSettings?: QuickModeSettingsPayload | null;
  clothingSelections?: AvatarClothingState | null;
}

interface AvatarApiAuth {
  backendSession: BackendSession;
  userId: string;
  baseUrl?: string;
  sessionId?: string;
}

interface CreateAvatarRequest extends AvatarApiAuth {
  payload: AvatarPayload;
}

interface UpdateAvatarMeasurementsRequest extends AvatarApiAuth {
  avatarId: string | number;
  payload: AvatarPayload;
}

export interface AvatarApiResult {
  avatarId?: string;
  backendAvatar?: BackendAvatarData | null;
  responseBody: unknown;
}

export interface AvatarListItem {
  id: string;
  name: string;
  gender: 'male' | 'female';
  ageRange?: string;
  source?: string | null;
  creationMode?: AvatarCreationMode | null;
  quickMode?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FetchAvatarByIdRequest {
  avatarId: string | number;
  userId: string;
  backendSession: BackendSession;
  baseUrl?: string;
}

export interface BackendSession {
  token: string;
  expiresAt: string;
  headers: Record<string, string>;
}

// Removed StoredBackendSession interface as we're bypassing token storage

interface EnsureBackendSessionOptions {
  userId: string;
  email: string;
  sessionId: string;
  refreshToken: string;
  baseUrl?: string;
}

export class AvatarApiError extends Error {
  status?: number;
  statusText?: string;
  constructor(message: string, options?: { status?: number; statusText?: string }) {
    super(message);
    this.name = 'AvatarApiError';
    this.status = options?.status;
    this.statusText = options?.statusText;
  }
}

const ensureTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value : `${value}/`;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/u, '');

const encodePathSegment = (segment: string | number): string =>
  encodeURIComponent(String(segment));

// Removed session storage utility functions as we're bypassing token authentication

// Removed deriveApiRoot as it's no longer needed since we bypass token calls

// Removed session validation and sanitization functions as we're bypassing token authentication

// Removed readStoredBackendSession as we're bypassing token storage

// Removed session storage functions as we're bypassing token authentication

// Removed convertEpochToIsoString function as we're bypassing token handling

// Removed normaliseExpiresAtValue function as we're bypassing token expiry handling

// Since tokens are completely disabled in backend, we create a simple session with basic headers
function createSimpleSession(): BackendSession {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(AVATAR_API_KEY ? { 'x-api-key': AVATAR_API_KEY } : {}),
  };

  return { 
    token: '', // No token needed
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    headers 
  };
}

export async function ensureBackendSession(
  options: EnsureBackendSessionOptions,
): Promise<BackendSession> {
  const { userId, email, sessionId } = options;

  if (!userId) {
    throw new AvatarApiError('Missing user identifier for backend session request');
  }

  if (!email) {
    throw new AvatarApiError('Missing email for backend session request');
  }

  if (!sessionId) {
    throw new AvatarApiError('Missing session identifier for backend session request');
  }

  return createSimpleSession();
}

const resolveUserRootUrl = (baseUrl: string, userId: string): string => {
  const normalisedBase = ensureTrailingSlash(trimTrailingSlashes(baseUrl));
  const normalizedUserId = normalizeUserIdentifier(userId) ?? userId;
  return `${normalisedBase}${encodePathSegment(normalizedUserId)}`;
};

const buildAvatarScopedUrl = (
  baseUrl: string,
  userId: string,
  ...segments: Array<string | number>
): string => {
  const avatarRoot = `${ensureTrailingSlash(resolveUserRootUrl(baseUrl, userId))}avatars`;
  if (!segments.length) {
    return avatarRoot;
  }

  const suffix = segments.map(encodePathSegment).join('/');
  return `${avatarRoot}/${suffix}`;
};

function resolveAvatarCollectionUrl(baseUrl: string, userId: string): string {
  if (!baseUrl) {
    throw new AvatarApiError('Avatar API base URL is not configured');
  }

  return buildAvatarScopedUrl(baseUrl, userId);
}

function resolveAvatarUrl(
  baseUrl: string,
  userId: string,
  avatarId: string | number,
): string {
  if (!baseUrl) {
    throw new AvatarApiError('Avatar API base URL is not configured');
  }

  return buildAvatarScopedUrl(baseUrl, userId, avatarId);
}

const ALLOWED_CREATION_MODES: AvatarCreationMode[] = [
  'manual',
  'scan',
  'preset',
  'import',
  'quickMode',
];

const ALLOWED_AGE_RANGES: readonly string[] = [
  '15-19',
  '20-29',
  '30-39',
  '40-49',
  '50-59',
  '60-69',
  '70-79',
  '80-89',
  '90-99',
];

const ALLOWED_SOURCES: readonly string[] = [
  'android',
  'api',
  'integration',
  'ios',
  'kiosk',
  'web',
];

const AGE_RANGE_FALLBACK_MAP: Record<string, string> = {
  '25-35': '20-29',
  '25-35 years': '20-29',
  '25-35 years old': '20-29',
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const UUID_PATTERN =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/u;

const normalizeUuidLikeIdentifier = (value: unknown): string | undefined => {
  let candidate = value;

  if (
    candidate &&
    typeof candidate === 'object' &&
    'toString' in candidate &&
    typeof candidate.toString === 'function'
  ) {
    try {
      const serialized = candidate.toString();
      if (serialized && serialized !== '[object Object]') {
        candidate = serialized;
      }
    } catch (error) {
      console.warn('Failed to serialize identifier value', error);
    }
  }

  const normalized = normalizeString(candidate);
  if (!normalized) {
    return undefined;
  }

  const match = normalized.match(UUID_PATTERN);
  if (match) {
    return match[0].toLowerCase();
  }

  return normalized;
};

const normalizeUserIdentifier = (value: unknown): string | undefined =>
  normalizeUuidLikeIdentifier(value);

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const sanitizeGuestMeasurementRecord = (
  source?: Record<string, unknown> | null,
): Record<string, number | string | null> | undefined => {
  if (!source) {
    return undefined;
  }

  const entries = Object.entries(source).reduce<Record<string, number | string | null>>(
    (acc, [key, value]) => {
      if (!key || value === undefined) {
        return acc;
      }

      if (value === null) {
        acc[key] = null;
        return acc;
      }

      if (typeof value === 'number') {
        if (Number.isFinite(value)) {
          acc[key] = value;
        }
        return acc;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return acc;
        }

        const numeric = toFiniteNumber(trimmed);
        acc[key] = numeric ?? trimmed;
        return acc;
      }

      const numeric = toFiniteNumber(value);
      if (numeric !== undefined) {
        acc[key] = numeric;
      }

      return acc;
    },
    {},
  );

  return Object.keys(entries).length ? entries : undefined;
};

const sanitizeGuestQuickModeSettings = (
  source?: QuickModeSettingsPayload | null,
): QuickModeSettings | null => {
  if (!source) {
    return null;
  }

  const bodyShape =
    typeof source.bodyShape === 'string' && source.bodyShape.trim().length
      ? source.bodyShape.trim()
      : undefined;

  const athleticLevel =
    typeof source.athleticLevel === 'string' && source.athleticLevel.trim().length
      ? source.athleticLevel.trim()
      : undefined;

  const measurements = source.measurements;
  const normalizedMeasurements = measurements
    ? Object.entries(measurements).reduce<Record<string, number>>((acc, [key, value]) => {
        if (!key) {
          return acc;
        }
        const numeric = toFiniteNumber(value);
        if (numeric !== undefined) {
          acc[key] = numeric;
        }
        return acc;
      }, {})
    : undefined;

  const updatedAtRaw = source.updatedAt;
  let updatedAt: string | undefined;
  if (updatedAtRaw instanceof Date) {
    updatedAt = updatedAtRaw.toISOString();
  } else if (typeof updatedAtRaw === 'string') {
    const trimmed = updatedAtRaw.trim();
    if (trimmed) {
      updatedAt = trimmed;
    }
  }

  const normalized: QuickModeSettings = {};
  if (bodyShape) {
    normalized.bodyShape = bodyShape;
  }
  if (athleticLevel) {
    normalized.athleticLevel = athleticLevel;
  }
  if (normalizedMeasurements && Object.keys(normalizedMeasurements).length) {
    normalized.measurements = normalizedMeasurements;
  }
  if (updatedAt) {
    normalized.updatedAt = updatedAt;
  }

  return Object.keys(normalized).length ? normalized : null;
};

const mergeGuestMorphTargets = (
  payload: AvatarPayload,
  options?: { morphTargets?: Record<string, number> },
): Record<string, number> | undefined => {
  const merged = new Map<string, number>();

  const assignMorph = (key: string | undefined, value: unknown) => {
    const normalizedKey = normalizeString(key);
    if (!normalizedKey) {
      return;
    }

    const numericValue = toFiniteNumber(value);
    if (numericValue === undefined) {
      return;
    }

    const clamped = Math.max(0, Math.min(100, numericValue));
    merged.set(normalizedKey, clamped);
  };

  if (payload.morphTargets) {
    for (const [key, value] of Object.entries(payload.morphTargets)) {
      assignMorph(key, value);
    }
  }

  if (options?.morphTargets) {
    for (const [key, value] of Object.entries(options.morphTargets)) {
      assignMorph(key, value);
    }
  }

  if (Array.isArray(payload.morphs)) {
    for (const morph of payload.morphs) {
      assignMorph(morph.backendKey ?? morph.id, morph.sliderValue);
    }
  }

  if (!merged.size) {
    return undefined;
  }

  return Array.from(merged.entries()).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const normalizeCreationMode = (value: unknown): AvatarCreationMode | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  const matched = ALLOWED_CREATION_MODES.find(mode => mode.toLowerCase() === lower);
  return matched ?? null;
};


const normalizeCreationModeForBackend = (value: unknown): AvatarCreationMode | null => {
  const creationMode = normalizeCreationMode(value);
  if (!creationMode) {
    return null;
  }
  if (creationMode === 'quickMode') {
    return 'preset';
  }
  return creationMode;
};

const normalizeSourceForBackend = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (ALLOWED_SOURCES.includes(lower)) {
    return lower;
  }

  if (lower === 'guest' || lower === 'browser') {
    return 'web';
  }

  return null;
};

const normalizeAgeRange = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const directMatch = ALLOWED_AGE_RANGES.find(
    range => range.toLowerCase() === lower,
  );
  if (directMatch) {
    return directMatch;
  }

  const fallback = AGE_RANGE_FALLBACK_MAP[lower];
  if (fallback) {
    return fallback;
  }

  const numericMatch = lower.match(/(\d+)\s*-\s*(\d+)/);
  if (numericMatch) {
    const start = Number(numericMatch[1]);
    if (Number.isFinite(start)) {
      if (start < 20) {
        return '15-19';
      }
      const bucketStart = Math.min(90, Math.floor(start / 10) * 10);
      if (bucketStart >= 20) {
        const candidate = `${bucketStart}-${bucketStart + 9}`;
        const match = ALLOWED_AGE_RANGES.find(
          range => range.toLowerCase() === candidate.toLowerCase(),
        );
        if (match) {
          return match;
        }
      }
    }
  }

  return null;
};

const persistGuestAvatarUpdate = (
  avatarId: string | number | null | undefined,
  payload: AvatarPayload,
  options?: { morphTargets?: Record<string, number> },
): AvatarApiResult => {
  const resolvedName = normalizeString(payload.name) ?? 'Guest Avatar';
  const gender = normalizeGender(payload.gender);
  const ageRange = normalizeAgeRange(payload.ageRange) ?? '20-29';
  const creationMode = payload.creationMode ?? null;
  const quickMode = payload.quickMode ?? null;
  const source = 'guest';

  const basicMeasurements = sanitizeGuestMeasurementRecord(
    payload.basicMeasurements ?? undefined,
  );

  if (creationMode && basicMeasurements && !('creationMode' in basicMeasurements)) {
    basicMeasurements.creationMode = creationMode;
  }

  const bodyMeasurements = sanitizeGuestMeasurementRecord(payload.bodyMeasurements ?? undefined);
  const morphTargets = mergeGuestMorphTargets(payload, options);
  const quickModeSettings = sanitizeGuestQuickModeSettings(payload.quickModeSettings);
  const clothingSelections = sanitizeClothingSelectionsPayload(
    payload.clothingSelections ?? undefined,
  );

  const command: CreateAvatarCommand = {
    type: 'createAvatar',
    data: {
      avatarName: resolvedName,
      gender,
      ageRange,
      ...(basicMeasurements ? { basicMeasurements } : {}),
      ...(bodyMeasurements ? { bodyMeasurements } : {}),
      ...(morphTargets ? { morphTargets } : {}),
      quickModeSettings: quickModeSettings ?? null,
      ...(clothingSelections ? { clothingSelections } : {}),
    },
  };

  const resolvedId = avatarId != null ? String(avatarId) : 'guest';

  const storageMorphTargets = morphTargets
    ? Object.entries(morphTargets).reduce<BackendAvatarMorphTarget[]>((acc, [key, value]) => {
        if (!key) {
          return acc;
        }
        const numericValue = toFiniteNumber(value);
        if (numericValue === undefined) {
          return acc;
        }
        acc.push({ name: key, value: numericValue });
        return acc;
      }, [])
    : null;

  persistAvatarDraftToStorage({
    resolvedId,
    command,
    metadata: {
      avatarId: resolvedId === 'guest' ? null : resolvedId,
      name: resolvedName,
      avatarName: resolvedName,
      gender,
      ageRange,
      basicMeasurements: (basicMeasurements ?? null) as Partial<BasicMeasurements> | null,
      bodyMeasurements: (bodyMeasurements ?? null) as AvatarApiMeasurements | null,
      morphTargets: storageMorphTargets ?? null,
      quickMode: quickMode,
      creationMode,
      quickModeSettings: quickModeSettings ?? null,
      source,
      clothingSelections: clothingSelections ?? null,
    },
  });

  return {
    avatarId: resolvedId,
    backendAvatar: null,
    responseBody: { storedAs: 'guest' },
  };
};

const normalizeGender = (value: unknown): 'male' | 'female' => {
  const normalized = normalizeString(value)?.toLowerCase();
  return normalized === 'female' ? 'female' : 'male';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeMeasurementPayload = (
  section?: Record<string, unknown> | null,
  options?: { includeCreationMode?: boolean },
): Record<string, unknown> | undefined => {
  if (!section) {
    return undefined;
  }

  const includeCreationMode = options?.includeCreationMode ?? false;
  const entries = Object.entries(section).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      if (value == null) {
        return acc;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = value;
        return acc;
      }

      if (includeCreationMode && key === 'creationMode') {
        const creationMode = normalizeCreationModeForBackend(value);
        if (creationMode) {
          acc[key] = creationMode;
        }
      }

      return acc;
    },
    {},
  );

  return Object.keys(entries).length ? entries : undefined;
};

const sanitizeMorphTargetsPayload = (
  morphTargets?: Record<string, number> | null,
): Record<string, number> | undefined => {
  if (!morphTargets) {
    return undefined;
  }

  const entries = Object.entries(morphTargets).reduce<Record<string, number>>(
    (acc, [key, value]) => {
      if (!key) {
        return acc;
      }
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        acc[key] = numericValue;
      }
      return acc;
    },
    {},
  );

  return Object.keys(entries).length ? entries : undefined;
};

export const buildBackendMorphPayload = (
  payload: AvatarPayload,
): AvatarMorphPayload[] | undefined => {
  const result = new Map<string, AvatarMorphPayload>();

  const assignMorph = (id: string | undefined, backendKey: string | undefined, value: unknown) => {
    const normalizedBackendKey = normalizeString(backendKey ?? id);
    if (!normalizedBackendKey) {
      return;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    const normalizedId = normalizeString(id ?? backendKey) ?? normalizedBackendKey;
    result.set(normalizedBackendKey, {
      id: normalizedId,
      backendKey: normalizedBackendKey,
      sliderValue: numericValue,
    });
  };

  if (Array.isArray(payload.morphs)) {
    payload.morphs.forEach(item => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const candidate = item as Partial<AvatarMorphPayload> & {
        value?: unknown;
        unrealValue?: unknown;
        defaultValue?: unknown;
      };

      const rawValue =
        candidate.sliderValue ?? candidate.value ?? candidate.unrealValue ?? candidate.defaultValue;

      assignMorph(candidate.id, candidate.backendKey, rawValue);
    });
  }

  const sanitizedTargets = sanitizeMorphTargetsPayload(payload.morphTargets);
  if (sanitizedTargets) {
    Object.entries(sanitizedTargets).forEach(([key, value]) => {
      assignMorph(key, key, value);
    });
  }

  return result.size ? Array.from(result.values()) : undefined;
};

const sanitizeQuickModeSettingsPayload = (
  settings?: QuickModeSettingsPayload | QuickModeSettings | null,
): QuickModeSettings | undefined => {
  if (!settings) {
    return undefined;
  }
  const normalized: QuickModeSettings = {};
  const bodyShape = normalizeString(settings.bodyShape);
  if (bodyShape) {
    normalized.bodyShape = bodyShape;
  }
  const athleticLevel = normalizeString(settings.athleticLevel);
  if (athleticLevel) {
    normalized.athleticLevel = athleticLevel;
  }
  const measurementsSource = isRecord(settings.measurements)
    ? (settings.measurements as Record<string, unknown>)
    : undefined;
  if (measurementsSource) {
    const measurements = Object.entries(measurementsSource).reduce<Record<string, number>>(
      (acc, [key, value]) => {
        if (!key) {
          return acc;
        }
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          acc[key] = numericValue;
        }
        return acc;
      },
      {},
    );
    if (Object.keys(measurements).length) {
      normalized.measurements = measurements;
    }
  }
  const updatedAtSource = (settings as QuickModeSettingsPayload | QuickModeSettings)
    .updatedAt;
  if (updatedAtSource instanceof Date) {
    const timestamp = updatedAtSource.getTime();
    if (Number.isFinite(timestamp)) {
      normalized.updatedAt = new Date(timestamp).toISOString();
    }
  } else if (typeof updatedAtSource === 'number') {
    if (Number.isFinite(updatedAtSource)) {
      normalized.updatedAt = new Date(updatedAtSource).toISOString();
    }
  } else if (typeof updatedAtSource === 'string') {
    const trimmed = updatedAtSource.trim();
    if (trimmed) {
      normalized.updatedAt = trimmed;
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
};

const buildBackendAvatarRequestPayload = (
  payload: AvatarPayload,
): Record<string, unknown> => {
  const request: Record<string, unknown> = {
    name: payload.name,
  };

  if (payload.gender) {
    request.gender = payload.gender;
  }
  const normalizedAgeRange = normalizeAgeRange(payload.ageRange);
  if (normalizedAgeRange) {
    request.ageRange = normalizedAgeRange;
  }
  const normalizedCreationMode = normalizeCreationModeForBackend(payload.creationMode);
  if (normalizedCreationMode) {
    request.creationMode = normalizedCreationMode;
  }
  if (typeof payload.quickMode === 'boolean') {
    request.quickMode = payload.quickMode;
  }
  const normalizedSource = normalizeSourceForBackend(payload.source);
  if (normalizedSource) {
    request.source = normalizedSource;
  }

  // Uključi creationMode iz measurements SAMO ako nije zadan na top-levelu
  const basicMeasurements = sanitizeMeasurementPayload(
    payload.basicMeasurements as Record<string, unknown> | undefined,
    { includeCreationMode: !normalizedCreationMode },
  )
  
  if (basicMeasurements) {
    request.basicMeasurements = basicMeasurements;
  }

  const bodyMeasurements = sanitizeMeasurementPayload(
    payload.bodyMeasurements as Record<string, unknown> | undefined,
  );
  if (bodyMeasurements) {
    request.bodyMeasurements = bodyMeasurements;
  }

  // ⬇️ KLJUČNA PROMJENA: šaljemo morphTargets (ne "morphs")
  const morphs = buildBackendMorphPayload(payload);
  if (morphs) {
    const morphTargets: Record<string, number> = {};
    for (const m of morphs) {
      const key = (m.backendKey ?? m.id)?.trim();
      const val = Number(m.sliderValue);
      if (key && Number.isFinite(val)) {
        morphTargets[key] = val;
      }
    }
    if (Object.keys(morphTargets).length) {
      request.morphTargets = morphTargets;
    }
  }

  const quickModeSettings = sanitizeQuickModeSettingsPayload(payload.quickModeSettings);
  if (quickModeSettings) {
    request.quickModeSettings = quickModeSettings;
  }

  const clothingSelections = sanitizeClothingSelectionsPayload(
    payload.clothingSelections ?? undefined,
  );
  if (clothingSelections) {
    request.clothingSelections = clothingSelections;
  }

  return request;
};


const normalizeBasicMeasurements = (
  section: unknown,
): Partial<BasicMeasurements> => {
  if (!isRecord(section)) {
    return {};
  }
  const normalized: Partial<BasicMeasurements> = {};
  for (const [key, value] of Object.entries(section)) {
    if (key === 'creationMode') {
      const creationMode = normalizeCreationMode(value);
      if (creationMode) {
        normalized.creationMode = creationMode;
      }
      continue;
    }
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      normalized[key] = numericValue;
    }
  }
  return normalized;
};

const normalizeBodyMeasurements = (
  section: unknown,
): Partial<BodyMeasurements> => {
  if (!isRecord(section)) {
    return {};
  }
  const normalized: Partial<BodyMeasurements> = {};
  for (const [key, value] of Object.entries(section)) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      normalized[key as keyof BodyMeasurements] = numericValue as BodyMeasurements[keyof BodyMeasurements];
    }
  }
  return normalized;
};

const normalizeMorphTargetsResponse = (payload: unknown): BackendAvatarMorphTarget[] => {
  if (!payload) {
    return [];
  }

  const normalized: Record<string, number> = {};

  const assignEntry = (key: unknown, value: unknown) => {
    const normalizedKey = normalizeString(key);
    if (!normalizedKey) {
      return;
    }
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      normalized[normalizedKey] = numericValue;
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach(item => {
      if (!isRecord(item)) {
        return;
      }
      const backendKey = normalizeString(item.backendKey);
      const fallbackId = normalizeString(item.id);
      const sliderValue =
        item.sliderValue ?? item.value ?? item.unrealValue ?? item.defaultValue;
      assignEntry(backendKey ?? fallbackId, sliderValue);
    });
    return Object.entries(normalized).map(([name, value]) => ({ name, value }));
  }

  if (isRecord(payload)) {
    Object.entries(payload).forEach(([key, value]) => assignEntry(key, value));
  }

  return Object.entries(normalized).map(([name, value]) => ({ name, value }));
};

const normalizeQuickModeSettingsResponse = (
  payload: unknown,
): QuickModeSettings | null => {
  if (!isRecord(payload)) {
    return null;
  }
  const normalized: QuickModeSettings = {};
  const bodyShape = normalizeString(payload.bodyShape);
  if (bodyShape) {
    normalized.bodyShape = bodyShape;
  }
  const athleticLevel = normalizeString(payload.athleticLevel);
  if (athleticLevel) {
    normalized.athleticLevel = athleticLevel;
  }
  if (isRecord(payload.measurements)) {
    const measurements = Object.entries(payload.measurements).reduce<Record<string, number>>(
      (acc, [key, value]) => {
        const normalizedKey = normalizeString(key);
        const numericValue = Number(value);
        if (normalizedKey && Number.isFinite(numericValue)) {
          acc[normalizedKey] = numericValue;
        }
        return acc;
      },
      {},
    );
    if (Object.keys(measurements).length) {
      normalized.measurements = measurements;
    }
  }
  const updatedAt = normalizeString(payload.updatedAt);
  if (updatedAt) {
    normalized.updatedAt = updatedAt;
  }

  return Object.keys(normalized).length ? normalized : null;
};

const normalizeClothingSelectionsResponse = (
  payload: unknown,
): AvatarClothingState | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const source = payload as Record<string, unknown>;
  let hasSelection = false;
  const normalized: AvatarClothingState = {};

  for (const category of CLOTHING_CATEGORIES) {
    const selection = sanitizeClothingSelectionPayload(source[category]);
    if (selection) {
      normalized[category] = selection;
      hasSelection = true;
    }
  }

  return hasSelection ? normalized : null;
};

const findAvatarCandidate = (payload: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (payload.type === 'createAvatar' && isRecord(payload.data)) {
    return payload.data as Record<string, unknown>;
  }

  if (isRecord(payload.avatar)) {
    return payload.avatar as Record<string, unknown>;
  }

  if (isRecord(payload.data)) {
    const nested = payload.data as Record<string, unknown>;
    if (nested.type === 'createAvatar' && isRecord(nested.data)) {
      return nested.data as Record<string, unknown>;
    }
    if ('id' in nested || 'avatarId' in nested) {
      return nested;
    }
  }

  if ('id' in payload || 'avatarId' in payload) {
    return payload;
  }

  return undefined;
};

const normalizeBackendAvatar = (payload: unknown): BackendAvatarData | undefined => {
  const candidate = findAvatarCandidate(payload);
  if (!candidate) {
    return undefined;
  }

  const rawId =
    candidate.avatarId ??
    candidate.id ??
    (isRecord(payload) ? (payload.avatarId ?? payload.id) : undefined);
  const avatarId = normalizeString(rawId);
  if (!avatarId) {
    return undefined;
  }

  const avatarName =
    normalizeString(candidate.avatarName ?? candidate.name) ?? `Avatar ${avatarId}`;
  const gender = normalizeGender(candidate.gender);
  const ageRange = normalizeAgeRange(candidate.ageRange) ?? normalizeString(candidate.ageRange) ?? '';
  const quickMode =
    typeof candidate.quickMode === 'boolean' ? candidate.quickMode : undefined;
  const creationMode =
    normalizeCreationMode(candidate.creationMode) ??
    normalizeCreationMode((candidate.basicMeasurements as Record<string, unknown> | undefined)?.creationMode) ??
    null;
  const source = normalizeString(candidate.source) ?? null;
  const createdAt = normalizeString(candidate.createdAt) ?? null;
  const updatedAt = normalizeString(candidate.updatedAt) ?? null;
  const createdBySession = normalizeString(candidate.createdBySession) ?? null;

  const basicMeasurements = normalizeBasicMeasurements(candidate.basicMeasurements);
  if (!basicMeasurements.creationMode && creationMode) {
    basicMeasurements.creationMode = creationMode;
  }
  const bodyMeasurements = normalizeBodyMeasurements(candidate.bodyMeasurements);
  const morphTargets = normalizeMorphTargetsResponse(
    (candidate as { morphTargets?: unknown }).morphTargets ??
      (candidate as { morphs?: unknown }).morphs,
  );
  const quickModeSettings = normalizeQuickModeSettingsResponse(
    candidate.quickModeSettings,
  );
  const clothingSelections = normalizeClothingSelectionsResponse(
    (candidate as { clothingSelections?: unknown }).clothingSelections,
  );

  return {
    type: 'createAvatar',
    id: avatarId,
    name: avatarName,
    gender,
    ageRange,
    quickMode,
    creationMode,
    source,
    createdAt,
    updatedAt,
    createdBySession,
    basicMeasurements,
    bodyMeasurements,
    morphTargets,
    quickModeSettings,
    clothingSelections,
  };
};

const parseAvatarResponse = (
  payload: unknown,
  options?: { fallbackId?: string | number },
): { backendAvatar: BackendAvatarData | null; avatarId: string } => {
  const backendAvatar = normalizeBackendAvatar(payload) ?? null;
  const candidate = findAvatarCandidate(payload);
  const topLevel = isRecord(payload) ? (payload as Record<string, unknown>) : undefined;

  const rawIdentifier =
    backendAvatar?.id ??
    normalizeString(candidate?.avatarId ?? candidate?.id) ??
    normalizeString(topLevel?.avatarId ?? topLevel?.id) ??
    (options?.fallbackId != null ? String(options.fallbackId) : undefined);

  if (!rawIdentifier) {
    throw new AvatarApiError('Avatar response did not include an avatar identifier');
  }

  return { backendAvatar, avatarId: rawIdentifier };
};

const parseAvatarListItem = (payload: unknown): AvatarListItem | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const id = normalizeString(payload.id ?? payload.avatarId);
  if (!id) {
    return null;
  }

  const name =
    normalizeString(payload.name ?? payload.avatarName) ?? `Avatar ${id}`;
  const gender = normalizeGender(payload.gender);
  const ageRange =
    normalizeAgeRange(payload.ageRange) ?? normalizeString(payload.ageRange) ?? undefined;
  const source = normalizeString(payload.source) ?? null;
  const creationMode =
    normalizeCreationMode(payload.creationMode) ?? null;
  const quickMode =
    typeof payload.quickMode === 'boolean' ? payload.quickMode : undefined;
  const createdAt = normalizeString(payload.createdAt) ?? null;
  const updatedAt = normalizeString(payload.updatedAt) ?? null;

  return {
    id,
    name,
    gender,
    ageRange,
    source,
    creationMode,
    quickMode,
    createdAt,
    updatedAt,
  };
};

const parseAvatarListResponse = (payload: unknown): AvatarListItem[] => {
  const collect = (source: unknown): AvatarListItem[] =>
    Array.isArray(source)
      ? (source
          .map(parseAvatarListItem)
          .filter((item): item is AvatarListItem => item !== null))
      : [];

  // Ako backend vrati direktno niz
  if (Array.isArray(payload)) {
    return collect(payload);
  }

  // Ako je objekt, provjeri očekivane ključeve (uključujući "items")
  if (isRecord(payload)) {
    if (Array.isArray(payload.items)) {              // ⬅️ NOVO
      return collect(payload.items);
    }
    if (Array.isArray(payload.avatars)) {
      return collect(payload.avatars);
    }
    if (Array.isArray(payload.data)) {
      return collect(payload.data);
    }
    if (isRecord(payload.data) && Array.isArray(payload.data.items)) {   // ⬅️ NOVO
      return collect(payload.data.items);
    }
    if (isRecord(payload.data) && Array.isArray(payload.data.avatars)) {
      return collect(payload.data.avatars);
    }
  }

  return [];
};

async function readErrorResponse(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        return String(parsed.message);
      }
      return text;
    } catch {
      return text;
    }
  } catch (error) {
    console.warn('Failed to read avatar API error response body', error);
    return undefined;
  }
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const statusText = response.statusText || 'Unknown error';
  const details = await readErrorResponse(response);

  const message = details
    ? `Avatar API request failed (${response.status} ${statusText}): ${details}`
    : `Avatar API request failed (${response.status} ${statusText})`;

  throw new AvatarApiError(message, {
    status: response.status,
    statusText,
  });
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.warn('Failed to parse avatar API response as JSON', error);
    return null;
  }
}

async function listAvatarsRequest({
  backendSession,
  userId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
}: AvatarApiAuth): Promise<AvatarListItem[]> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarCollectionUrl(baseUrl, sanitizedUserId);

  const headers: Record<string, string> = {
    ...backendSession.headers,
  };

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  await ensureOk(response);

  const body = await readJsonBody(response);
  return parseAvatarListResponse(body);
}

async function createAvatarRequest({
  backendSession,
  userId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
  payload,
}: CreateAvatarRequest): Promise<AvatarApiResult> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarCollectionUrl(baseUrl, sanitizedUserId);

  const headers: Record<string, string> = {
    ...backendSession.headers,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildBackendAvatarRequestPayload(payload)),
  });

  await ensureOk(response);

  const body = await readJsonBody(response);
  const { backendAvatar, avatarId } = parseAvatarResponse(body);

  return {
    avatarId,
    backendAvatar,
    responseBody: body,
  };
}

async function updateAvatarMeasurementsRequest({
  backendSession,
  userId,
  avatarId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
  payload,
}: UpdateAvatarMeasurementsRequest): Promise<AvatarApiResult> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarUrl(baseUrl, sanitizedUserId, avatarId);

  const headers: Record<string, string> = {
    ...backendSession.headers,
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(buildBackendAvatarRequestPayload(payload)),
  });

  await ensureOk(response);

  const body = await readJsonBody(response);
  const { backendAvatar, avatarId: resolvedId } = parseAvatarResponse(body, {
    fallbackId: avatarId,
  });

  return {
    avatarId: resolvedId,
    backendAvatar,
    responseBody: body,
  };
}

async function deleteAvatarRequest({
  backendSession,
  userId,
  avatarId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
}: AvatarApiAuth & { avatarId: string | number }): Promise<void> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarUrl(baseUrl, sanitizedUserId, avatarId);

  const headers: Record<string, string> = {
    ...backendSession.headers,
  };

  const response = await fetch(url, { method: 'DELETE', headers });
  await ensureOk(response); // očekujemo 204 No Content
}

export async function fetchAvatarByIdRequest({
  avatarId,
  userId,
  backendSession,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
}: FetchAvatarByIdRequest): Promise<BackendAvatarData> {

  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;

  if (!sanitizedUserId) {
    throw new AvatarApiError('Missing user identifier for avatar request');
  }

  const url = resolveAvatarUrl(baseUrl, sanitizedUserId, avatarId);

  const headers: Record<string, string> = {
    ...backendSession.headers,
  };
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    let details: string | undefined;

    try {
      const body = await response.json();
      if (body && typeof body === 'object' && 'message' in body) {
        details = String(body.message);
      }
    } catch {
      // Swallow JSON parsing errors and fall back to text response
      try {
        details = await response.text();
      } catch (textError) {
        console.warn('Failed to read avatar API error body', textError);
      }
    }

    const message = details
      ? `Failed to fetch avatar (${response.status} ${statusText}): ${details}`
      : `Failed to fetch avatar (${response.status} ${statusText})`;

    throw new AvatarApiError(message, {
      status: response.status,
      statusText,
    });
  }

  const body = await readJsonBody(response);
  const backendAvatar = normalizeBackendAvatar(body);
  if (!backendAvatar) {
    throw new AvatarApiError('Avatar response did not include valid avatar data');
  }

  return backendAvatar;
}

export function useAvatarApi(config?: { baseUrl?: string }) {
  const authData = useAuthData();
  const userId = authData.userId ?? undefined;
  const email = authData.email ?? undefined;
  const sessionId = authData.sessionId ?? undefined;
  const refreshToken = authData.authData?.refreshToken ?? undefined;

  const ensureSession = useCallback(async (): Promise<BackendSession> => {
    if (!authData.isAuthenticated) {
      throw new AvatarApiError('User is not authenticated to access avatars');
    }

    if (!userId) {
      throw new AvatarApiError('Missing user identifier for avatar request');
    }

    if (!email || !sessionId) {
      throw new AvatarApiError(
        'User session information is incomplete; please sign in again to continue.',
      );
    }

    // Since tokens are completely disabled, we just create a simple session
    return ensureBackendSession({
      userId,
      email,
      sessionId,
      refreshToken: refreshToken || 'not-needed',
      baseUrl: config?.baseUrl,
    });
  }, [
    authData.isAuthenticated,
    config?.baseUrl,
    email,
    refreshToken,
    sessionId,
    userId,
  ]);

  const withBackendSession = useCallback(
    async <T>(operation: (session: BackendSession) => Promise<T>): Promise<T> => {
      const session = await ensureSession();
      return await operation(session);
    },
    [ensureSession],
  );

  const fetchAvatarById = useCallback(
    async (avatarId: string | number): Promise<BackendAvatarData> => {
      if (!authData.isAuthenticated || !userId) {
        throw new AvatarApiError('User is not authenticated to load avatars');
      }

      return withBackendSession((backendSession) =>
        fetchAvatarByIdRequest({
          avatarId,
          userId,
          backendSession,
          baseUrl: config?.baseUrl,
        }),
      );
    },
    [authData.isAuthenticated, config?.baseUrl, userId, withBackendSession],
  );

  const createAvatar = useCallback(
    async (payload: AvatarPayload): Promise<AvatarApiResult> => {
      if (!authData.isAuthenticated || !userId) {
        throw new AvatarApiError('User is not authenticated to create avatars');
      }

      return withBackendSession((backendSession) =>
        createAvatarRequest({
          backendSession,
          userId,
          baseUrl: config?.baseUrl,
          payload,
        }),
      );
    },
    [
      authData.isAuthenticated,
      config?.baseUrl,
      userId,
      withBackendSession,
    ],
  );

  const listAvatars = useCallback(async (): Promise<AvatarListItem[]> => {
    if (!authData.isAuthenticated || !userId) {
      throw new AvatarApiError('User is not authenticated to list avatars');
    }

    return withBackendSession((backendSession) =>
      listAvatarsRequest({
        backendSession,
        userId,
        baseUrl: config?.baseUrl,
      }),
    );
  }, [authData.isAuthenticated, config?.baseUrl, userId, withBackendSession]);

  const updateAvatarMeasurements = useCallback(
    async (
      avatarId: string | number,
      payload: AvatarPayload,
      options?: { morphTargets?: Record<string, number> },
    ): Promise<AvatarApiResult> => {
      if (!authData.isAuthenticated || !userId) {
        return persistGuestAvatarUpdate(avatarId, payload, options);
      }

      const mergedMorphTargets =
        payload.morphTargets || options?.morphTargets
          ? {
              ...(payload.morphTargets ?? {}),
              ...(options?.morphTargets ?? {}),
            }
          : undefined;

      const requestPayload: AvatarPayload = {
        ...payload,
        name: payload.name,
        gender: payload.gender,
        ageRange: payload.ageRange,
        ...(payload.basicMeasurements
          ? { basicMeasurements: { ...payload.basicMeasurements } }
          : {}),
        ...(payload.bodyMeasurements
          ? { bodyMeasurements: { ...payload.bodyMeasurements } }
          : {}),
        ...(payload.quickModeSettings
          ? {
              quickModeSettings: {
                ...payload.quickModeSettings,
                ...(payload.quickModeSettings?.measurements
                  ? { measurements: { ...payload.quickModeSettings.measurements } }
                  : {}),
              },
            }
          : {}),
        ...(mergedMorphTargets ? { morphTargets: mergedMorphTargets } : {}),
      };

      return withBackendSession((backendSession) =>
        updateAvatarMeasurementsRequest({
          backendSession,
          userId,
          avatarId,
          baseUrl: config?.baseUrl,
          payload: requestPayload,
        }),
      );
    },
    [
      authData.isAuthenticated,
      config?.baseUrl,
      userId,
      withBackendSession,
    ],
  );

  const deleteAvatar = useCallback(
    async (avatarId: string | number): Promise<void> => {
      if (!authData.isAuthenticated || !userId) {
        throw new AvatarApiError('User is not authenticated to delete avatars');
      }

      await withBackendSession((backendSession) =>
        deleteAvatarRequest({
          backendSession,
          userId,
          avatarId,
          baseUrl: config?.baseUrl,
        }),
      );

      // Opcionalno: očisti lokalne reference na izbrisani avatar
      try {
        if (localStorage?.getItem(LAST_LOADED_AVATAR_STORAGE_KEY) === String(avatarId)) {
          localStorage.removeItem(LAST_LOADED_AVATAR_STORAGE_KEY);
        }
        const raw = sessionStorage?.getItem(LAST_CREATED_AVATAR_METADATA_STORAGE_KEY);
        if (raw) {
          const meta = JSON.parse(raw);
          if (meta?.id === String(avatarId)) {
            sessionStorage.removeItem(LAST_CREATED_AVATAR_METADATA_STORAGE_KEY);
          }
        }
      } catch {
        // ignore storage errors
      }
    },
    [authData.isAuthenticated, config?.baseUrl, userId, withBackendSession],
  );

  return {
    fetchAvatarById,
    createAvatar,
    listAvatars,
    updateAvatarMeasurements,
    deleteAvatar,
  };
}
