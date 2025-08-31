import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';

// Pixel Streaming Configuration
export const pixelStreamingConfig: Partial<AllSettings> = {
  AutoPlayVideo: true,
  AutoConnect: true, 
  ss: import.meta.env.VITE_PIXEL_STREAMING_URL || 'ws://localhost:8888', 
  StartVideoMuted: true,
  HoveringMouse: true,
  SuppressBrowserKeys: false, 
  WaitForStreamer: true
};

// Debug-specific overrides (if needed)
export const debugPixelStreamingConfig: Partial<AllSettings> = {
  ...pixelStreamingConfig,
  // Add any debug-specific overrides here
  // For example: AutoConnect: false for manual testing
};

// Production-specific overrides (if needed)
export const productionPixelStreamingConfig: Partial<AllSettings> = {
  ...pixelStreamingConfig,
  // Add any production-specific overrides here
};
