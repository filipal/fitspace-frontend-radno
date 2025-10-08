import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';

// Detect mobile environment
const isMobile = () =>
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Po želji: različiti URL-ovi po modu (prod/dev/localhost)
const resolveSignallingUrl = (mode?: 'dev' | 'prod' | 'localhost'): string => {
  if (mode === 'localhost') return 'ws://127.0.0.1:80';
  // default: ENV ili fallback na localhost
  return import.meta.env.VITE_PIXEL_STREAMING_URL || 'ws://localhost:80';
};

// Get platform-specific pixel streaming configuration
export const getPixelStreamingConfig = (
  mode?: 'dev' | 'prod' | 'localhost'
): Partial<AllSettings> => {
  const mobile = isMobile();

  return {
    AutoPlayVideo: !mobile,             // Enable autoplay only on desktop, disable on mobile
    AutoConnect: false,                 // ručno spajanje (usklađeno s Providerom)
    ss: resolveSignallingUrl(mode),     // čita iz ENV-a, ima fallback
    StartVideoMuted: true,
    HoveringMouse: true,
    SuppressBrowserKeys: false,
    WaitForStreamer: true,
    MatchViewportRes: true, // Enable match viewport resolution by default
    WebRTCFPS: 30 // Set max FPS to 30
  };
};

// Legacy export for backward compatibility (uses desktop config)
export const pixelStreamingConfig: Partial<AllSettings> = getPixelStreamingConfig();

// Debug-specific overrides (if needed)
export const debugPixelStreamingConfig: Partial<AllSettings> = {
  ...getPixelStreamingConfig('dev'),
  // Add any debug-specific overrides here
  // For example: AutoConnect: false for manual testing
};

// Production-specific overrides (if needed)
export const productionPixelStreamingConfig: Partial<AllSettings> = {
  ...getPixelStreamingConfig('prod'),
  // Add any production-specific overrides here
};
