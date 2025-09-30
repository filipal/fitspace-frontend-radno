import type { MorphAttribute } from '../data/morphAttributes';
import type { AvatarConfiguration } from '../context/AvatarConfigurationContext';

/**
 * Unreal Engine command structure for configuring avatar
 * Using morphID numbers instead of morph names for efficiency
 */
export interface UnrealAvatarCommand {
  type: 'configureAvatar';
  data: {
    avatarId: string;
    gender: 'male' | 'female';
    baseMorphs: Record<string, number>;
    morphValues: Record<string, number>;
  };
}

/**
 * Convert morph attribute value (0-100 slider value) to Unreal Engine value (min-max range)
 */
function convertSliderValueToUnrealValue(sliderValue: number, morphAttribute: MorphAttribute): number {
  // sliderValue is 0-100, we need to convert to morph's min-max range
  const { min, max } = morphAttribute;
  const range = max - min;
  const normalizedValue = sliderValue / 100; // Convert to 0-1
  
  return min + (normalizedValue * range);
}

/**
 * Generate Unreal Engine command from avatar configuration
 * Uses morphID numbers instead of morph names for cleaner format
 */
export function generateUnrealAvatarCommand(avatarConfig: AvatarConfiguration): UnrealAvatarCommand {
  const { avatarId, gender, morphValues } = avatarConfig;
  
  // Build base morphs for gender using morphID numbers
  const baseMorphs: Record<string, number> = {
    '176': gender === 'female' ? 1 : 0,  // Base Feminine Body
    '177': gender === 'female' ? 1 : 0,  // Base Feminine Head
    '178': gender === 'male' ? 1 : 0,    // Base Masculine Body
    '179': gender === 'male' ? 1 : 0,    // Base Masculine Head
  };
  
  // Build morph values object with morphID numbers as keys
  const unrealMorphValues: Record<string, number> = {};
  
  morphValues.forEach(morph => {
    const unrealValue = convertSliderValueToUnrealValue(morph.value, morph);
    unrealMorphValues[morph.morphId.toString()] = unrealValue;
  });
  
  const command: UnrealAvatarCommand = {
    type: 'configureAvatar',
    data: {
      avatarId: avatarId || `avatar_${Date.now()}`,
      gender,
      baseMorphs,
      morphValues: unrealMorphValues,
    },
  };
  
  console.log('Generated Unreal avatar command:', {
    type: command.type,
    avatarId: command.data.avatarId,
    gender: command.data.gender,
    baseMorphsCount: Object.keys(command.data.baseMorphs).length,
    morphValuesCount: Object.keys(command.data.morphValues).length,
    sampleMorphs: Object.keys(command.data.morphValues).slice(0, 5), // Show first 5 morph IDs
  });
  
  return command;
}

/**
 * Generate a simplified command with only changed morphs (for optimization)
 * Uses morphID numbers for cleaner format
 */
export function generateUnrealMorphUpdateCommand(
  avatarId: string,
  changedMorphs: MorphAttribute[]
): {
  type: 'updateMorphs';
  data: {
    avatarId: string;
    morphValues: Record<string, number>;
  };
} {
  const morphValues: Record<string, number> = {};
  
  changedMorphs.forEach(morph => {
    const unrealValue = convertSliderValueToUnrealValue(morph.value, morph);
    morphValues[morph.morphId.toString()] = unrealValue;
  });
  
  console.log('Generated morph update command:', {
    avatarId,
    morphCount: changedMorphs.length,
    morphIds: changedMorphs.map(m => m.morphId),
  });
  
  return {
    type: 'updateMorphs',
    data: {
      avatarId,
      morphValues,
    },
  };
}

/**
 * Validate avatar configuration before generating command
 */
export function validateAvatarConfiguration(avatarConfig: AvatarConfiguration): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required fields
  if (!avatarConfig.gender) {
    errors.push('Gender is required');
  }
  
  if (!avatarConfig.morphValues || avatarConfig.morphValues.length === 0) {
    errors.push('Morph values are required');
  }
  
  // Validate morph values
  avatarConfig.morphValues?.forEach(morph => {
    if (morph.value < 0 || morph.value > 100) {
      errors.push(`Invalid morph value for ${morph.labelName}: ${morph.value} (expected 0-100)`);
    }
    
    // Check if morphName is properly set
    if (!morph.morphName) {
      errors.push(`Missing morphName for ${morph.labelName}`);
    }
  });
  
  // Check for common issues
  if (avatarConfig.morphValues) {
    const baseMorphs = avatarConfig.morphValues.filter(m => 
      m.morphName.includes('BaseFeminine') || m.morphName.includes('BaseMasculine')
    );
    
    if (baseMorphs.length === 0) {
      warnings.push('No base morphs found - gender may not be applied correctly');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Helper function to get morph statistics for debugging
 */
export function getMorphStatistics(avatarConfig: AvatarConfiguration): {
  totalMorphs: number;
  nonNeutralMorphs: number;
  categoryCounts: Record<string, number>;
  valueDistribution: {
    min: number;
    max: number;
    average: number;
  };
} {
  const { morphValues } = avatarConfig;
  
  if (!morphValues || morphValues.length === 0) {
    return {
      totalMorphs: 0,
      nonNeutralMorphs: 0,
      categoryCounts: {},
      valueDistribution: { min: 0, max: 0, average: 0 },
    };
  }
  
  const categoryCounts: Record<string, number> = {};
  const values = morphValues.map(m => m.value);
  
  morphValues.forEach(morph => {
    categoryCounts[morph.category] = (categoryCounts[morph.category] || 0) + 1;
  });
  
  return {
    totalMorphs: morphValues.length,
    nonNeutralMorphs: morphValues.filter(m => m.value !== 50).length,
    categoryCounts,
    valueDistribution: {
      min: Math.min(...values),
      max: Math.max(...values),
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
    },
  };
}