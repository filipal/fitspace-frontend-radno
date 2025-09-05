import { useContext } from 'react';
import { PixelStreamingContext } from '../context/PixelStreamingContext';

// Legacy hook for backward compatibility - only returns settings
export const usePixelStreamingSettings = () => {
  const context = useContext(PixelStreamingContext);
  if (context === undefined) {
    throw new Error('usePixelStreamingSettings must be used within a PixelStreamingProvider');
  }
  return {
    settings: context.settings,
    updateSettings: context.updateSettings,
    resetSettings: context.resetSettings
  };
};

// New comprehensive hook that returns everything
export const usePixelStreaming = () => {
  const context = useContext(PixelStreamingContext);
  if (context === undefined) {
    throw new Error('usePixelStreaming must be used within a PixelStreamingProvider');
  }
  return context;
};