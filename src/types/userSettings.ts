export interface Resolution {
  width: number
  height: number
}

export interface Measurements {
  // Placeholder for future backend data
  // Will be populated when backend is ready
  [key: string]: unknown
}

export interface UserSettings {
  // Device information
  resolution: Resolution
  isMobileDevice: boolean
  
  // User measurements (from backend)
  measurements: Measurements | null
  
  // Metadata
  lastUpdated: string
}

export interface UserSettingsContextType {
  // Current settings
  settings: UserSettings
  
  // Helper getters
  screenWidth: number
  screenHeight: number
  isMobile: boolean
  
  // Actions
  updateResolution: (resolution: Resolution) => void
  setMeasurements: (measurements: Measurements | null) => void
  refreshSettings: () => void
  resetSettings: () => void
}