import React, { createContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  persistAvatarDraftToStorage,
  clearAvatarDraftFromStorage,
  type PersistAvatarDraftParams,
  type AvatarApiMeasurements,
} from '../services/avatarApi';
import type { CreateAvatarCommand } from '../types/provisioning';
import { useAuthData } from '../hooks/useAuthData';
import type { ClothingCategory } from '../constants/clothing';

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

export interface AvatarClothingSelection {
  itemId: number;
  subCategory?: string | null;
}

export type AvatarClothingState = Partial<
  Record<ClothingCategory, AvatarClothingSelection | null>
>;

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
  clothingSelections?: AvatarClothingState | null;
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
  clothingSelections?: AvatarClothingState | null;
  morphValues: MorphAttribute[]; // Using your existing structure
  lastUpdated: Date;
}

export type AvatarConfigurationDirtySection =
  | 'morphs'
  | 'quickMode.measurements'
  | 'quickMode.skin'
  | 'quickMode.hair'
  | 'quickMode.extras'
  | 'clothing';

export interface QuickModeMeasurementUpdateOptions {
  section?: AvatarConfigurationDirtySection;
  markDirty?: boolean;
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
    options?: QuickModeMeasurementUpdateOptions,
  ) => void;
  updateQuickModeMeasurement: (
    key: string,
    value: number | null | undefined,
    options?: QuickModeMeasurementUpdateOptions,
  ) => void;
  updateClothingSelection: (
    category: ClothingCategory,
    selection: AvatarClothingSelection | null,
    options?: { markDirty?: boolean },
  ) => void;
  resetAvatar: () => void;

  savePendingChanges: (options?: SavePendingChangesOptions) => Promise<SavePendingChangesResult>;

  // Utility functions
  getMorphByName: (morphName: string) => MorphAttribute | undefined;
  getMorphById: (morphId: number) => MorphAttribute | undefined;
  getMorphsByCategory: (category: string) => MorphAttribute[];

  // Export current configuration
  getAvatarConfiguration: () => AvatarConfiguration | null;

  // Dirty state helpers
  dirtySections: ReadonlySet<AvatarConfigurationDirtySection>;
  isSectionDirty: (section: AvatarConfigurationDirtySection) => boolean;
  markSectionDirty: (
    section: AvatarConfigurationDirtySection,
    avatar?: AvatarConfiguration | null,
  ) => void;
  clearSectionDirty: (section: AvatarConfigurationDirtySection) => void;
  clearAllDirtySections: () => void;
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

const CLOTHING_CATEGORIES: ClothingCategory[] = ['top', 'bottom'];

const sanitizeClothingSelection = (
  value: AvatarClothingSelection | null | undefined,
): AvatarClothingSelection | null => {
  if (!value) {
    return null;
  }

  const numericId = Number((value as { itemId?: unknown }).itemId);
  if (!Number.isFinite(numericId)) {
    return null;
  }

  const rawSubCategory = (value as { subCategory?: unknown }).subCategory;
  const sanitizedSubCategory =
    typeof rawSubCategory === 'string' && rawSubCategory.trim().length
      ? rawSubCategory.trim()
      : null;

  return {
    itemId: numericId,
    ...(sanitizedSubCategory ? { subCategory: sanitizedSubCategory } : {}),
  };
};

const sanitizeClothingSelections = (
  source: AvatarClothingState | null | undefined,
): AvatarClothingState | null => {
  if (!source) {
    return null;
  }

  let hasSelection = false;
  const normalized: AvatarClothingState = {};

  for (const category of CLOTHING_CATEGORIES) {
    const selection = sanitizeClothingSelection(source[category] ?? null);
    if (selection) {
      normalized[category] = selection;
      hasSelection = true;
    }
  }

  return hasSelection ? normalized : null;
};

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
  const [dirtySections, setDirtySections] = useState<Set<AvatarConfigurationDirtySection>>(new Set());
  const saveInFlightRef = useRef(false);
  const latestAvatarRef = useRef<AvatarConfiguration | null>(null);

  const { isAuthenticated } = useAuthData();
  const { fetchAvatarById, updateAvatarMeasurements } = useAvatarApi();

  useEffect(() => {
    latestAvatarRef.current = currentAvatar;
  }, [currentAvatar]);

  const buildDraftPersistencePayload = useCallback(
    (avatar: AvatarConfiguration): PersistAvatarDraftParams | null => {
      if (!avatar) {
        return null;
      }

      const resolvedId = avatar.avatarId && avatar.avatarId.trim().length ? avatar.avatarId : 'guest';
      const normalizedId = String(resolvedId);
      const trimmedName = avatar.avatarName?.trim() || avatar.name?.trim();
      const resolvedName = trimmedName && trimmedName.length > 0 ? trimmedName : 'Avatar';
      const gender = avatar.gender;
      const ageRange = avatar.ageRange ?? '20-29';
      const resolvedCreationMode =
        avatar.creationMode ?? avatar.basicMeasurements?.creationMode ?? null;
      const resolvedQuickMode =
        typeof avatar.quickMode === 'boolean'
          ? avatar.quickMode
          : resolvedCreationMode === 'quickMode'
            ? true
            : null;
      const resolvedSource = avatar.source ?? (isAuthenticated ? 'web' : 'guest');

      const sanitizeDraftMeasurementRecord = (
        source?: Partial<Record<string, unknown>> | null,
      ): Record<string, number | string | null> | undefined => {
        if (!source) {
          return undefined;
        }

        const entries = Object.entries(source).reduce<
          Record<string, number | string | null>
        >((acc, [key, value]) => {
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

            const numericValue = Number(trimmed.replace(',', '.'));
            acc[key] = Number.isFinite(numericValue) ? numericValue : trimmed;
            return acc;
          }

          const numericValue = Number(value);
          if (Number.isFinite(numericValue)) {
            acc[key] = numericValue;
          }

          return acc;
        }, {});

        return Object.keys(entries).length ? entries : undefined;
      };

      const basicMeasurementsRecord = sanitizeDraftMeasurementRecord(
        avatar.basicMeasurements ?? null,
      );

      if (resolvedCreationMode && basicMeasurementsRecord && !('creationMode' in basicMeasurementsRecord)) {
        basicMeasurementsRecord.creationMode = resolvedCreationMode;
      }

      const basicMeasurementsMetadata = basicMeasurementsRecord
        ? (basicMeasurementsRecord as Partial<BasicMeasurements>)
        : null;

      const bodyMeasurementsRecord = sanitizeDraftMeasurementRecord(
        avatar.bodyMeasurements ?? null,
      );

      const bodyMeasurementsMetadata = bodyMeasurementsRecord
        ? (bodyMeasurementsRecord as AvatarApiMeasurements)
        : null;

      const quickModeSettings = avatar.quickModeSettings
        ? {
            ...avatar.quickModeSettings,
            ...(avatar.quickModeSettings.measurements
              ? { measurements: { ...avatar.quickModeSettings.measurements } }
              : {}),
          }
        : null;

      const clothingSelections = sanitizeClothingSelections(
        avatar.clothingSelections ?? null,
      );

      const morphTargetsRecord = avatar.morphValues.reduce<Record<string, number>>(
        (acc, morph) => {
          const backendKey = getBackendKeyForMorphId(morph.morphId);
          if (!backendKey) {
            return acc;
          }

          const backendValue = convertMorphValueToBackendValue(morph.value, morph);
          if (!Number.isFinite(backendValue)) {
            return acc;
          }

          acc[backendKey] = Number(backendValue);
          return acc;
        },
        {},
      );

      const morphTargets = Object.keys(morphTargetsRecord).length
        ? morphTargetsRecord
        : undefined;

      const command: CreateAvatarCommand = {
        type: 'createAvatar',
        data: {
          avatarName: resolvedName,
          gender,
          ageRange,
          ...(basicMeasurementsRecord ? { basicMeasurements: basicMeasurementsRecord } : {}),
          ...(bodyMeasurementsRecord ? { bodyMeasurements: bodyMeasurementsRecord } : {}),
          ...(morphTargets ? { morphTargets } : {}),
          quickModeSettings: quickModeSettings ?? null,
          ...(clothingSelections ? { clothingSelections } : {}),
        },
      };

      const storageMorphTargets = morphTargets
        ? Object.entries(morphTargets).reduce<BackendAvatarMorphTarget[]>(
            (acc, [key, value]) => {
              if (!key) {
                return acc;
              }

              const numericValue = Number(value);
              if (!Number.isFinite(numericValue)) {
                return acc;
              }

              acc.push({ name: key, value: numericValue });
              return acc;
            },
            [],
          )
        : null;

      return {
        resolvedId: normalizedId,
        command,
        metadata: {
          avatarId: normalizedId === 'guest' ? null : normalizedId,
          name: resolvedName,
          avatarName: resolvedName,
          gender,
          ageRange,
          basicMeasurements: basicMeasurementsMetadata,
          bodyMeasurements: bodyMeasurementsMetadata,
          morphTargets: storageMorphTargets ?? null,
          quickMode: resolvedQuickMode,
          creationMode: resolvedCreationMode ?? null,
          quickModeSettings: quickModeSettings ?? null,
          source: resolvedSource,
          clothingSelections: clothingSelections ?? null,
        },
      };
    },
    [isAuthenticated],
  );

  const markSectionDirty = useCallback(
    (section: AvatarConfigurationDirtySection, avatar?: AvatarConfiguration | null) => {
      setDirtySections(prev => {
        if (prev.has(section)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(section);
        return next;
      });

      const avatarForDraft =
        avatar === undefined ? latestAvatarRef.current : avatar;

      if (avatarForDraft) {
        const draftParams = buildDraftPersistencePayload(avatarForDraft);
        if (draftParams) {
          persistAvatarDraftToStorage(draftParams);
        }
      } else if (avatar === null) {
        clearAvatarDraftFromStorage();
      }
    },
    [buildDraftPersistencePayload],
  );

  const clearSectionDirty = useCallback((section: AvatarConfigurationDirtySection) => {
    setDirtySections(prev => {
      if (!prev.has(section)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
  }, []);

  const clearAllDirtySections = useCallback(() => {
    setDirtySections(new Set());
  }, []);

  const isSectionDirty = useCallback(
    (section: AvatarConfigurationDirtySection) => dirtySections.has(section),
    [dirtySections],
  );

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

      const clothingSelections = sanitizeClothingSelections(
        backendData.clothingSelections ?? null,
      );

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
        clothingSelections,
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
        clothingSelections: clothingSelections ? { ...clothingSelections } : null,
      };

        setCurrentAvatar(nextAvatarConfig);
        clearAvatarDraftFromStorage();
        clearAllDirtySections();
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
  }, [clearAllDirtySections, initializeDefaultMorphs]);

  // Update individual morph value
  const updateMorphValue = useCallback(
    (morphId: number, value: number) => {
      let didChange = false;
      let nextAvatar: AvatarConfiguration | null = null;
      setCurrentAvatar(prev => {
        if (!prev) return prev;

        const existing = prev.morphValues.find(m => m.morphId === morphId);
        if (!existing || existing.value === value) {
          return prev;
        }

        didChange = true;

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

        const updatedAvatar: AvatarConfiguration = {
          ...prev,
          morphValues: updatedMorphValues,
          bodyMeasurements: updatedBodyMeasurements,
          quickModeSettings: updatedQuickModeSettings,
          lastUpdated: new Date(),
        };

        nextAvatar = updatedAvatar;
        return updatedAvatar;
      });
      if (didChange && nextAvatar) {
        latestAvatarRef.current = nextAvatar;
        markSectionDirty('morphs', nextAvatar);
      }
    },
    [markSectionDirty],
  );

  const updateQuickModeMeasurements = useCallback(
    (
      patch: Record<string, number | null | undefined>,
      options?: QuickModeMeasurementUpdateOptions,
    ) => {
      let didChange = false;
      let nextAvatar: AvatarConfiguration | null = null;
      setCurrentAvatar(prev => {
        if (!prev) return prev;

        const previousSettings = prev.quickModeSettings ?? {};
        const previousMeasurements = previousSettings.measurements ?? {};
        const nextMeasurements = { ...previousMeasurements } as Record<string, number>;

        for (const [key, rawValue] of Object.entries(patch)) {
          if (rawValue == null) {
            if (key in nextMeasurements) {
              delete nextMeasurements[key];
              didChange = true;
            }
            continue;
          }

          if (nextMeasurements[key] !== rawValue) {
            nextMeasurements[key] = rawValue;
            didChange = true;
          }
        }

        if (!didChange) {
          return prev;
        }

        const updatedQuickModeSettings: QuickModeSettings = {
          ...previousSettings,
          measurements: nextMeasurements,
          updatedAt: new Date().toISOString(),
        };

        const updatedAvatar: AvatarConfiguration = {
          ...prev,
          quickModeSettings: updatedQuickModeSettings,
          lastUpdated: new Date(),
        };

        nextAvatar = updatedAvatar;
        return updatedAvatar;
      });

      if (didChange && nextAvatar && (options?.markDirty ?? true)) {
        const section = options?.section ?? 'quickMode.measurements';
        latestAvatarRef.current = nextAvatar;
        markSectionDirty(section, nextAvatar);
      }
    },
    [markSectionDirty],
  );

  const updateQuickModeMeasurement = useCallback((
    key: string,
    value: number | null | undefined,
    options?: QuickModeMeasurementUpdateOptions,
  ) => {
    updateQuickModeMeasurements({ [key]: value }, options);
  }, [updateQuickModeMeasurements]);

  const updateClothingSelection = useCallback(
    (
      category: ClothingCategory,
      selection: AvatarClothingSelection | null,
      options?: { markDirty?: boolean },
    ) => {
      let didChange = false;
      let nextAvatar: AvatarConfiguration | null = null;

      setCurrentAvatar(prev => {
        if (!prev) {
          return prev;
        }

        const normalizedSelection = sanitizeClothingSelection(selection);
        const previousSelections = prev.clothingSelections ?? null;
        const currentSelection = sanitizeClothingSelection(previousSelections?.[category] ?? null);

        const sameSelection =
          (!normalizedSelection && !currentSelection) ||
          (normalizedSelection &&
            currentSelection &&
            normalizedSelection.itemId === currentSelection.itemId &&
            (normalizedSelection.subCategory ?? null) === (currentSelection.subCategory ?? null));

        if (sameSelection) {
          return prev;
        }

        didChange = true;

        const nextSelections: AvatarClothingState = {
          ...(previousSelections ? { ...previousSelections } : {}),
        };

        if (normalizedSelection) {
          nextSelections[category] = normalizedSelection;
        } else {
          delete nextSelections[category];
        }

        const sanitizedNextSelections = sanitizeClothingSelections(nextSelections);

        const updatedAvatar: AvatarConfiguration = {
          ...prev,
          clothingSelections: sanitizedNextSelections,
          lastUpdated: new Date(),
        };

        nextAvatar = updatedAvatar;
        return updatedAvatar;
      });

      if (didChange && nextAvatar && (options?.markDirty ?? true)) {
        latestAvatarRef.current = nextAvatar;
        markSectionDirty('clothing', nextAvatar);
      }
    },
    [markSectionDirty],
  );

  // Reset avatar to defaults
  const resetAvatar = useCallback(() => {
    setCurrentAvatar(null);
    setError(null);
    clearAllDirtySections();
    console.log('Avatar reset to default state');
  }, [clearAllDirtySections]);

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

    if (dirtySections.size === 0) {
      setSavePendingChangesError(null);
      return { success: true, error: null, avatarId: currentAvatar.avatarId ?? null };
    }

    if (!isAuthenticated) {
      const draftParams = buildDraftPersistencePayload(currentAvatar);
      if (draftParams) {
        persistAvatarDraftToStorage(draftParams);
      }

      clearAllDirtySections();
      setSavePendingChangesError(null);

      return { success: true, error: null, avatarId: currentAvatar.avatarId ?? null };
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

      const clothingSelections = sanitizeClothingSelections(
        currentAvatar.clothingSelections ?? null,
      );

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
        ...(clothingSelections ? { clothingSelections } : {}),
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
            clothingSelections:
              result.backendAvatar?.clothingSelections ?? clothingSelections ?? null,
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

      clearAvatarDraftFromStorage();
      clearAllDirtySections();
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
    dirtySections,
    fetchAvatarById,
    isAuthenticated,
    loadAvatarFromBackend,
    clearAllDirtySections,
    updateAvatarMeasurements,
    buildDraftPersistencePayload,
  ]);

  // Context value
  const dirtySectionsSnapshot = useMemo(
    () => new Set(dirtySections) as ReadonlySet<AvatarConfigurationDirtySection>,
    [dirtySections],
  );

  const value = useMemo(() => ({
    currentAvatar,
    isLoading,
    error,
    isSavingPendingChanges,
    savePendingChangesError,
    loadAvatarFromBackend,
    updateMorphValue,
    updateQuickModeMeasurements,
    updateQuickModeMeasurement,
    updateClothingSelection,
    resetAvatar,
    savePendingChanges,
    getMorphByName,
    getMorphById,
    getMorphsByCategory,
    getAvatarConfiguration,
    dirtySections: dirtySectionsSnapshot,
    isSectionDirty,
    markSectionDirty,
    clearSectionDirty,
    clearAllDirtySections,
  }), [
    currentAvatar,
    isLoading,
    error,
    isSavingPendingChanges,
    savePendingChangesError,
    loadAvatarFromBackend,
    updateMorphValue,
    updateQuickModeMeasurements,
    updateQuickModeMeasurement,
    updateClothingSelection,
    resetAvatar,
    savePendingChanges,
    getMorphByName,
    getMorphById,
    getMorphsByCategory,
    getAvatarConfiguration,
    dirtySectionsSnapshot,
    isSectionDirty,
    markSectionDirty,
    clearSectionDirty,
    clearAllDirtySections,
  ]);

  return (
    <AvatarConfigurationContext.Provider value={value}>
      {children}
    </AvatarConfigurationContext.Provider>
  );
}