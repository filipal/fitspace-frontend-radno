import React, { createContext, useState, useCallback, useMemo, useRef } from 'react';
import { morphAttributes, type MorphAttribute } from '../data/morphAttributes';
import {
  convertMorphValueToBackendValue,
  getBackendKeyForMorphId,
  mapBackendMorphTargetsToRecord,
  transformBackendDataToMorphs,
} from '../services/avatarTransformationService';
import { deriveMorphTargetsFromMeasurements } from '../services/morphDerivation';
import {
  calculateMeasurementFromMorphs,
  computeBaselineMeasurementsFromBasics,
  inferMeasurementKeyFromMorph,
} from '../utils/morphMeasurementSync';
import {
  useAvatarApi,
  buildBackendMorphPayload,
  type AvatarPayload,
  LAST_LOADED_AVATAR_STORAGE_KEY,
  LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
} from '../services/avatarApi';
import { useAuthData } from '../hooks/useAuthData';

export type AvatarCreationMode = 'manual' | 'scan' | 'preset' | 'import' | 'quickMode';

export interface BasicMeasurements {
  height?: number;
  weight?: number;
  creationMode?: AvatarCreationMode | null;
  [key: string]: number | AvatarCreationMode | null | undefined;
}

export interface BodyMeasurements {
  shoulder?: number;
  chest?: number;
  underchest?: number;
  waist?: number;
  highHip?: number;
  lowHip?: number;
  inseam?: number;
  highThigh?: number;
  midThigh?: number;
  knee?: number;
  calf?: number;
  ankle?: number;
  footLength?: number;
  footBreadth?: number;
  bicep?: number;
  forearm?: number;
  wrist?: number;
  shoulderToWrist?: number;
  handLength?: number;
  handBreadth?: number;
  neck?: number;
  head?: number;
}

// Backend JSON structure
export interface QuickModeSettings {
  bodyShape?: string | null;
  athleticLevel?: string | null;
  measurements?: Record<string, number>;
  updatedAt?: string | null;
}

export interface BackendAvatarMorphTarget {
  name: string;
  value: number;
}

export interface BackendAvatarData {
  type: 'createAvatar';
  id: string;
  name: string;
  gender: 'male' | 'female';
  ageRange: string;
  quickMode?: boolean;
  creationMode?: AvatarCreationMode | null;
  source?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBySession?: string | null;
  basicMeasurements?: BasicMeasurements;
  bodyMeasurements?: BodyMeasurements;
  morphTargets: BackendAvatarMorphTarget[];
  quickModeSettings?: QuickModeSettings | null;
}

// Current avatar state
export interface AvatarConfiguration {
  avatarId?: string;
  avatarName?: string;
  name?: string;
  gender: 'male' | 'female';
  ageRange?: string;
  basicMeasurements?: Partial<BasicMeasurements>;
  bodyMeasurements?: Partial<BodyMeasurements>;
  quickMode?: boolean;
  creationMode?: AvatarCreationMode | null;
  source?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBySession?: string | null;
  quickModeSettings?: QuickModeSettings | null;
  baselineMeasurements?: Partial<BodyMeasurements>;
  morphValues: MorphAttribute[]; // Using your existing structure
  lastUpdated: Date;
}

export interface AvatarConfigurationContextType {
  // Current avatar state
  currentAvatar: AvatarConfiguration | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Save states
  isSavingPendingChanges: boolean;
  savePendingChangesError: string | null;

  // Avatar management
  loadAvatarFromBackend: (
    backendData: BackendAvatarData,
    transformedMorphs?: MorphAttribute[],
    avatarId?: string
  ) => Promise<AvatarConfiguration>;
  updateMorphValue: (morphId: number, value: number) => void;
  updateQuickModeMeasurements: (
    patch: Record<string, number | null | undefined>,
  ) => void;
  resetAvatar: () => void;

  savePendingChanges: (options?: SavePendingChangesOptions) => Promise<SavePendingChangesResult>;

  // Utility functions
  getMorphByName: (morphName: string) => MorphAttribute | undefined;
  getMorphById: (morphId: number) => MorphAttribute | undefined;
  getMorphsByCategory: (category: string) => MorphAttribute[];
  
  // Export current configuration
  getAvatarConfiguration: () => AvatarConfiguration | null;
}

const AvatarConfigurationContext = createContext<AvatarConfigurationContextType | undefined>(undefined);

export { AvatarConfigurationContext };

// Custom hook to use Avatar Configuration context
export function useAvatarConfiguration(): AvatarConfigurationContextType {
  const context = React.useContext(AvatarConfigurationContext);
  if (context === undefined) {
    throw new Error('useAvatarConfiguration must be used within an AvatarConfigurationProvider');
  }
  return context;
}

export interface SavePendingChangesOptions {
  activeAvatarId?: string | null;
  computedFallbacks?: Record<string, number>;
}

export interface SavePendingChangesResult {
  success: boolean;
  error?: string | null;
  avatarId?: string | null;
}

// Provider component
export function AvatarConfigurationProvider({ children }: { children: React.ReactNode }) {
  const [currentAvatar, setCurrentAvatar] = useState<AvatarConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingPendingChanges, setIsSavingPendingChanges] = useState(false);
  const [savePendingChangesError, setSavePendingChangesError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);

  const { isAuthenticated } = useAuthData();
  const { fetchAvatarById, updateAvatarMeasurements } = useAvatarApi();

  // Initialize default morph values (all at neutral 50)
  const initializeDefaultMorphs = useCallback((): MorphAttribute[] => {
    return morphAttributes.map(morph => ({
      ...morph,
      value: 50 // Default neutral position
    }));
  }, []);

  // Load avatar from backend JSON
  const loadAvatarFromBackend = useCallback(async (
    backendData: BackendAvatarData,
    transformedMorphs?: MorphAttribute[],
    avatarId?: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Loading avatar from backend data:', backendData);
      
      // Start with provided morphs or transform backend data
      const morphTargetMap = mapBackendMorphTargetsToRecord(backendData.morphTargets);

      const baseMorphs =
        transformedMorphs ??
        transformBackendDataToMorphs(
          morphTargetMap,
          backendData.gender,
          initializeDefaultMorphs()
        );

      const initialMorphValues = baseMorphs.map(m => ({ ...m }));

      const basicMeasurements =
        backendData.basicMeasurements
          ? { ...backendData.basicMeasurements }
          : undefined;

      const bodyMeasurements =
        backendData.bodyMeasurements
          ? { ...backendData.bodyMeasurements }
          : undefined;

      const baselineMeasurements = computeBaselineMeasurementsFromBasics(basicMeasurements);

      const quickModeSettings =
        backendData.quickModeSettings
          ? {
              ...backendData.quickModeSettings,
              measurements: backendData.quickModeSettings.measurements
                ? { ...backendData.quickModeSettings.measurements }
                : undefined,
            }
          : null;

      const morphValues = deriveMorphTargetsFromMeasurements(
        initialMorphValues,
        {
          basicMeasurements,
          bodyMeasurements,
          quickModeSettings,
        },
        { gender: backendData.gender },
      );

      // Apply backend morph values (this will be handled by transformation service)
      // For now, we'll just store the data as-is
      const nextAvatarId = backendData.id ?? avatarId;
      const avatarConfig: AvatarConfiguration = {
        avatarId: nextAvatarId,     // ⬅️ koristi varijablu
        avatarName: backendData.name,
        name: backendData.name,
        gender: backendData.gender,
        ageRange: backendData.ageRange,
        basicMeasurements,
        bodyMeasurements,
        quickMode: backendData.quickMode,
        creationMode: backendData.creationMode ?? null,
        source: backendData.source ?? null,
        createdAt: backendData.createdAt ?? null,
        updatedAt: backendData.updatedAt ?? null,
        createdBySession: backendData.createdBySession ?? null,
        quickModeSettings,
        baselineMeasurements,
        morphValues,
        lastUpdated: new Date(),
      };
      
      const nextAvatarConfig: AvatarConfiguration = {
        ...avatarConfig,
        morphValues: avatarConfig.morphValues.map(m => ({ ...m })),
        baselineMeasurements: avatarConfig.baselineMeasurements
          ? { ...avatarConfig.baselineMeasurements }
          : undefined,
      };

      setCurrentAvatar(nextAvatarConfig);
      console.log('Avatar loaded successfully:', nextAvatarConfig);

      return nextAvatarConfig; // Return the config for immediate use
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load avatar';
      setError(errorMessage);
      console.error('Avatar loading error:', errorMessage, err);
      throw err; // Re-throw to let caller handle it
    } finally {
      setIsLoading(false);
    }
  }, [initializeDefaultMorphs]);

  // Update individual morph value
  const updateMorphValue = useCallback((morphId: number, value: number) => {
    setCurrentAvatar(prev => {
      if (!prev) return prev;

      const updatedMorphValues = prev.morphValues.map(m =>
        m.morphId === morphId ? { ...m, value } : m
      );

      const targetMorph =
        prev.morphValues.find(m => m.morphId === morphId) ??
        morphAttributes.find(m => m.morphId === morphId);

      const measurementKey = targetMorph ? inferMeasurementKeyFromMorph(targetMorph) : null;
      const isQuickModeAvatar =
        prev.quickMode ||
        prev.creationMode === 'quickMode' ||
        prev.basicMeasurements?.creationMode === 'quickMode';

      let updatedBodyMeasurements = prev.bodyMeasurements;
      let updatedQuickModeSettings = prev.quickModeSettings ?? null;

      if (isQuickModeAvatar && measurementKey) {
        const baselineValue = prev.baselineMeasurements?.[measurementKey];
        const previousMeasurement = prev.bodyMeasurements?.[measurementKey];
        const recalculatedMeasurement = calculateMeasurementFromMorphs(
          updatedMorphValues,
          measurementKey,
          baselineValue,
          previousMeasurement,
        );

        if (recalculatedMeasurement != null) {
          updatedBodyMeasurements = {
            ...(prev.bodyMeasurements ?? {}),
            [measurementKey]: recalculatedMeasurement,
          };

          const previousSettings = prev.quickModeSettings ?? undefined;
          updatedQuickModeSettings = {
            ...(previousSettings ?? {}),
            measurements: {
              ...(previousSettings?.measurements ?? {}),
              [measurementKey]: recalculatedMeasurement,
            },
            updatedAt: new Date().toISOString(),
          };
        }
      }

      return {
        ...prev,
        morphValues: updatedMorphValues,
        bodyMeasurements: updatedBodyMeasurements,
        quickModeSettings: updatedQuickModeSettings,
        lastUpdated: new Date(),
      };
    });
  }, []);

  const updateQuickModeMeasurements = useCallback((patch: Record<string, number | null | undefined>) => {
    setCurrentAvatar(prev => {
      if (!prev) return prev;

      const previousSettings = prev.quickModeSettings ?? {};
      const previousMeasurements = previousSettings.measurements ?? {};
      const nextMeasurements = { ...previousMeasurements } as Record<string, number>;
      let changed = false;

      for (const [key, rawValue] of Object.entries(patch)) {
        if (rawValue == null) {
          if (key in nextMeasurements) {
            delete nextMeasurements[key];
            changed = true;
          }
          continue;
        }

        if (nextMeasurements[key] !== rawValue) {
          nextMeasurements[key] = rawValue;
          changed = true;
        }
      }

      if (!changed) {
        return prev;
      }

      const updatedQuickModeSettings: QuickModeSettings = {
        ...previousSettings,
        measurements: nextMeasurements,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        quickModeSettings: updatedQuickModeSettings,
        lastUpdated: new Date(),
      };
    });
  }, []);

  // Reset avatar to defaults
  const resetAvatar = useCallback(() => {
    setCurrentAvatar(null);
    setError(null);
    console.log('Avatar reset to default state');
  }, []);

  // Utility functions
  const getMorphByName = useCallback((morphName: string): MorphAttribute | undefined => {
    return currentAvatar?.morphValues.find(morph => morph.morphName === morphName);
  }, [currentAvatar]);

  const getMorphById = useCallback((morphId: number): MorphAttribute | undefined => {
    return currentAvatar?.morphValues.find(morph => morph.morphId === morphId);
  }, [currentAvatar]);

  const getMorphsByCategory = useCallback((category: string): MorphAttribute[] => {
    return currentAvatar?.morphValues.filter(morph => morph.category === category) || [];
  }, [currentAvatar]);

  const getAvatarConfiguration = useCallback((): AvatarConfiguration | null => {
    return currentAvatar;
  }, [currentAvatar]);

  const savePendingChanges = useCallback(async (
    options?: SavePendingChangesOptions,
  ): Promise<SavePendingChangesResult> => {
    if (!currentAvatar) {
      const message = 'No avatar available to save pending changes';
      setSavePendingChangesError(message);
      return { success: false, error: message };
    }

    if (saveInFlightRef.current) {
      return { success: false, error: null, avatarId: currentAvatar.avatarId ?? null };
    }

    const resolvedFallbacks = options?.computedFallbacks ?? {};

    try {
      saveInFlightRef.current = true;
      setIsSavingPendingChanges(true);
      setSavePendingChangesError(null);

      const morphTargets = currentAvatar.morphValues.reduce<Record<string, number>>((acc, morph) => {
        const backendKey = getBackendKeyForMorphId(morph.morphId);
        if (!backendKey) {
          return acc;
        }

        const backendValue = convertMorphValueToBackendValue(morph.value, morph);
        if (Number.isFinite(backendValue)) {
          acc[backendKey] = backendValue;
        }
        return acc;
      }, {});

      const mergedBodyMeasurements: Record<string, number> = {
        ...(currentAvatar.bodyMeasurements ?? {}),
      };

      for (const [key, value] of Object.entries(resolvedFallbacks)) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          continue;
        }

        const existing = mergedBodyMeasurements[key];
        if (existing == null || !Number.isFinite(Number(existing))) {
          mergedBodyMeasurements[key] = numericValue;
        }
      }

      const basicMeasurementsWithoutMode = currentAvatar.basicMeasurements
        ? (() => {
            const { creationMode: _ignored, ...rest } = currentAvatar.basicMeasurements!;
            return rest;
          })()
        : undefined;

      const resolvedAvatarId = options?.activeAvatarId ?? currentAvatar.avatarId ?? 'guest';

      const basePayload: AvatarPayload = {
        name: currentAvatar.avatarName ?? 'Avatar',
        gender: currentAvatar.gender,
        ageRange: currentAvatar.ageRange ?? '20-29',
        creationMode: currentAvatar.creationMode ?? 'manual',
        quickMode: currentAvatar.quickMode ?? true,
        source: currentAvatar.source ?? (isAuthenticated ? 'web' : 'guest'),
        ...(basicMeasurementsWithoutMode
          ? { basicMeasurements: { ...basicMeasurementsWithoutMode } }
          : {}),
        ...(Object.keys(mergedBodyMeasurements).length
          ? { bodyMeasurements: { ...mergedBodyMeasurements } }
          : {}),
        ...(currentAvatar.quickModeSettings
          ? {
              quickModeSettings: {
                ...currentAvatar.quickModeSettings,
                ...(currentAvatar.quickModeSettings?.measurements
                  ? { measurements: { ...currentAvatar.quickModeSettings.measurements } }
                  : {}),
              },
            }
          : {}),
        morphTargets,
      };

      const morphs = buildBackendMorphPayload({ ...basePayload });
      const payload: AvatarPayload = {
        ...basePayload,
        ...(morphs ? { morphs } : {}),
      };
      if (morphs) {
        delete (payload as { morphTargets?: Record<string, number> }).morphTargets;
      }

      const result = await updateAvatarMeasurements(resolvedAvatarId, payload, {
        morphTargets: basePayload.morphTargets,
      });

      const persistedAvatarId =
        result.backendAvatar?.id ?? result.avatarId ??
        (typeof resolvedAvatarId === 'number' ? String(resolvedAvatarId) : resolvedAvatarId);

      if (typeof window !== 'undefined' && persistedAvatarId) {
        window.sessionStorage.setItem(LAST_LOADED_AVATAR_STORAGE_KEY, persistedAvatarId);

        const storageMorphTargets =
          result.backendAvatar?.morphTargets ??
          (Array.isArray(morphs)
            ? morphs
                .map(morph => {
                  if (!morph) {
                    return null;
                  }
                  const key = morph.backendKey ?? morph.id;
                  const value = Number(morph.sliderValue);
                  if (!key || !Number.isFinite(value)) {
                    return null;
                  }
                  return { name: key, value };
                })
                .filter((entry): entry is { name: string; value: number } => Boolean(entry))
            : undefined) ??
          (basePayload.morphTargets
            ? Object.entries(basePayload.morphTargets).reduce<BackendAvatarMorphTarget[]>(
                (acc, [key, value]) => {
                  if (!key) {
                    return acc;
                  }
                  const numericValue = Number(value);
                  if (Number.isFinite(numericValue)) {
                    acc.push({ name: key, value: numericValue });
                  }
                  return acc;
                },
                [],
              )
            : undefined);

        window.sessionStorage.setItem(
          LAST_CREATED_AVATAR_METADATA_STORAGE_KEY,
          JSON.stringify({
            avatarId: persistedAvatarId,
            name: result.backendAvatar?.name ?? basePayload.name,
            avatarName: result.backendAvatar?.name ?? basePayload.name,
            gender: result.backendAvatar?.gender ?? basePayload.gender,
            ageRange: result.backendAvatar?.ageRange ?? basePayload.ageRange,
            basicMeasurements:
              result.backendAvatar?.basicMeasurements ?? basePayload.basicMeasurements ?? null,
            bodyMeasurements:
              result.backendAvatar?.bodyMeasurements ?? basePayload.bodyMeasurements ?? null,
            morphTargets: storageMorphTargets ?? null,
            quickMode: result.backendAvatar?.quickMode ?? basePayload.quickMode,
            creationMode: result.backendAvatar?.creationMode ?? basePayload.creationMode,
            quickModeSettings:
              result.backendAvatar?.quickModeSettings ?? basePayload.quickModeSettings ?? null,
            source: result.backendAvatar?.source ?? basePayload.source,
          }),
        );
      }

      if (result.backendAvatar) {
        await loadAvatarFromBackend(result.backendAvatar, undefined, persistedAvatarId ?? undefined);
      } else if (persistedAvatarId) {
        try {
          const refreshed = await fetchAvatarById(persistedAvatarId);
          await loadAvatarFromBackend(refreshed, undefined, persistedAvatarId);
        } catch (refreshError) {
          const message =
            refreshError instanceof Error
              ? refreshError.message
              : 'Failed to refresh avatar after saving changes';
          setSavePendingChangesError(message);
          return { success: false, error: message, avatarId: persistedAvatarId };
        }
      }

      return { success: true, error: null, avatarId: persistedAvatarId ?? null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save avatar changes';
      setSavePendingChangesError(message);
      return { success: false, error: message, avatarId: currentAvatar.avatarId ?? null };
    } finally {
      saveInFlightRef.current = false;
      setIsSavingPendingChanges(false);
    }
  }, [
    currentAvatar,
    fetchAvatarById,
    isAuthenticated,
    loadAvatarFromBackend,
    updateAvatarMeasurements,
  ]);

  // Context value
  const value = useMemo(() => ({
    currentAvatar,
    isLoading,
    error,
    isSavingPendingChanges,
    savePendingChangesError,
    loadAvatarFromBackend,
    updateMorphValue,
    updateQuickModeMeasurements,
    resetAvatar,
    savePendingChanges,
    getMorphByName,
    getMorphById,
    getMorphsByCategory,
    getAvatarConfiguration,
  }), [
    currentAvatar,
    isLoading,
    error,
    isSavingPendingChanges,
    savePendingChangesError,
    loadAvatarFromBackend,
    updateMorphValue,
    updateQuickModeMeasurements,
    resetAvatar,
    savePendingChanges,
    getMorphByName,
    getMorphById,
    getMorphsByCategory,
    getAvatarConfiguration,
  ]);

  return (
    <AvatarConfigurationContext.Provider value={value}>
      {children}
    </AvatarConfigurationContext.Provider>
  );
}