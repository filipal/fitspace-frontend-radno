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
  accessToken: string;
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

interface UpdateAvatarMorphTargetsRequest extends AvatarApiAuth {
  avatarId: string | number;
  payload: Record<string, number>;
}

export interface AvatarApiResult {
  avatarId?: string;
  backendAvatar?: BackendAvatarData | null;
  responseBody: unknown;
}

export interface FetchAvatarByIdRequest {
  avatarId: string | number;
  accessToken: string;
  userId: string;
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

function resolveAvatarUrl(baseUrl: string, avatarId: string | number): string {
  if (!baseUrl) {
    throw new AvatarApiError('Avatar API base URL is not configured');
  }

  try {
    return new URL(`/avatars/${avatarId}`, baseUrl).toString();
  } catch {
    // Fallback for cases where baseUrl might already contain path segments
    const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmedBase}/avatars/${avatarId}`;
  }
}

function resolveAvatarCollectionUrl(baseUrl: string): string {
  if (!baseUrl) {
    throw new AvatarApiError('Avatar API base URL is not configured');
  }

  try {
    return new URL('/avatars', baseUrl).toString();
  } catch {
    const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmedBase}/avatars`;
  }
}

function resolveAvatarMeasurementsUrl(
  baseUrl: string,
  avatarId: string | number,
): string {
  const avatarUrl = resolveAvatarUrl(baseUrl, avatarId);
  return avatarUrl.endsWith('/measurements')
    ? avatarUrl
    : `${avatarUrl.replace(/\/+$/, '')}/measurements`;
}

function resolveAvatarMorphTargetsUrl(
  baseUrl: string,
  avatarId: string | number,
): string {
  const avatarUrl = resolveAvatarUrl(baseUrl, avatarId);
  return avatarUrl.endsWith('/morph-targets')
    ? avatarUrl
    : `${avatarUrl.replace(/\/+$/, '')}/morph-targets`;
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
  accessToken,
  userId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
  payload,
}: CreateAvatarRequest): Promise<AvatarApiResult> {
  const url = resolveAvatarCollectionUrl(baseUrl);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  accessToken,
  userId,
  avatarId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
  payload,
}: UpdateAvatarMeasurementsRequest): Promise<AvatarApiResult> {
  const url = resolveAvatarMeasurementsUrl(baseUrl, avatarId);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(payload),
  });

  await ensureOk(response);

  const body = await readJsonBody(response);
  const backendAvatar = extractBackendAvatar(body) ?? null;
  const nextAvatarId = extractAvatarId(body) ?? (typeof avatarId === 'string' ? avatarId : String(avatarId));

  return {
    avatarId: nextAvatarId,
    backendAvatar,
    responseBody: body,
  };
}

async function updateAvatarMorphTargetsRequest({
  accessToken,
  userId,
  avatarId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
  payload,
}: UpdateAvatarMorphTargetsRequest): Promise<AvatarApiResult> {
  const url = resolveAvatarMorphTargetsUrl(baseUrl, avatarId);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  accessToken,
  userId,
  baseUrl = DEFAULT_AVATAR_API_BASE_URL,
}: FetchAvatarByIdRequest): Promise<BackendAvatarData> {
  if (!accessToken) {
    throw new AvatarApiError('Missing access token for avatar request');
  }

  if (!userId) {
    throw new AvatarApiError('Missing user identifier for avatar request');
  }

  const url = resolveAvatarUrl(baseUrl, avatarId);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  const accessToken = authData.authData?.accessToken ?? undefined;
  const userId = authData.userId ?? undefined;

  const fetchAvatarById = useCallback(
    async (avatarId: string | number): Promise<BackendAvatarData> => {
      if (!authData.isAuthenticated || !accessToken || !userId) {
        throw new AvatarApiError('User is not authenticated to load avatars');
      }

      return fetchAvatarByIdRequest({
        avatarId,
        accessToken,
        userId,
        baseUrl: config?.baseUrl,
      });
    },
    [accessToken, authData.isAuthenticated, config?.baseUrl, userId],
  );

  const createAvatar = useCallback(
    async (payload: AvatarPayload): Promise<AvatarApiResult> => {
      if (!authData.isAuthenticated || !accessToken || !userId) {
        throw new AvatarApiError('User is not authenticated to create avatars');
      }

      return createAvatarRequest({
        accessToken,
        userId,
        baseUrl: config?.baseUrl,
        payload,
      });
    },
    [accessToken, authData.isAuthenticated, config?.baseUrl, userId],
  );

  const updateAvatarMeasurements = useCallback(
    async (
      avatarId: string | number,
      payload: AvatarPayload,
    ): Promise<AvatarApiResult> => {
      if (!authData.isAuthenticated || !accessToken || !userId) {
        throw new AvatarApiError('User is not authenticated to update avatars');
      }

      return updateAvatarMeasurementsRequest({
        accessToken,
        userId,
        avatarId,
        baseUrl: config?.baseUrl,
        payload,
      });
    },
    [accessToken, authData.isAuthenticated, config?.baseUrl, userId],
  );

  const updateMorphTargets = useCallback(
    async (
      avatarId: string | number,
      morphTargets: Record<string, number>,
    ): Promise<AvatarApiResult> => {
      if (!authData.isAuthenticated || !accessToken || !userId) {
        throw new AvatarApiError('User is not authenticated to update avatar morph targets');
      }

      return updateAvatarMorphTargetsRequest({
        accessToken,
        userId,
        avatarId,
        baseUrl: config?.baseUrl,
        payload: morphTargets,
      });
    },
    [accessToken, authData.isAuthenticated, config?.baseUrl, userId],
  );

  return {
    fetchAvatarById,
    createAvatar,
    updateAvatarMeasurements,
    updateMorphTargets, 
  };
}