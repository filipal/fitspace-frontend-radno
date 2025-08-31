import { useContext } from 'react';
import { PixelStreamingContext } from '../context/PixelStreamingContext';

export const usePixelStreamingSettings = () => {
  const context = useContext(PixelStreamingContext);
  if (context === undefined) {
    throw new Error('usePixelStreamingSettings must be used within a PixelStreamingProvider');
  }
  return context;
};
