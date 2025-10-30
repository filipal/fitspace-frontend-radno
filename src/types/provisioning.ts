import type { AvatarClothingState, QuickModeSettings } from '../context/AvatarConfigurationContext';

export interface CreateAvatarData {
  avatarName: string;
  gender: 'male' | 'female';
  ageRange: string;
  basicMeasurements?: Record<string, number | string | null | undefined>;
  bodyMeasurements?: Record<string, number | string | null | undefined>;
  morphTargets?: Record<string, number>; // za Unreal je zgodan Record
  quickModeSettings?: QuickModeSettings | null;
  clothingSelections?: AvatarClothingState | null;
}

// minimalno što nam treba za boot:
export interface CreateAvatarCommand {
  type: 'createAvatar';
  data: {
    avatarName: string;
    gender: 'male' | 'female';
    ageRange: string;
    basicMeasurements?: Record<string, number | string | null>;
    bodyMeasurements?: Record<string, number | string | null>;
    morphTargets?: Record<string, number>;
    quickModeSettings?: {
      bodyShape?: string | null;
      athleticLevel?: string | null;
      measurements?: Record<string, number>;
      updatedAt?: string | null;
    } | null;
    clothingSelections?: AvatarClothingState | null;
  };
}
