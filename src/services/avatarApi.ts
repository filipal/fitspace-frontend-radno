import { useCallback } from 'react';
import { useAuthData } from '../hooks/useAuthData';
import type {
  AvatarCreationMode,
  BackendAvatarData,
  BackendAvatarMorphTarget,
  BasicMeasurements,
  BodyMeasurements,
  QuickModeSettings,
} from '../context/AvatarConfigurationContext';

// VITE_AVATAR_API_BASE_URL must be defined; otherwise resolveAvatarUrl throws an AvatarApiError.
const DEFAULT_AVATAR_API_BASE_URL =
  (import.meta.env.VITE_AVATAR_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  '';

export const LAST_LOADED_AVATAR_STORAGE_KEY = 'fitspace:lastAvatarId';
export const LAST_CREATED_AVATAR_METADATA_STORAGE_KEY =
  'fitspace:lastAvatarMetadata';

export type AvatarApiMeasurements = Partial<BodyMeasurements>;

const DEFAULT_BACKEND_API_ROOT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

const BACKEND_SESSION_STORAGE_KEY = 'fitspace:backendSession';
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

interface StoredBackendSession extends BackendSession {
  metadata: {
    userId: string;
    email: string;
    sessionId: string;
    refreshToken: string;
  };
}

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

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch (error) {
    console.warn('Unable to access sessionStorage', error);
    return null;
  }
};

const safeParseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from storage', error);
    return null;
  }
};

const deriveApiRoot = (baseUrl?: string): string => {
  const explicitRoot = trimTrailingSlashes(
    baseUrl ?? DEFAULT_BACKEND_API_ROOT ?? '',
  );

  if (explicitRoot) {
    return explicitRoot;
  }

  const avatarRoot = trimTrailingSlashes(DEFAULT_AVATAR_API_BASE_URL);
  if (!avatarRoot) {
    throw new AvatarApiError('Backend API base URL is not configured');
  }

  if (avatarRoot.endsWith('/users')) {
    return avatarRoot.replace(/\/users$/u, '');
  }

  return avatarRoot;
};

const isBackendSessionValid = (
  session: StoredBackendSession,
  expected: {
    email: string;
    sessionId: string;
    refreshToken: string;
    userId?: string;
  },
): boolean => {
  const expectedSessionId = normalizeSessionIdentifier(expected.sessionId);
  const storedSessionId = normalizeSessionIdentifier(session.metadata.sessionId);
  const storedUserId = normalizeUserIdentifier(session.metadata.userId);

  if (
    session.metadata.email !== expected.email ||
    storedSessionId !== expectedSessionId ||
    session.metadata.refreshToken !== expected.refreshToken
  ) {
    return false;
  }

  if (storedUserId && expected.userId) {
    const expectedUserId = normalizeUserIdentifier(expected.userId);
    if (expectedUserId && storedUserId !== expectedUserId) {
      return false;
    }
  }

  const expiryTimestamp = Date.parse(session.expiresAt);
  if (Number.isNaN(expiryTimestamp)) {
    return false;
  }

  const now = Date.now();
  const buffer = 30_000; // 30 seconds safety buffer
  return now + buffer < expiryTimestamp;
};

const sanitizeBackendSession = (
  session: StoredBackendSession,
): StoredBackendSession => {
  const normalizedSessionId =
    normalizeSessionIdentifier(session.metadata.sessionId) ??
    session.metadata.sessionId;
  const normalizedUserId =
    normalizeUserIdentifier(session.metadata.userId) ?? session.metadata.userId;

  const sanitizedHeaders: Record<string, string> = {
    ...session.headers,
  };

  const headerUserId = normalizeUserIdentifier(sanitizedHeaders['X-User-Id']);
  if (headerUserId) {
    sanitizedHeaders['X-User-Id'] = headerUserId;
  } else {
    delete sanitizedHeaders['X-User-Id'];
  }

  const headerSessionId = normalizeSessionIdentifier(
    sanitizedHeaders['X-Session-Id'],
  );
  const effectiveSessionId = headerSessionId ?? normalizedSessionId;

  if (effectiveSessionId) {
    sanitizedHeaders['X-Session-Id'] = effectiveSessionId;
  } else {
    delete sanitizedHeaders['X-Session-Id'];
  }

  return {
    ...session,
    headers: sanitizedHeaders,
    metadata: {
      ...session.metadata,
      userId: normalizedUserId,
      sessionId: normalizedSessionId,
    },
  };
};

const readStoredBackendSession = (
  expected: { userId: string; email: string; sessionId: string; refreshToken: string },
): BackendSession | null => {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(BACKEND_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const stored = safeParseJson<StoredBackendSession>(raw);
  if (!stored) {
    return null;
  }

  const sanitized = sanitizeBackendSession(stored);

  if (sanitized.metadata.userId !== expected.userId) {
    return null;
  }

  const normalisedExpiresAt = normaliseExpiresAtValue(stored.expiresAt);
  if (!normalisedExpiresAt) {
    return null;
  }

  const session: StoredBackendSession =
    normalisedExpiresAt === sanitized.expiresAt
      ? sanitized
      : { ...sanitized, expiresAt: normalisedExpiresAt };

  if (!isBackendSessionValid(session, expected)) {
    return null;
  }

  if (session !== stored) {
    storeBackendSession(session);
  }

  return session;
};

const storeBackendSession = (session: StoredBackendSession): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    const sanitized = sanitizeBackendSession(session);
    storage.setItem(BACKEND_SESSION_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.warn('Failed to store backend session', error);
  }
};

const clearStoredBackendSession = (): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(BACKEND_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear backend session', error);
  }
};

const normaliseHeaders = (headers: unknown): Record<string, string> => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

const convertEpochToIsoString = (value: number): string | null => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const timestampMs = value >= 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const normaliseExpiresAtValue = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return convertEpochToIsoString(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) {
      const numericValue = Number(trimmed);
      const isoFromNumeric = convertEpochToIsoString(numericValue);
      if (isoFromNumeric) {
        return isoFromNumeric;
      }
    }

    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return new Date(parsed).toISOString();
  }

  return null;
};

async function requestBackendSession({
  userId,
  email,
  sessionId,
  refreshToken,
  baseUrl,
}: EnsureBackendSessionOptions): Promise<BackendSession> {
  const normalizedUserId = normalizeUserIdentifier(userId);
  if (!normalizedUserId) {
    throw new AvatarApiError('Missing user identifier for backend session request');
  }
  const normalizedSessionId = normalizeSessionIdentifier(sessionId);
  if (!normalizedSessionId) {
    throw new AvatarApiError('Missing session identifier for backend session request');
  }

  const apiRoot = deriveApiRoot(baseUrl);
  const url = `${apiRoot}/auth/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(AVATAR_API_KEY ? { 'x-api-key': AVATAR_API_KEY } : {}),
    },
    body: JSON.stringify({
      userId: normalizedUserId,
      email,
      sessionId: normalizedSessionId,
      refreshToken,
      ...(AVATAR_API_KEY ? { apiKey: AVATAR_API_KEY } : {}),
    }),
  });

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    const details = await readErrorResponse(response);
    const message = details
      ? `Backend session request failed (${response.status} ${statusText}): ${details}`
      : `Backend session request failed (${response.status} ${statusText})`;

    throw new AvatarApiError(message, {
      status: response.status,
      statusText,
    });
  }

  const body = await readJsonBody(response);
  if (!body || typeof body !== 'object') {
    throw new AvatarApiError('Backend session response payload is invalid');
  }

  const token = typeof (body as { token?: unknown }).token === 'string'
    ? (body as { token: string }).token
    : undefined;

  const rawExpiresAt = (body as { expiresAt?: unknown }).expiresAt;
  const expiresAt = normaliseExpiresAtValue(rawExpiresAt) ?? undefined;
  const additionalHeaders = normaliseHeaders((body as { headers?: unknown }).headers);

  if (!token || !expiresAt) {
    throw new AvatarApiError('Backend session response is missing token or expiry');
  }

  const headers = {
    ...additionalHeaders,
    Authorization: `Bearer ${token}`,
    'X-User-Email': email,
    'X-Session-Id': normalizedSessionId,
    ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
  };

  return { token, expiresAt, headers };
}

export async function ensureBackendSession(
  options: EnsureBackendSessionOptions,
): Promise<BackendSession> {
  const { email, refreshToken } = options;
  const sanitizedUserId = normalizeUserIdentifier(options.userId);
  const sanitizedSessionId = normalizeSessionIdentifier(options.sessionId);

  if (!sanitizedUserId) {
    throw new AvatarApiError('Missing user identifier for backend session request');
  }

  if (!email) {
    throw new AvatarApiError('Missing email for backend session request');
  }

  if (!sanitizedSessionId) {
    throw new AvatarApiError('Missing session identifier for backend session request');
  }

  if (!refreshToken) {
    throw new AvatarApiError('Missing refresh token for backend session request');
  }

  const stored = readStoredBackendSession({
    userId: sanitizedUserId,
    email,
    sessionId: sanitizedSessionId,
    refreshToken,
  });

  if (stored) {
    return stored;
  }

  const storedSession = sanitizeBackendSession({
    ...(await requestBackendSession({
      ...options,
      userId: sanitizedUserId,
      sessionId: sanitizedSessionId,
    })),
    metadata: {
      userId: sanitizedUserId,
      email,
      sessionId: sanitizedSessionId,
      refreshToken,
    },
  });
  storeBackendSession(storedSession);

  return storedSession;
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

const normalizeSessionIdentifier = (value: unknown): string | undefined =>
  normalizeUuidLikeIdentifier(value);

const normalizeUserIdentifier = (value: unknown): string | undefined =>
  normalizeUuidLikeIdentifier(value);

const normalizeCreationMode = (value: unknown): AvatarCreationMode | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  const matched = ALLOWED_CREATION_MODES.find(mode => mode.toLowerCase() === lower);
  return matched ?? null;
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
        const creationMode = normalizeCreationMode(value);
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
  sessionId?: string,
): Record<string, unknown> => {
  const request: Record<string, unknown> = {
    name: payload.name,
  };

  if (payload.gender) {
    request.gender = payload.gender;
  }
  if (payload.ageRange) {
    request.ageRange = payload.ageRange;
  }
  if (payload.creationMode) {
    request.creationMode = payload.creationMode;
  }
  if (typeof payload.quickMode === 'boolean') {
    request.quickMode = payload.quickMode;
  }
  if (payload.source) {
    request.source = payload.source;
  }
  const sanitizedSessionId = normalizeSessionIdentifier(sessionId);
  if (sanitizedSessionId) {
    request.createdBySession = sanitizedSessionId;
  }

  // Uključi creationMode iz measurements SAMO ako nije zadan na top-levelu
  const basicMeasurements = sanitizeMeasurementPayload(
    payload.basicMeasurements as Record<string, unknown> | undefined,
    { includeCreationMode: !payload.creationMode },
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
  const ageRange = normalizeString(candidate.ageRange) ?? '';
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
  const ageRange = normalizeString(payload.ageRange) ?? undefined;
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
  sessionId,
}: AvatarApiAuth): Promise<AvatarListItem[]> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarCollectionUrl(baseUrl, sanitizedUserId);
  const effectiveSessionId = normalizeSessionIdentifier(
    sessionId ?? backendSession.headers['X-Session-Id'],
  );

  const headers: Record<string, string> = {
    ...backendSession.headers,
    Accept: 'application/json',
  };

  if (!('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  if (sanitizedUserId && !('X-User-Id' in headers)) {
    headers['X-User-Id'] = sanitizedUserId;
  }

  if (effectiveSessionId && !('X-Session-Id' in headers)) {
    headers['X-Session-Id'] = effectiveSessionId;
  }

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
  sessionId,
}: CreateAvatarRequest): Promise<AvatarApiResult> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarCollectionUrl(baseUrl, sanitizedUserId);
  const effectiveSessionId = normalizeSessionIdentifier(
    sessionId ?? backendSession.headers['X-Session-Id'],
  );

  const headers: Record<string, string> = {
    ...backendSession.headers,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (sanitizedUserId && !('X-User-Id' in headers)) {
    headers['X-User-Id'] = sanitizedUserId;
  }

  if (effectiveSessionId && !('X-Session-Id' in headers)) {
    headers['X-Session-Id'] = effectiveSessionId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(
      buildBackendAvatarRequestPayload(payload, effectiveSessionId),
    ),
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
  sessionId,
}: UpdateAvatarMeasurementsRequest): Promise<AvatarApiResult> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarUrl(baseUrl, sanitizedUserId, avatarId);
  const effectiveSessionId = normalizeSessionIdentifier(
    sessionId ?? backendSession.headers['X-Session-Id'],
  );

  const headers: Record<string, string> = {
    ...backendSession.headers,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (sanitizedUserId && !('X-User-Id' in headers)) {
    headers['X-User-Id'] = sanitizedUserId;
  }

  if (effectiveSessionId && !('X-Session-Id' in headers)) {
    headers['X-Session-Id'] = effectiveSessionId;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(
      buildBackendAvatarRequestPayload(payload, effectiveSessionId),
    ),
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
  sessionId,
}: AvatarApiAuth & { avatarId: string | number }): Promise<void> {
  const sanitizedUserId = normalizeUserIdentifier(userId) ?? userId;
  const url = resolveAvatarUrl(baseUrl, sanitizedUserId, avatarId);
  const effectiveSessionId = normalizeSessionIdentifier(
    sessionId ?? backendSession.headers['X-Session-Id'],
  );

  const headers: Record<string, string> = {
    ...backendSession.headers,
    Accept: 'application/json',
  };

  if (!('Content-Type' in headers)) headers['Content-Type'] = 'application/json';
  if (sanitizedUserId && !('X-User-Id' in headers)) headers['X-User-Id'] = sanitizedUserId;
  if (effectiveSessionId && !('X-Session-Id' in headers)) headers['X-Session-Id'] = effectiveSessionId;

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
    Accept: 'application/json',
  };

  if (!('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  if (sanitizedUserId && !('X-User-Id' in headers)) {
    headers['X-User-Id'] = sanitizedUserId;
  }
  
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

    if (!refreshToken) {
      throw new AvatarApiError(
        'Missing refresh token; please sign in again to continue using avatar features.',
      );
    }

    return ensureBackendSession({
      userId,
      email,
      sessionId,
      refreshToken,
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
      let session = await ensureSession();

      try {
        return await operation(session);
      } catch (error) {
        if (error instanceof AvatarApiError && error.status === 401) {
          clearStoredBackendSession();
          session = await ensureSession();
          return await operation(session);
        }

        throw error;
      }
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
          sessionId,
        }),
      );
    },
    [
      authData.isAuthenticated,
      config?.baseUrl,
      sessionId,
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
        sessionId,
      }),
    );
  }, [authData.isAuthenticated, config?.baseUrl, sessionId, userId, withBackendSession]);

  const updateAvatarMeasurements = useCallback(
    async (
      avatarId: string | number,
      payload: AvatarPayload,
      options?: { morphTargets?: Record<string, number> },
    ): Promise<AvatarApiResult> => {
      if (!authData.isAuthenticated || !userId) {
        throw new AvatarApiError('User is not authenticated to update avatars');
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
          sessionId,
        }),
      );
    },
    [
      authData.isAuthenticated,
      config?.baseUrl,
      sessionId,
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
          sessionId,
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
    [authData.isAuthenticated, config?.baseUrl, sessionId, userId, withBackendSession],
  );

  return {
    fetchAvatarById,
    createAvatar,
    listAvatars,
    updateAvatarMeasurements,
    deleteAvatar,
  };
}
