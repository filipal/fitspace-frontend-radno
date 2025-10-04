import { useCallback } from 'react';
import { useAuthData } from '../hooks/useAuthData';
import type {
  BackendAvatarData,
  BasicMeasurements,
  BodyMeasurements,
} from '../context/AvatarConfigurationContext';

// VITE_AVATAR_API_BASE_URL must be defined; otherwise resolveAvatarUrl throws an AvatarApiError.
const DEFAULT_AVATAR_API_BASE_URL =
  (import.meta.env.VITE_AVATAR_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  '';

const DEFAULT_BACKEND_API_ROOT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

const BACKEND_SESSION_STORAGE_KEY = 'fitspace:backendSession';
const BACKEND_AUTH_API_KEY = import.meta.env
  .VITE_BACKEND_AUTH_API_KEY as string | undefined;

export const LAST_LOADED_AVATAR_STORAGE_KEY = 'fitspace:lastAvatarId';
export const LAST_CREATED_AVATAR_METADATA_STORAGE_KEY =
  'fitspace:lastAvatarMetadata';

export type AvatarApiMeasurements = Partial<BodyMeasurements>;

export interface AvatarPayload {
  avatarName: string;
  gender: 'male' | 'female';
  ageRange: string;
  basicMeasurements?: Partial<BasicMeasurements>;
  bodyMeasurements?: AvatarApiMeasurements;
  morphTargets?: Record<string, number>;
}

interface AvatarApiAuth {
  backendSession: BackendSession;
  userId: string;
  baseUrl?: string;
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
  expected: { email: string; sessionId: string; refreshToken: string },
): boolean => {
  if (
    session.metadata.email !== expected.email ||
    session.metadata.sessionId !== expected.sessionId ||
    session.metadata.refreshToken !== expected.refreshToken
  ) {
    return false;
  }

  const expiryTimestamp = Date.parse(session.expiresAt);
  if (Number.isNaN(expiryTimestamp)) {
    return false;
  }

  const now = Date.now();
  const buffer = 30_000; // 30 seconds safety buffer
  return now + buffer < expiryTimestamp;
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

  if (stored.metadata.userId !== expected.userId) {
    return null;
  }

  if (!isBackendSessionValid(stored, expected)) {
    return null;
  }

  return stored;
};

const storeBackendSession = (session: StoredBackendSession): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(BACKEND_SESSION_STORAGE_KEY, JSON.stringify(session));
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

async function requestBackendSession({
  userId,
  email,
  sessionId,
  refreshToken,
  baseUrl,
}: EnsureBackendSessionOptions): Promise<BackendSession> {
  const apiRoot = deriveApiRoot(baseUrl);
  const url = `${apiRoot}/auth/token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(BACKEND_AUTH_API_KEY ? { 'x-api-key': BACKEND_AUTH_API_KEY } : {}),
    },
    body: JSON.stringify({ userId, email, sessionId, refreshToken }),
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
  const expiresAt = typeof (body as { expiresAt?: unknown }).expiresAt === 'string'
    ? (body as { expiresAt: string }).expiresAt
    : undefined;
  const additionalHeaders = normaliseHeaders((body as { headers?: unknown }).headers);

  if (!token || !expiresAt) {
    throw new AvatarApiError('Backend session response is missing token or expiry');
  }

  const headers = {
    ...additionalHeaders,
    Authorization: `Bearer ${token}`,
    'X-User-Email': email,
    'X-Session-Id': sessionId,
    ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
  };

  return { token, expiresAt, headers };
}

export async function ensureBackendSession(
  options: EnsureBackendSessionOptions,
): Promise<BackendSession> {
  const { userId, email, sessionId, refreshToken } = options;

  if (!userId) {
    throw new AvatarApiError('Missing user identifier for backend session request');
  }

  if (!email) {
    throw new AvatarApiError('Missing email for backend session request');
  }

  if (!sessionId) {
    throw new AvatarApiError('Missing session identifier for backend session request');
  }

  if (!refreshToken) {
    throw new AvatarApiError('Missing refresh token for backend session request');
  }

  const stored = readStoredBackendSession({
    userId,
    email,
    sessionId,
    refreshToken,
  });

  if (stored) {
    return stored;
  }

  const session = await requestBackendSession(options);
  storeBackendSession({
    ...session,
    metadata: { userId, email, sessionId, refreshToken },
  });

  return session;
}

const resolveUserRootUrl = (baseUrl: string, userId: string): string => {
  const normalisedBase = ensureTrailingSlash(trimTrailingSlashes(baseUrl));
  return `${normalisedBase}${encodePathSegment(userId)}`;
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

function extractBackendAvatar(data: unknown): BackendAvatarData | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  if ((data as BackendAvatarData).type === 'createAvatar') {
    return data as BackendAvatarData;
  }

  const candidate = (data as { data?: unknown; avatar?: unknown }).data;
  if (candidate && typeof candidate === 'object') {
    if ((candidate as BackendAvatarData).type === 'createAvatar') {
      return candidate as BackendAvatarData;
    }
  }

  const avatarCandidate = (data as { avatar?: unknown }).avatar;
  if (avatarCandidate && typeof avatarCandidate === 'object') {
    if ((avatarCandidate as BackendAvatarData).type === 'createAvatar') {
      return avatarCandidate as BackendAvatarData;
    }
  }

  return undefined;
}

function extractAvatarId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  if (typeof (data as { avatarId?: unknown }).avatarId === 'string') {
    return (data as { avatarId: string }).avatarId;
  }

  if (typeof (data as { id?: unknown }).id === 'string') {
    return (data as { id: string }).id;
  }

  const dataField = (data as { data?: unknown }).data;
  if (dataField && typeof dataField === 'object') {
    if (typeof (dataField as { avatarId?: unknown }).avatarId === 'string') {
      return (dataField as { avatarId: string }).avatarId;
    }
  }

  return undefined;
}

async function createAvatarRequest({
  backendSession,
  userId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
  payload,
}: CreateAvatarRequest): Promise<AvatarApiResult> {
  const url = resolveAvatarCollectionUrl(baseUrl, userId);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...backendSession.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response);

  const body = await readJsonBody(response);
  const backendAvatar = extractBackendAvatar(body) ?? null;
  const avatarId = extractAvatarId(body);

  if (!avatarId) {
    throw new AvatarApiError('Avatar creation response did not include an avatarId');
  }

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
  const url = resolveAvatarUrl(baseUrl, userId, avatarId);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...backendSession.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response);

  const body = await readJsonBody(response);
  const backendAvatar = extractBackendAvatar(body) ?? null;
  const nextAvatarId =
    extractAvatarId(body) ?? (typeof avatarId === 'string' ? avatarId : String(avatarId));

  return {
    avatarId: nextAvatarId,
    backendAvatar,
    responseBody: body,
  };
}

export async function fetchAvatarByIdRequest({
  avatarId,
  userId,
  backendSession,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
}: FetchAvatarByIdRequest): Promise<BackendAvatarData> {

  if (!userId) {
    throw new AvatarApiError('Missing user identifier for avatar request');
  }

  const url = resolveAvatarUrl(baseUrl, userId, avatarId);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...backendSession.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-User-Id': userId,
    },
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

  return response.json() as Promise<BackendAvatarData>;
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
        }),
      );
    },
    [authData.isAuthenticated, config?.baseUrl, userId, withBackendSession],
  );

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
        avatarName: payload.avatarName,
        gender: payload.gender,
        ageRange: payload.ageRange,
        ...(payload.basicMeasurements
          ? { basicMeasurements: { ...payload.basicMeasurements } }
          : {}),
        ...(payload.bodyMeasurements
          ? { bodyMeasurements: { ...payload.bodyMeasurements } }
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
    [authData.isAuthenticated, config?.baseUrl, userId, withBackendSession],
  );

  return {
    fetchAvatarById,
    createAvatar,
    updateAvatarMeasurements,
  };
}