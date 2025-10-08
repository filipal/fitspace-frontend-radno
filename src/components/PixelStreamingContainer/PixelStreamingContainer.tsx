import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePixelStreaming } from '../../context/PixelStreamingContext';
import { PixelStreamingView } from '../PixelStreamingView/PixelStreamingView';

/**
 * Persistent PixelStreaming container that stays mounted across all pages.
 * Only visible on pages that need the stream (unreal-measurements, virtual-try-on).
 * This eliminates the need for reconnection when navigating between avatar pages.
 */
export const PixelStreamingContainer: React.FC = () => {
  const location = useLocation();
  const { sendCommand, connectionState, connect, devMode, setDebugMode, setDebugSettings } = usePixelStreaming();

  // Track the previous mode to detect transitions
  const prevModeRef = useRef<string | null>(null);

  // Pages that should display the PixelStreaming view
  const streamPages = ['/unreal-measurements', '/virtual-try-on'];
  const isStreamPage = streamPages.includes(location.pathname);

  // Determine which mode we're in based on the current page
  const currentMode = location.pathname === '/unreal-measurements' ? 'measurement' : 
                     location.pathname === '/virtual-try-on' ? 'fittingRoom' : 
                     null;

  // Configure localhost mode when on stream pages
  useEffect(() => {
    if (isStreamPage && devMode === 'localhost') {
      console.log('🏠 PersistentContainer: Localhost mode detected, configuring debug settings');
      setDebugMode(true);
      setDebugSettings({ ss: 'ws://localhost:80' });
    }
  }, [isStreamPage, devMode, setDebugMode, setDebugSettings]);

  // Auto-connect when becoming visible on a stream page
  useEffect(() => {
    if (isStreamPage && connectionState === 'disconnected') {
      console.log('🔌 PersistentContainer: Stream page detected, initiating connection...');
      connect();
    }
  }, [isStreamPage, connectionState, connect]);

  // Handle mode switching when navigating between pages
  // No reconnection needed - we're just moving the same DOM element!
  useEffect(() => {
    if (currentMode && connectionState === 'connected') {
      const prevMode = prevModeRef.current;

      // Send mode switch command to Unreal Engine
      if (prevMode && prevMode !== currentMode) {
        console.log(`🔄 Page transition: ${prevMode} → ${currentMode} (seamless, no reconnection)`);
        sendCommand('switchMode', { mode: currentMode });
      } else if (!prevMode) {
        // First load
        console.log(`🎮 Initial mode: ${currentMode}`);
        sendCommand('switchMode', { mode: currentMode });
      }

      // Update the previous mode
      prevModeRef.current = currentMode;
    }
  }, [currentMode, connectionState, sendCommand]);

  // Log visibility changes for debugging
  useEffect(() => {
    console.log(`📺 PixelStreaming container ${isStreamPage ? 'visible' : 'hidden'} on ${location.pathname}`);
  }, [isStreamPage, location.pathname]);

  // Render a single persistent PixelStreamingView that never unmounts or moves
  // The DOM element stays in exactly the same place, preventing video rendering issues
  // Pages have transparent areas where the stream shows through

  // Calculate stream area height based on mode
  // VirtualTryOn: 780px (at 430px width) - this scales proportionally
  // UnrealMeasurements: Fill remaining space after header
  const streamHeight = currentMode === 'fittingRoom' 
    ? '780px'  // VirtualTryOn fixed height
    : 'calc(100vh - 101px)'; // UnrealMeasurements fills remaining

  // z-index management:
  // VirtualTryOn needs -1 to appear behind UI overlays (buttons, accordions, etc.)
  // UnrealMeasurements needs higher z-index (1) to be visible above page background
  const zIndexValue = currentMode === 'fittingRoom' ? -1 : 1;

  return (
    <div
      style={{
        display: isStreamPage ? 'block' : 'none',
        position: 'fixed',
        top: '8%', // Start below header
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        height: streamHeight,
        zIndex: zIndexValue,
        pointerEvents: 'none', // Enable stream interaction
        overflow: 'hidden', // Prevent stream from extending beyond bounds
      }}
    >    
      <PixelStreamingView    
      />
    </div>
  );
};