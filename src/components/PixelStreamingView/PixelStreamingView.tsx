import { useRef, useEffect, useState, useMemo } from 'react';
import { usePixelStreaming } from '../../context/PixelStreamingContext';

interface PixelStreamingViewProps {
  style?: React.CSSProperties;
  className?: string;
  autoConnect?: boolean;
}

/**
 * Main app pixel streaming view that uses the centralized context.
 * This renders the pixel streaming application from the context and 
 * handles auto-connection.
 */
export const PixelStreamingView: React.FC<PixelStreamingViewProps> = ({
  style,
  className,
  autoConnect = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { application, connectionState, connect, settings } = usePixelStreaming();
  const [showMobileHint, setShowMobileHint] = useState(false);

  // SSR-safe dDetect mobile environment
  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect && connectionState === 'disconnected') {
      connect();
    }
  }, [autoConnect, connectionState, connect]);

  // Show mobile hint when connected on mobile devices (where AutoPlayVideo is disabled)
  useEffect(() => {
    if (isMobile && connectionState === 'connected' && !settings?.AutoPlayVideo) {
      setShowMobileHint(true);
      
      // Auto-hide hint after 10 seconds
      const timer = setTimeout(() => setShowMobileHint(false), 10000);
      return () => clearTimeout(timer);
    } else {
      setShowMobileHint(false);
    }
  }, [isMobile, connectionState, settings?.AutoPlayVideo]);

 // Render the application when available
  useEffect(() => {
    if (!application || !containerRef.current) return;
    const container = containerRef.current;

      // Check if the application element is already in this container
    if (application.rootElement.parentNode === container) return;

    // Odspoji iz starog parenta (bez .innerHTML) i spoji ovdje
    application.rootElement.parentNode?.removeChild(application.rootElement);
    container.appendChild(application.rootElement);
     // Already in the correct container, no need to move
    return () => {

      // Remove from previous container if it exists (but don't use innerHTML = '')
      if (application.rootElement.parentNode === container) {
        container.removeChild(application.rootElement);
      }
    };
  }, [application]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', ...style }}
      className={className}
    >
      {showMobileHint && (
        <div
          role="status"
          onClick={() => setShowMobileHint(false)}
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14,
            textAlign: 'center',
            zIndex: 1000,
            maxWidth: 320,
            border: '1px solid #4ade80',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}> Tap anywhere to start video</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Mobile browsers require user interaction to play video
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>Tap to dismiss</div>
        </div>
      )}
    </div>
  );
};
