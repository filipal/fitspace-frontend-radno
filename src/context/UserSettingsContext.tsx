import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { UserSettings, UserSettingsContextType, Resolution, Measurements } from '../types/userSettings'

export const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined)

interface UserSettingsProviderProps {
  children: ReactNode
}

/**
 * Detect if the current device is mobile based on screen size and user agent
 */
function detectMobileDevice(): boolean {
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera // eslint-disable-line @typescript-eslint/no-explicit-any
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
  const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase())
  
  // Check screen size (tablets and phones typically have max width of 1024px)
  const isMobileScreen = window.innerWidth <= 1024
  
  // Check if device has touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  return isMobileUserAgent || (isMobileScreen && isTouchDevice)
}

/**
 * Get current device resolution
 */
function getDeviceResolution(): Resolution {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  }
}

/**
 * Create initial settings with device detection
 */
function createInitialSettings(): UserSettings {
  return {
    resolution: getDeviceResolution(),
    isMobileDevice: detectMobileDevice(),
    measurements: null,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * UserSettingsProvider - Provides global access to user settings
 * Automatically detects device resolution and mobile status
 */
export function UserSettingsProvider({ children }: UserSettingsProviderProps) {
  const [settings, setSettings] = useState<UserSettings>(createInitialSettings)

  // Update resolution when window is resized
  useEffect(() => {
    const handleResize = () => {
      const newResolution = getDeviceResolution()
      const newIsMobile = detectMobileDevice()
      
      setSettings(prevSettings => ({
        ...prevSettings,
        resolution: newResolution,
        isMobileDevice: newIsMobile,
        lastUpdated: new Date().toISOString()
      }))
    }

    // Add resize event listener
    window.addEventListener('resize', handleResize)
    
    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  // Log settings changes in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // console.log('🖥️ User settings updated:', settings)
    }
  }, [settings])

  // Action to manually update resolution
  const updateResolution = (resolution: Resolution) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      resolution,
      lastUpdated: new Date().toISOString()
    }))
  }

  // Action to set measurements from backend
  const setMeasurements = (measurements: Measurements | null) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      measurements,
      lastUpdated: new Date().toISOString()
    }))
  }

  // Action to refresh all settings
  const refreshSettings = () => {
    const newSettings = createInitialSettings()
    setSettings(newSettings)
  }

  // Action to reset settings to default
  const resetSettings = () => {
    setSettings(createInitialSettings())
  }

  // Helper getters
  const screenWidth = settings.resolution.width
  const screenHeight = settings.resolution.height
  const isMobile = settings.isMobileDevice

  const contextValue: UserSettingsContextType = {
    settings,
    screenWidth,
    screenHeight,
    isMobile,
    updateResolution,
    setMeasurements,
    refreshSettings,
    resetSettings
  }

  return (
    <UserSettingsContext.Provider value={contextValue}>
      {children}
    </UserSettingsContext.Provider>
  )
}