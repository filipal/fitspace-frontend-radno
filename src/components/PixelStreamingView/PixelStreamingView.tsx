import { useRef, useEffect } from 'react';
import { usePixelStreaming } from '../../hooks/usePixelStreamingSettings';

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
  autoConnect = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { application, connectionState, connect } = usePixelStreaming();

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect && connectionState === 'disconnected') {
      connect();
    }
  }, [autoConnect, connectionState, connect]);

  // Render the application when available
  useEffect(() => {
    if (application && containerRef.current) {
      const container = containerRef.current;
      
      // Clear any existing content
      container.innerHTML = '';
      
      // Append the pixel streaming application
      container.appendChild(application.rootElement);
      
      return () => {
        // Cleanup: remove from DOM but don't destroy the application
        // (it's managed by the context)
        if (container && application.rootElement.parentNode === container) {
          container.removeChild(application.rootElement);
        }
      };
    }
  }, [application]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        ...style
      }}
      className={className}
    />
  );
};
