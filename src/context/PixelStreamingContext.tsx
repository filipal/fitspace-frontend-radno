import React, { createContext, useState, useCallback } from 'react';
import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';

// Default settings that will be used across the app
const defaultSettings: Partial<AllSettings> = {
  AutoPlayVideo: true,
  AutoConnect: true, 
  ss: import.meta.env.VITE_PIXEL_STREAMING_URL || 'ws://localhost:8888', 
  StartVideoMuted: true,
  HoveringMouse: true,
  SuppressBrowserKeys: false, 
  WaitForStreamer: true
};

interface PixelStreamingContextType {
  settings: Partial<AllSettings>;
  updateSettings: (newSettings: Partial<AllSettings>) => void;
  resetSettings: () => void;
}

const PixelStreamingContext = createContext<PixelStreamingContextType | undefined>(undefined);

export { PixelStreamingContext };

export const PixelStreamingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Partial<AllSettings>>(defaultSettings);

  const updateSettings = useCallback((newSettings: Partial<AllSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return (
    <PixelStreamingContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </PixelStreamingContext.Provider>
  );
};
