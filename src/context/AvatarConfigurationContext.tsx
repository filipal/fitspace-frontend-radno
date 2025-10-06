import React, { createContext, useState, useCallback, useMemo } from 'react';
import { morphAttributes, type MorphAttribute } from '../data/morphAttributes';
import { mapBackendMorphTargetsToRecord, transformBackendDataToMorphs } from '../services/avatarTransformationService';

export type AvatarCreationMode = 'manual' | 'scan' | 'preset' | 'import';

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
  morphValues: MorphAttribute[]; // Using your existing structure
  lastUpdated: Date;
}

export interface AvatarConfigurationContextType {
  // Current avatar state
  currentAvatar: AvatarConfiguration | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Avatar management
  loadAvatarFromBackend: (
    backendData: BackendAvatarData,
    transformedMorphs?: MorphAttribute[],
    avatarId?: string
  ) => Promise<AvatarConfiguration>;
  updateMorphValue: (morphId: number, value: number) => void;
  resetAvatar: () => void;
  
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

// Provider component
export function AvatarConfigurationProvider({ children }: { children: React.ReactNode }) {
  const [currentAvatar, setCurrentAvatar] = useState<AvatarConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const morphValues = transformedMorphs ??
        transformBackendDataToMorphs(
          morphTargetMap,
          backendData.gender,
          initializeDefaultMorphs()
        );

      // Apply backend morph values (this will be handled by transformation service)
      // For now, we'll just store the data as-is
      const nextAvatarId = backendData.id ?? avatarId;
      const avatarConfig: AvatarConfiguration = {
        avatarId: nextAvatarId,
        avatarName: backendData.name,
        gender: backendData.gender,
        ageRange: backendData.ageRange,
        basicMeasurements: backendData.basicMeasurements,
        bodyMeasurements: backendData.bodyMeasurements,
        quickMode: backendData.quickMode,
        creationMode: backendData.creationMode ?? null,
        source: backendData.source ?? null,
        createdAt: backendData.createdAt ?? null,
        updatedAt: backendData.updatedAt ?? null,
        createdBySession: backendData.createdBySession ?? null,
        quickModeSettings: backendData.quickModeSettings ?? null,
        morphValues,
        lastUpdated: new Date()
      };
      
      const nextAvatarConfig: AvatarConfiguration = {
        ...avatarConfig,
        morphValues: morphValues.map(morph => ({ ...morph })),
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
    if (!currentAvatar) {
      console.warn('No current avatar to update');
      return;
    }

    setCurrentAvatar(prev => {
      if (!prev) return prev;
      
      const updatedMorphs = prev.morphValues.map(morph => 
        morph.morphId === morphId ? { ...morph, value } : morph
      );
      
      return {
        ...prev,
        morphValues: updatedMorphs,
        lastUpdated: new Date()
      };
    });
  }, [currentAvatar]);

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

  // Context value
  const value = useMemo(() => ({
    currentAvatar,
    isLoading,
    error,
    loadAvatarFromBackend,
    updateMorphValue,
    resetAvatar,
    getMorphByName,
    getMorphById,
    getMorphsByCategory,
    getAvatarConfiguration,
  }), [
    currentAvatar,
    isLoading,
    error,
    loadAvatarFromBackend,
    updateMorphValue,
    resetAvatar,
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