import { useCallback, useState } from 'react';
import { usePixelStreaming } from '../context/PixelStreamingContext';
import { useAvatarConfiguration, type BackendAvatarData } from '../context/AvatarConfigurationContext';
import { transformBackendDataToMorphs, validateBackendMorphData } from '../services/avatarTransformationService';
import { generateUnrealAvatarCommand, validateAvatarConfiguration, getMorphStatistics } from '../services/avatarCommandService';

export interface AvatarLoaderState {
  isLoading: boolean;
  error: string | null;
  progress?: number;
  stage?: 'validation' | 'transformation' | 'command_generation' | 'unreal_communication' | 'complete';
}

/**
 * Custom hook that provides avatar loading functionality
 * Integrates with your existing PixelStreamingContext for Unreal Engine communication
 */
export function useAvatarLoader() {
  const pixelStreaming = usePixelStreaming();
  const avatarConfig = useAvatarConfiguration();
  const [loaderState, setLoaderState] = useState<AvatarLoaderState>({
    isLoading: false,
    error: null,
  });

  /**
   * Load avatar from backend JSON data
   * This is the main function to call when user presses "Load Avatar"
   */
  const loadAvatar = useCallback(async (backendData: BackendAvatarData) => {
    try {
      setLoaderState({ isLoading: true, error: null, stage: 'validation', progress: 10 });
      console.log('Starting avatar loading process...');

      // Step 1: Validate backend data
      console.log('Step 1: Validating backend morph data...');
      const validation = validateBackendMorphData(backendData.data.morphTargets);
      
      if (!validation.isValid) {
        throw new Error(`Invalid backend data: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        console.warn('Backend data warnings:', validation.warnings);
      }

      setLoaderState({ isLoading: true, error: null, stage: 'transformation', progress: 30 });

      // Step 2: Transform backend data to morph attributes
      console.log('Step 2: Transforming backend data to morphs...');
      
      // Get current morphs or initialize defaults if empty
      let currentMorphs = avatarConfig.currentAvatar?.morphValues || 
        avatarConfig.getAvatarConfiguration()?.morphValues;
      
      // If no current morphs exist, initialize with defaults
      if (!currentMorphs || currentMorphs.length === 0) {
        console.log('No current morphs found, initializing with defaults...');
        // Import the morphAttributes directly to get defaults
        const { morphAttributes } = await import('../data/morphAttributes');
        currentMorphs = morphAttributes.map(morph => ({
          ...morph,
          value: 50 // Default neutral position
        }));
      }
      
      console.log('Current morphs before transformation:', currentMorphs.length);
      const transformedMorphs = transformBackendDataToMorphs(backendData, currentMorphs);
      console.log('Transformed morphs result:', transformedMorphs.length, 'morphs');
      
      setLoaderState({ isLoading: true, error: null, stage: 'command_generation', progress: 50 });

      // Step 3: Load avatar in context and get the returned configuration
      console.log('Step 3: Loading avatar in configuration context...');
      const updatedAvatarConfig = await avatarConfig.loadAvatarFromBackend(
        backendData,
        transformedMorphs
      );

      console.log('Avatar configuration loaded successfully:', updatedAvatarConfig);
      console.log('Transformed morphValues length:', updatedAvatarConfig.morphValues.length);
      console.log('Sample transformed morphs:', transformedMorphs.slice(0, 5));

      setLoaderState({ isLoading: true, error: null, stage: 'unreal_communication', progress: 70 });

      // Step 4: Validate avatar configuration
      console.log('Step 4: Validating avatar configuration...');
      const configValidation = validateAvatarConfiguration(updatedAvatarConfig);
      
      if (!configValidation.isValid) {
        throw new Error(`Invalid avatar configuration: ${configValidation.errors.join(', ')}`);
      }

      if (configValidation.warnings.length > 0) {
        console.warn('Avatar configuration warnings:', configValidation.warnings);
      }

      // Step 5: Generate and send Unreal Engine command
      console.log('Step 5: Generating and sending Unreal Engine command...');
      const unrealCommand = generateUnrealAvatarCommand(updatedAvatarConfig);
      
      // Send command to Unreal Engine - will be queued if not connected
      console.log('Sending configureAvatar command to Unreal Engine...');
      pixelStreaming.sendFittingRoomCommand('configureAvatar', unrealCommand.data);
      
      if (pixelStreaming.connectionState === 'connected') {
        console.log('✅ Avatar command sent to Unreal Engine immediately (connected)');
      } else {
        console.log('📦 Avatar command queued for when WebRTC connection is established');
      }

      setLoaderState({ isLoading: true, error: null, stage: 'complete', progress: 90 });

      // Step 6: Log statistics for debugging
      const stats = getMorphStatistics(updatedAvatarConfig);
      console.log('Avatar loading complete! Statistics:', {
        avatarName: updatedAvatarConfig.avatarName,
        gender: updatedAvatarConfig.gender,
        ...stats,
      });

      setLoaderState({ isLoading: false, error: null, progress: 100 });
      
      return {
        success: true,
        avatarConfig: updatedAvatarConfig,
        command: unrealCommand,
        statistics: stats,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load avatar';
      console.error('Avatar loading failed:', errorMessage, error);
      setLoaderState({ isLoading: false, error: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [pixelStreaming, avatarConfig]);

  return {
    // Main loading function
    loadAvatar,
    
    // State
    loaderState,
  };
}