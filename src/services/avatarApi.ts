import { useCallback } from 'react';
import { useAuthData } from '../hooks/useAuthData';
import type { BackendAvatarData } from '../context/AvatarConfigurationContext';

const DEFAULT_AVATAR_API_BASE_URL =
  (import.meta.env.VITE_AVATAR_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  '';

export const LAST_LOADED_AVATAR_STORAGE_KEY = 'fitspace:lastAvatarId';

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

  return {
    fetchAvatarById,
  };
}