import type { MorphAttribute } from '../data/morphAttributes';
import type { BackendAvatarMorphTarget } from '../context/AvatarConfigurationContext';

/**
 * Maps backend friendly morph names to morphAttribute entries
 * This handles the conversion from JSON keys like "lowerBellyMoveUpDown" 
 * to your morphAttributes array entries
 */
const BACKEND_TO_MORPH_MAPPING: Record<string, number> = {
  // Belly & Waist morphs (morphId 0-23)
  'lowerBellyMoveUpDown': 0,        // -> SS_body_bs_2 Belly Lower UpDown
  'lowerBellyWidth': 1,             // -> SS_body_bs_2 Belly Lower Width
  'bellyMoveInOut': 2,              // -> SS_body_bs_4 Belly Move InOut
  'bellyMoveRotate': 3,             // -> SS_body_bs_4 Belly Move Rotate
  'bellyMoveUpDown': 4,             // -> SS_body_bs_4 Belly Move UpDown
  'upperBellyWidth': 5,             // -> SS_body_bs_1 Belly Upper Width
  'pelvicDepth': 6,                 // -> SS_body_bs_Pelvic Depth
  'waistDepth': 7,                  // -> SS_body_bs_Waist Depth
  'waistMoveFrontBack': 8,          // -> SS_body_bs_Waist FrontBack
  'abdomenMoveUpDown': 9,           // -> SS_body_bs_Abdomen UpDown
  'waistRotate': 10,                // -> SS_body_bs_Waist Rotate
  'waistWidth': 11,                 // -> TM_body_bs_ Waist Width
  'bellyHorizontalFold': 12,        // -> SS_body_bs_0 Belly Fold Horizontal
  'bellyMidLowSize': 13,            // -> SS_body_bs_0 Belly Size
  'upperBellyBulge': 14,            // -> SS_body_bs_1 Belly Upper Bulge
  'lowerBellyShape': 15,            // -> SFDBMK_body_bs_BellyLoFlat
  'bellyShapeFat1': 16,             // -> SS_body_bs_5 Belly Shape Fat 1
  'bellyShapeFat2': 17,             // -> SS_body_bs_5 Belly Shape Fat 2
  'abdomenShape': 18,               // -> SFDBMK_body_bs_AbdomenSmall
  'loveHandles': 19,                // -> body_bs_LoveHandles
  'stomachDepthLower': 20,          // -> body_bs_StomachDepthLower
  'bellyMidHighSize': 21,           // -> SFDBMK_body_bs_BellySize
  'bellyMidSize': 22,               // -> SFDBMK_body_bs_BellyLoSize
  'bellyPregnant': 23,              // -> SS_body_bs_5 Belly Shape Pregnant

  // Arms & Hands morphs (morphId 24-43)
  'upperArmsLength': 24,            // -> SFDBMK_body_bs_UpperArmsLength
  'lowerArmsLength': 25,            // -> SFDBMK_body_bs_ArmsLowerLength
  'lowerForearmSize': 26,           // -> body_bs_TaperForearmA
  'higherForearmSize': 27,          // -> body_bs_TaperForearmB
  'shoulderSize': 28,               // -> body_bs_MassShoulders
  'higherUpperArmSize': 29,         // -> body_bs_TaperUpperArmA
  'lowerUpperArmSize': 30,          // -> body_bs_TaperUpperArmB
  'fingersLength': 31,              // -> SFDBMK_body_bs_FingersLength
  'fingersWidth': 32,               // -> body_bs_FingersWidth
  'handSize': 33,                   // -> body_ctrl_ProportionHandSize
  'shoulderWidth1': 34,             // -> body_bs_ProportionShoulderWidth
  'shoulderWidth2': 35,             // -> TM_body_bs_ Shoulder Width
  'shoulderHeight1': 36,            // -> SFDBMK_body_bs_ShouldersHeight
  'wristThickness': 37,             // -> SS_body_bs_Wrist Thickness
  'shoulderHeight2': 38,            // -> TM_body_bs_ Shoulder Height
  'shoulderShape': 39,              // -> SFDBMK_body_bs_ShouldersWeak
  'armsMuscular': 40,               // -> P3DTL_body_bs_ArmsMuscular
  'armFlab': 41,                    // -> SS_body_bs_Arm Flab
  'armpitHeight': 42,               // -> TM_body_bs_ Armpit Height
  'elbowShape': 43,                 // -> SFDBMK_body_bs_ArmsElbowsShape

  // Add key torso morphs
  'bodyMuscular': 149,              // -> body_ctrl_BodyMuscular
  'bodyFitness': 150,               // -> body_ctrl_BodyFitness
  
  // Add some key leg morphs
  'shinLength': 116,                // -> SS_body_bs_Shin Length
  'thighLength': 117,               // -> SS_body_bs_Thigh Length
  
  // Add key chest morphs for both genders
  'chestSize': 53,                  // -> SFDBMK_body_bs_ChestMDeveloped
  'pectoralsDiameter': 48,          // -> body_bs_PectoralsDiameter
  
  // Add key hip/glute morphs
  'glutesSize': 93,                 // -> body_bs_GluteSize
  'hipsWidth1': 92,                 // -> SS_body_bs_Hip Width 1
  
  // Note: Add more mappings as you get more backend keys from your API
  // This is a foundation that can be extended as needed
};

const MORPH_ID_TO_BACKEND_MAPPING: Record<number, string> = Object.entries(
  BACKEND_TO_MORPH_MAPPING,
).reduce<Record<number, string>>((acc, [backendKey, morphId]) => {
  if (!(morphId in acc)) {
    acc[morphId] = backendKey;
  }
  return acc;
}, {});

/**
 * Converts a backend value (0-100 range) to the morph target's actual range
 */
export function convertBackendValueToMorphValue(
  backendValue: number,
  morphAttribute: MorphAttribute
): number {
  void morphAttribute;
  // Backend sends values in 0-100 range already. Store as percentage.
  return Math.max(0, Math.min(100, backendValue));
}

/**
 * Converts a morph value back to backend range (0-100)
 */
export function convertMorphValueToBackendValue(
  morphValue: number,
  morphAttribute: MorphAttribute
): number {
  void morphAttribute;
  // Morph values are stored as percentages, so just clamp to backend range
  return Math.round(Math.max(0, Math.min(100, morphValue)));
}

/**
 * Main transformation function that converts backend JSON to updated morphAttributes
 */
export function mapBackendMorphTargetsToRecord(
  morphTargets: BackendAvatarMorphTarget[],
): Record<string, number> {
  return morphTargets.reduce<Record<string, number>>((acc, target) => {
    if (!target || typeof target !== 'object') {
      return acc;
    }
    const { name, value } = target;
    if (!name) {
      return acc;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return acc;
    }
    acc[name] = numericValue;
    return acc;
  }, {});
}

export function buildBackendMorphPayload(
  morphs: MorphAttribute[],
): BackendAvatarMorphTarget[] {
  return morphs.reduce<BackendAvatarMorphTarget[]>((acc, morph) => {
    const backendKey = getBackendKeyForMorphId(morph.morphId);
    if (!backendKey) {
      return acc;
    }
    const backendValue = convertMorphValueToBackendValue(morph.value, morph);
    acc.push({ name: backendKey, value: backendValue });
    return acc;
  }, []);
}

export function transformBackendDataToMorphs(
  morphTargetMap: Record<string, number>,
  gender: 'male' | 'female',
  currentMorphs: MorphAttribute[]
): MorphAttribute[] {
  console.log('Transforming backend morph map to morphs:', morphTargetMap);
  
  // Start with current morph values
  const updatedMorphs = [...currentMorphs];

  // Apply backend morph values
  Object.entries(morphTargetMap).forEach(([backendKey, backendValue]) => {
    const morphId = BACKEND_TO_MORPH_MAPPING[backendKey];
    
    if (morphId !== undefined) {
      const morphIndex = updatedMorphs.findIndex(m => m.morphId === morphId);
      
      if (morphIndex !== -1) {
        const morphAttribute = updatedMorphs[morphIndex];
        const convertedValue = convertBackendValueToMorphValue(backendValue, morphAttribute);
        
        // Update the morph with the converted percentage value
        updatedMorphs[morphIndex] = {
          ...morphAttribute,
          value: Math.max(0, Math.min(100, convertedValue))
        };
        
        console.log(`Applied ${backendKey} (${backendValue}) -> ${morphAttribute.morphName} (${convertedValue})`);
      } else {
        console.warn(`Morph ID ${morphId} not found for backend key: ${backendKey}`);
      }
    } else {
      console.warn(`No mapping found for backend morph key: ${backendKey}`);
    }
  });
  
  // Apply gender-based base morphs
  const genderMorphs = applyGenderBaseMorphs(updatedMorphs, gender);
  
  return genderMorphs;
}

/**
 * Apply gender-specific base morphs
 */
function applyGenderBaseMorphs(
  morphs: MorphAttribute[],
  gender: 'male' | 'female'
): MorphAttribute[] {
  const updatedMorphs = [...morphs];
  
  // Find and update base morphs
  const baseFeminineBodyIndex = updatedMorphs.findIndex(m => m.morphId === 176);
  const baseFeminineHeadIndex = updatedMorphs.findIndex(m => m.morphId === 177);
  const baseMasculineBodyIndex = updatedMorphs.findIndex(m => m.morphId === 178);
  const baseMasculineHeadIndex = updatedMorphs.findIndex(m => m.morphId === 179);
  
  if (gender === 'male') {
    // Set masculine base morphs to 1 (100%), feminine to 0 (0%)
    if (baseMasculineBodyIndex !== -1) {
      updatedMorphs[baseMasculineBodyIndex] = { ...updatedMorphs[baseMasculineBodyIndex], value: 100 };
    }
    if (baseMasculineHeadIndex !== -1) {
      updatedMorphs[baseMasculineHeadIndex] = { ...updatedMorphs[baseMasculineHeadIndex], value: 100 };
    }
    if (baseFeminineBodyIndex !== -1) {
      updatedMorphs[baseFeminineBodyIndex] = { ...updatedMorphs[baseFeminineBodyIndex], value: 0 };
    }
    if (baseFeminineHeadIndex !== -1) {
      updatedMorphs[baseFeminineHeadIndex] = { ...updatedMorphs[baseFeminineHeadIndex], value: 0 };
    }
    console.log('Applied male base morphs');
  } else {
    // Set feminine base morphs to 1 (100%), masculine to 0 (0%)
    if (baseFeminineBodyIndex !== -1) {
      updatedMorphs[baseFeminineBodyIndex] = { ...updatedMorphs[baseFeminineBodyIndex], value: 100 };
    }
    if (baseFeminineHeadIndex !== -1) {
      updatedMorphs[baseFeminineHeadIndex] = { ...updatedMorphs[baseFeminineHeadIndex], value: 100 };
    }
    if (baseMasculineBodyIndex !== -1) {
      updatedMorphs[baseMasculineBodyIndex] = { ...updatedMorphs[baseMasculineBodyIndex], value: 0 };
    }
    if (baseMasculineHeadIndex !== -1) {
      updatedMorphs[baseMasculineHeadIndex] = { ...updatedMorphs[baseMasculineHeadIndex], value: 0 };
    }
    console.log('Applied female base morphs');
  }
  
  return updatedMorphs;
}

/**
 * Utility function to get all available backend morph keys
 */
export function getAvailableBackendMorphKeys(): string[] {
  return Object.keys(BACKEND_TO_MORPH_MAPPING);
}

export function getBackendKeyForMorphId(morphId: number): string | undefined {
  return MORPH_ID_TO_BACKEND_MAPPING[morphId];
}

/**
 * Validate backend morph data
 */
export function validateBackendMorphData(morphTargetMap: Record<string, number>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  Object.entries(morphTargetMap).forEach(([key, value]) => {
    // Check if key is mapped
    if (!(key in BACKEND_TO_MORPH_MAPPING)) {
      warnings.push(`Unknown morph key: ${key}`);
    }
    
    // Check if value is in valid range (0-100)
    if (typeof value !== 'number' || value < 0 || value > 100) {
      errors.push(`Invalid value for ${key}: ${value} (expected 0-100)`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}