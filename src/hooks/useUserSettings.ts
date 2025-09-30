import { useContext } from 'react'
import { UserSettingsContext } from '../context/UserSettingsContext'
import type { UserSettingsContextType, Resolution, Measurements } from '../types/userSettings'

/**
 * Hook to access global user settings from anywhere in the app
 * 
 * @returns UserSettingsContextType with settings and helper methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { screenWidth, screenHeight, isMobile, settings } = useUserSettings()
 *   
 *   return (
 *     <div>
 *       <p>Resolution: {screenWidth}x{screenHeight}</p>
 *       <p>Mobile: {isMobile ? 'Yes' : 'No'}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useUserSettings(): UserSettingsContextType {
  const context = useContext(UserSettingsContext)
  
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider')
  }
  
  return context
}

/**
 * Get just the screen resolution
 */
export function useScreenResolution(): Resolution {
  const { settings } = useUserSettings()
  return settings.resolution
}

/**
 * Get just the screen width
 */
export function useScreenWidth(): number {
  const { screenWidth } = useUserSettings()
  return screenWidth
}

/**
 * Get just the screen height
 */
export function useScreenHeight(): number {
  const { screenHeight } = useUserSettings()
  return screenHeight
}

/**
 * Get mobile device status
 */
export function useIsMobile(): boolean {
  const { isMobile } = useUserSettings()
  return isMobile
}

/**
 * Get user measurements (when available from backend)
 */
export function useMeasurements(): Measurements | null {
  const { settings } = useUserSettings()
  return settings.measurements
}

/**
 * Check if device is in portrait or landscape mode
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const { screenWidth, screenHeight } = useUserSettings()
  return screenHeight > screenWidth ? 'portrait' : 'landscape'
}

/**
 * Get device type based on screen size
 */
export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const { screenWidth, isMobile } = useUserSettings()
  
  if (isMobile) {
    return screenWidth <= 768 ? 'mobile' : 'tablet'
  }
  
  return 'desktop'
}