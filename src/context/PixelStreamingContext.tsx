import React, { createContext, useState, useCallback } from 'react';
import {
  Config,
  PixelStreaming
} from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6';
import { 
  Application, 
  PixelStreamingApplicationStyle 
} from '@epicgames-ps/lib-pixelstreamingfrontend-ui-ue5.6';
import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';

// Default settings that will be used across the app
const defaultSettings: Partial<AllSettings> = {
  AutoPlayVideo: true,
  AutoConnect: false, // Changed to false - we'll handle connection manually
  ss: import.meta.env.VITE_PIXEL_STREAMING_URL || 'ws://localhost:80', 
  StartVideoMuted: true,
  HoveringMouse: true,
  SuppressBrowserKeys: false, 
  WaitForStreamer: true
};

// Fitting room specific command types
export interface FittingRoomCommand {
  type: 'selectClothing' | 'rotateCamera' | 'zoomCamera' | 'resetAvatar' | 'saveLook' | 'morphAdjustment';
  data?: Record<string, unknown>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PixelStreamingContextType {
  // Settings management
  settings: Partial<AllSettings>;
  updateSettings: (newSettings: Partial<AllSettings>) => void;
  resetSettings: () => void;
  
  // Debug settings override
  debugMode: boolean;
  debugSettings: Partial<AllSettings> | null;
  setDebugMode: (enabled: boolean) => void;
  setDebugSettings: (settings: Partial<AllSettings> | null) => void;
  getEffectiveSettings: () => Partial<AllSettings>;
  
  // Connection management
  stream: PixelStreaming | null;
  application: Application | null;
  connectionState: ConnectionState;
  connectionError: string | null;
  
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  
  // Fitting room specific commands
  sendFittingRoomCommand: (type: FittingRoomCommand['type'], data?: Record<string, unknown>) => void;
  
  // Generic command sending (for advanced use)
  sendCommand: (command: string, data?: unknown) => void;
}

const PixelStreamingContext = createContext<PixelStreamingContextType | undefined>(undefined);

export { PixelStreamingContext };

// Custom hook to use the PixelStreaming context
export const usePixelStreaming = () => {
  const context = React.useContext(PixelStreamingContext);
  if (context === undefined) {
    throw new Error('usePixelStreaming must be used within a PixelStreamingProvider');
  }
  return context;
};

export const PixelStreamingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Partial<AllSettings>>(defaultSettings);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [stream, setStream] = useState<PixelStreaming | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  
  // Debug state
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [debugSettings, setDebugSettings] = useState<Partial<AllSettings> | null>(null);

  const updateSettings = useCallback((newSettings: Partial<AllSettings>) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...newSettings
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const getEffectiveSettings = useCallback((): Partial<AllSettings> => {
    if (debugMode && debugSettings) {
      return { ...settings, ...debugSettings };
    }
    return settings;
  }, [settings, debugMode, debugSettings]);

  const connect = useCallback(async () => {
    try {
      setConnectionState('connecting');
      setConnectionError(null);

      // Apply pixel streaming styles
      const pixelStreamingStyles = new PixelStreamingApplicationStyle();
      pixelStreamingStyles.applyStyleSheet();

      // Create config with effective settings (includes debug overrides)
      const effectiveSettings = getEffectiveSettings();
      const config = new Config({ 
        useUrlParams: false, // Don't use URL params for main app connection
        initialSettings: effectiveSettings 
      });

      // Create pixel streaming instance
      const newStream = new PixelStreaming(config);
      
      // Create application
      const newApplication = new Application({
        stream: newStream,
        onColorModeChanged: (isLightMode: boolean) => {
          pixelStreamingStyles.setColorMode(isLightMode);
        }
      });

      // Set up event listeners for connection state
      newStream.addEventListener('webRtcConnected', () => {
        setConnectionState('connected');
      });

      newStream.addEventListener('webRtcDisconnected', () => {
        setConnectionState('disconnected');
      });

      newStream.addEventListener('webRtcFailed', () => {
        setConnectionState('error');
        setConnectionError('WebRTC connection failed');
      });

      // Store instances
      setStream(newStream);
      setApplication(newApplication);
      
      // Actually connect to the signalling server
      console.log('Connecting to signalling server:', effectiveSettings.ss);
      newStream.connect();
      
    } catch (error) {
      console.error('Failed to connect to pixel streaming:', error);
      setConnectionState('error');
      setConnectionError(error instanceof Error ? error.message : 'Unknown connection error');
    }
  }, [getEffectiveSettings]);

  const disconnect = useCallback(() => {
    if (stream) {
      try {
        stream.disconnect();
      } catch (error) {
        console.warn('Error during disconnect:', error);
      }
    }
    
    setStream(null);
    setApplication(null);
    setConnectionState('disconnected');
    setConnectionError(null);
  }, [stream]);

  const reconnect = useCallback(async () => {
    disconnect();
    await connect();
  }, [disconnect, connect]);

  const sendFittingRoomCommand = useCallback((
    type: FittingRoomCommand['type'], 
    data?: Record<string, unknown>
  ) => {
    if (!stream || connectionState !== 'connected') {
      console.warn('Cannot send command: not connected to pixel streaming');
      return;
    }

    const command: FittingRoomCommand = { type, data };
    
    try {
      // Send as UI interaction to Unreal Engine
      stream.emitUIInteraction(JSON.stringify(command));
      console.log('Sent fitting room command:', command);
    } catch (error) {
      console.error('Failed to send fitting room command:', error);
    }
  }, [stream, connectionState]);

  const sendCommand = useCallback((command: string, data?: unknown) => {
    if (!stream || connectionState !== 'connected') {
      console.warn('Cannot send command: not connected to pixel streaming');
      return;
    }

    try {
      stream.emitUIInteraction(JSON.stringify({ command, data }));
      console.log('Sent command:', { command, data });
    } catch (error) {
      console.error('Failed to send command:', error);
    }
  }, [stream, connectionState]);

  return (
    <PixelStreamingContext.Provider value={{ 
      settings, 
      updateSettings, 
      resetSettings,
      debugMode,
      debugSettings,
      setDebugMode,
      setDebugSettings,
      getEffectiveSettings,
      stream,
      application,
      connectionState,
      connectionError,
      connect,
      disconnect,
      reconnect,
      sendFittingRoomCommand,
      sendCommand
    }}>
      {children}
    </PixelStreamingContext.Provider>
  );
};
