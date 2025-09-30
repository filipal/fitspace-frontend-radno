import React, { createContext, useState, useCallback, useMemo } from 'react';
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
  ss: '', // Start with empty URL - will be set when instance is ready
  StartVideoMuted: true,
  HoveringMouse: true,
  SuppressBrowserKeys: false, 
  WaitForStreamer: true,
  MatchViewportRes: true, // Enable match viewport resolution by default
  WebRTCFPS: 30 // Set max FPS to 30
};

// Fitting room specific command types
export interface FittingRoomCommand {
  type:
    | 'selectClothing'
    | 'rotateCamera'
    | 'zoomCamera'
    | 'moveCamera'
    | 'resetAvatar'
    | 'saveLook'
    | 'morphAdjustment'
    | 'configureAvatar'
    | 'updateMorphs';
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
  
  // Dev mode for instance creation
  devMode: boolean;
  setDevMode: (enabled: boolean) => void;
  
  // Native overlay visibility control
  hideNativeOverlay: boolean;
  setHideNativeOverlay: (hidden: boolean) => void;
  
  // Connection management
  stream: PixelStreaming | null;
  application: Application | null;
  connectionState: ConnectionState;
  connectionError: string | null;
  
  // Connection methods
  connect: (overrideUrl?: string) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  
  // Fitting room specific commands
  sendFittingRoomCommand: (type: FittingRoomCommand['type'], data?: Record<string, unknown>) => void;
  
  // Generic command sending (for advanced use)
  sendCommand: (command: string, data?: unknown) => void;

  // Debug function to force resolution matching
  forceResolutionMatch: () => void;

  // Message handling
  onMessageReceived: (handler: (message: any) => void) => void;
  removeMessageHandler: (handler: (message: any) => void) => void;
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

  // Dev mode state
  const [devMode, setDevMode] = useState<boolean>(true);

  // Native overlay visibility state
  const [hideNativeOverlay, setHideNativeOverlay] = useState<boolean>(true);

  // Message handlers
  const [messageHandlers, setMessageHandlers] = useState<Set<(message: any) => void>>(new Set());

  const onMessageReceived = useCallback((handler: (message: any) => void) => {
    setMessageHandlers(prev => new Set([...prev, handler]));
  }, []);

  const removeMessageHandler = useCallback((handler: (message: any) => void) => {
    setMessageHandlers(prev => {
      const newSet = new Set(prev);
      newSet.delete(handler);
      return newSet;
    });
  }, []);

  const notifyMessageHandlers = useCallback((message: any) => {
    messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }, [messageHandlers]);

  // Function to apply overlay hiding styles  
  const applyOverlayHiding = useCallback((application: Application | null, shouldHide: boolean) => {
    if (!application || !application.rootElement) {
      return;
    }

    try {
      const rootElement = application.rootElement;
      
      if (shouldHide) {
        // Hide the uiFeatures div specifically
        const uiFeatures = rootElement.querySelector('#uiFeatures') || 
                          rootElement.querySelector('.uiFeatures') || 
                          rootElement.querySelector('div[id*="uiFeatures"]') ||
                          rootElement.querySelector('div[class*="uiFeatures"]');
        
        if (uiFeatures) {
          (uiFeatures as HTMLElement).style.display = 'none';
          console.log('🙈 Hidden uiFeatures div');
        } else {
          console.warn('uiFeatures div not found');
        }
      } else {
        // Show the uiFeatures div
        const uiFeatures = rootElement.querySelector('#uiFeatures') || 
                          rootElement.querySelector('.uiFeatures') || 
                          rootElement.querySelector('div[id*="uiFeatures"]') ||
                          rootElement.querySelector('div[class*="uiFeatures"]');
        
        if (uiFeatures) {
          (uiFeatures as HTMLElement).style.display = '';
          console.log('👁️ Shown uiFeatures div');
        }
      }
    } catch (error) {
      console.warn('Could not apply overlay hiding:', error);
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AllSettings>) => {
    // ALWAYS enforce MatchViewportRes to be true - never allow it to be set to false
    const enforcedSettings = { ...newSettings };
    if ('MatchViewportRes' in enforcedSettings) {
      console.log('🔧 Enforcing MatchViewportRes to always be true in updateSettings');
      enforcedSettings.MatchViewportRes = true;
    }
    
    setSettings(prevSettings => ({
      ...prevSettings,
      ...enforcedSettings,
      MatchViewportRes: true // Always ensure this is true regardless of input
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  const effectiveSettings = useMemo((): Partial<AllSettings> => {
    let result: Partial<AllSettings>;
    if (debugMode && debugSettings) {
      result = { ...settings, ...debugSettings };
    } else {
      result = settings;
    }
    
    // ALWAYS enforce MatchViewportRes to be true in effective settings
    result.MatchViewportRes = true;
    
    return result;
  }, [settings, debugMode, debugSettings]);

  const getEffectiveSettings = useCallback(() => effectiveSettings, [effectiveSettings]);

  // Stable callbacks for debug mode management
  const setDebugModeStable = useCallback((enabled: boolean) => {
    setDebugMode(enabled);
  }, []);

  const setDebugSettingsStable = useCallback((settings: Partial<AllSettings> | null) => {
    setDebugSettings(settings);
  }, []);

  // Apply overlay hiding when hideNativeOverlay state or application changes
  React.useEffect(() => {
    if (application) {
      console.log(`🎛️ Overlay hiding ${hideNativeOverlay ? 'enabled' : 'disabled'} for Pixel Streaming UI`);
    }
    applyOverlayHiding(application, hideNativeOverlay);
  }, [application, hideNativeOverlay, applyOverlayHiding]);

  const connect = useCallback(async (overrideUrl?: string) => {
    try {
      setConnectionState('connecting');
      setConnectionError(null);

      // Apply pixel streaming styles
      const pixelStreamingStyles = new PixelStreamingApplicationStyle();
      pixelStreamingStyles.applyStyleSheet();

      // Use override URL if provided, otherwise use effective settings
      const connectionSettings = overrideUrl ? 
        { ...effectiveSettings, ss: overrideUrl } : 
        effectiveSettings;

      console.log('🔍 Connection settings being used:', connectionSettings);
      console.log('🔍 Override URL provided:', overrideUrl);
      console.log('🔍 Default settings applied:', defaultSettings);

      // Use the connection settings for config
      const config = new Config({ 
        useUrlParams: false, // Don't use URL params for main app connection
        initialSettings: connectionSettings 
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

      // Listen for settings changes from the Epic Games UI to keep our context in sync
      // This ensures that when users toggle settings in the debug overlay, they persist across reconnections
      const syncSettingsFromLibrary = () => {
        try {
          // Access the config from the stream instance to get current settings
          const currentConfig = (newStream as any).config;
          if (currentConfig && currentConfig._settingsObj) {
            const librarySettings = currentConfig._settingsObj;
            
            // ALWAYS ENFORCE MatchViewportRes to be true - never allow it to be false
            if (librarySettings.MatchViewportRes !== true) {
              console.log('🔧 Enforcing MatchViewportRes to always be true');
              librarySettings.MatchViewportRes = true;
              
              // Also update UI if possible
              if (currentConfig.setStreamingSettings) {
                currentConfig.setStreamingSettings({ MatchViewportRes: true });
              }
            }
            
            // Extract the settings we care about and update our context
            const updatedSettings: Partial<AllSettings> = {};
            
            // Force MatchViewportRes to always be true in our context
            updatedSettings.MatchViewportRes = true;
            
            if ('WebRTCFPS' in librarySettings) {
              updatedSettings.WebRTCFPS = librarySettings.WebRTCFPS;
            }
            if ('AutoPlayVideo' in librarySettings) {
              updatedSettings.AutoPlayVideo = librarySettings.AutoPlayVideo;
            }
            if ('StartVideoMuted' in librarySettings) {
              updatedSettings.StartVideoMuted = librarySettings.StartVideoMuted;
            }
            
            // Always update to ensure MatchViewportRes is enforced
            console.log('🔄 Syncing settings from Epic Games UI (with enforced MatchViewportRes):', updatedSettings);
            setSettings(prevSettings => ({ ...prevSettings, ...updatedSettings }));
          }
        } catch (error) {
          console.warn('Could not sync settings from Epic Games library:', error);
        }
      };

      // Set up a periodic sync to catch UI changes and enforce MatchViewportRes
      // More frequent sync to immediately catch and override any attempts to disable MatchViewportRes
      const settingsSyncInterval = setInterval(syncSettingsFromLibrary, 500);
      
      // Clean up interval when disconnecting
      const originalDisconnect = newStream.disconnect;
      newStream.disconnect = () => {
        clearInterval(settingsSyncInterval);
        originalDisconnect.call(newStream);
      };

      // Set up event listeners for connection state
      newStream.addEventListener('webRtcConnected', () => {
        setConnectionState('connected');
        console.log('🎥 WebRTC Connected - checking resolution...');
        
        // Force resolution check after connection
        setTimeout(() => {
          try {
            const currentConfig = (newStream as any).config;
            if (currentConfig?._settingsObj) {
              console.log('🔧 Post-connection MatchViewportRes check:', currentConfig._settingsObj.MatchViewportRes);
              
              // Force it again if needed
              if (!currentConfig._settingsObj.MatchViewportRes) {
                console.log('⚠️ MatchViewportRes was false after connection, forcing to true');
                currentConfig._settingsObj.MatchViewportRes = true;
                if (currentConfig.setStreamingSettings) {
                  currentConfig.setStreamingSettings({ MatchViewportRes: true });
                }
              }
              
              // Try the toggle simulation regardless of current state
              console.log('🎯 Attempting to simulate manual toggle after connection...');
              
              // Inline version of forceResolutionMatch for post-connection
              const simulateToggle = () => {
                try {
                  // Try to find and simulate the UI toggle
                  const settingsPanel = (currentConfig as any).settingsPanel;
                  if (settingsPanel && settingsPanel._rootElement) {
                    const matchViewportControl = settingsPanel._rootElement.querySelector('input[data-setting="MatchViewportRes"]') ||
                                               settingsPanel._rootElement.querySelector('input[id*="MatchViewportRes"]') ||
                                               settingsPanel._rootElement.querySelector('input[name*="MatchViewportRes"]');
                    
                    if (matchViewportControl) {
                      console.log('🎯 Found MatchViewportRes control post-connection, simulating toggle...');
                      
                      // Simulate the exact sequence: off -> on
                      matchViewportControl.checked = false;
                      matchViewportControl.dispatchEvent(new Event('change', { bubbles: true }));
                      
                      setTimeout(() => {
                        matchViewportControl.checked = true;
                        matchViewportControl.dispatchEvent(new Event('change', { bubbles: true }));
                        matchViewportControl.dispatchEvent(new Event('input', { bubbles: true }));
                        matchViewportControl.click();
                        
                        console.log('✅ Post-connection MatchViewportRes toggle completed');
                        
                        // Dispatch resize after toggle
                        setTimeout(() => {
                          window.dispatchEvent(new Event('resize'));
                        }, 100);
                      }, 100);
                    }
                  }
                } catch (error) {
                  console.warn('Could not simulate toggle post-connection:', error);
                }
              };
              
              simulateToggle();
            }
          } catch (error) {
            console.warn('Could not check post-connection settings:', error);
          }
        }, 1000);
        
        // Additional attempt after a longer delay
        setTimeout(() => {
          console.log('🔄 Second attempt at resolution matching...');
          // We'll call forceResolutionMatch() from the global scope later
          setTimeout(() => {
            if ((window as any).forceResolutionMatch) {
              (window as any).forceResolutionMatch();
            }
          }, 100);
        }, 3000);
      });

      newStream.addEventListener('webRtcDisconnected', () => {
        setConnectionState('disconnected');
      });

      newStream.addEventListener('webRtcFailed', () => {
        setConnectionState('error');
        setConnectionError('WebRTC connection failed');
      });

      // Data channel events
      newStream.addEventListener('dataChannelOpen', () => {
        console.log('Data channel opened - ready to receive custom events');
        
        // Set up data channel message reception
        setTimeout(() => {
          try {
            const webRtcController = (newStream as any)._webRtcController;
            const sendrecvController = webRtcController?.sendrecvDataChannelController;
            
            if (sendrecvController?.dataChannel) {
              const dataChannel = sendrecvController.dataChannel;
              
              dataChannel.onmessage = (event: MessageEvent) => {
                let messageText = '';
                
                if (event.data instanceof ArrayBuffer) {
                  const decoder = new TextDecoder('utf-8');
                  messageText = decoder.decode(event.data);
                } else if (typeof event.data === 'string') {
                  messageText = event.data;
                } else {
                  messageText = String(event.data);
                }
                
                try {
                  const message = JSON.parse(messageText);
                  console.log('Received message from Unreal Engine:', message);
                  notifyMessageHandlers(message);
                } catch (parseError) {
                  notifyMessageHandlers({ raw: messageText });
                }
              };
            }
          } catch (error) {
            console.warn('Could not set up data channel listener:', error);
          }
        }, 1000);
      });



      // Store instances
      setStream(newStream);
      setApplication(newApplication);
      
      // Force our default settings after Epic Games library initializes
      // This ensures our defaults (like MatchViewportRes: true) are applied even if the library overrides them
      // Multiple attempts to ensure MatchViewportRes is always enforced
      const forceDefaultSettings = () => {
        try {
          const currentConfig = (newStream as any).config;
          if (currentConfig && currentConfig._settingsObj) {
            console.log('🔧 Applying enforced default settings to Epic Games config...');
            
            // Force our important defaults with MatchViewportRes ALWAYS true
            const forceDefaults = {
              MatchViewportRes: true, // ALWAYS TRUE - never allow false
              WebRTCFPS: 30,
              ...connectionSettings // Include any debug overrides but still enforce MatchViewportRes
            };
            
            // Always override MatchViewportRes to be true regardless of connectionSettings
            forceDefaults.MatchViewportRes = true;
            
            // Update the library's internal settings
            Object.assign(currentConfig._settingsObj, forceDefaults);
            
            // Try to find and call the exact same methods that the UI toggle calls
            // Look for the settings UI methods
            console.log('🔍 Searching for Epic Games UI methods...');
            
            // Method 1: Try setEncoderSettings and setStreamingSettings
            if (currentConfig.setEncoderSettings) {
              currentConfig.setEncoderSettings({ 
                WebRTCFPS: forceDefaults.WebRTCFPS 
              });
              console.log('✅ Called setEncoderSettings');
            }
            
            if (currentConfig.setStreamingSettings) {
              currentConfig.setStreamingSettings({ 
                MatchViewportRes: true // Always force true
              });
              console.log('✅ Called setStreamingSettings');
            }
            
            // Method 2: Try to find the settings object and trigger change events
            const settingsPanel = (currentConfig as any).settingsPanel;
            if (settingsPanel) {
              console.log('📱 Found settings panel, looking for MatchViewportRes control...');
              
              // Try to find the checkbox/toggle for MatchViewportRes
              const matchViewportControl = settingsPanel._rootElement?.querySelector('input[data-setting="MatchViewportRes"]') ||
                                         settingsPanel._rootElement?.querySelector('input[id*="MatchViewportRes"]') ||
                                         settingsPanel._rootElement?.querySelector('input[name*="MatchViewportRes"]');
              
              if (matchViewportControl) {
                console.log('🎯 Found MatchViewportRes control, simulating toggle...');
                
                // Set the value
                matchViewportControl.checked = true;
                
                // Dispatch change events to mimic user interaction
                matchViewportControl.dispatchEvent(new Event('change', { bubbles: true }));
                matchViewportControl.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log('✅ Simulated MatchViewportRes toggle to true');
              } else {
                console.log('❌ Could not find MatchViewportRes control');
              }
            }
            
            // Method 3: Look for any update/apply methods on the config
            if (typeof (currentConfig as any).updateAllSettings === 'function') {
              (currentConfig as any).updateAllSettings();
              console.log('✅ Called updateAllSettings');
            }
            
            if (typeof (currentConfig as any).applySettings === 'function') {
              (currentConfig as any).applySettings();
              console.log('✅ Called applySettings');
            }
            
            // Method 4: Try triggering a settings change event
            if (currentConfig.dispatchEvent && typeof currentConfig.dispatchEvent === 'function') {
              const settingsEvent = new CustomEvent('settingsChanged', {
                detail: { MatchViewportRes: true }
              });
              currentConfig.dispatchEvent(settingsEvent);
              console.log('✅ Dispatched settingsChanged event');
            }
            
            console.log('✅ Enforced default settings applied to Epic Games config (MatchViewportRes: true)');
          }
        } catch (error) {
          console.warn('Could not force default settings:', error);
        }
      };
      
      // Apply immediately and then again after delays to ensure it sticks
      forceDefaultSettings(); // Apply immediately
      setTimeout(forceDefaultSettings, 100);
      setTimeout(forceDefaultSettings, 500);
      setTimeout(forceDefaultSettings, 1000);
      setTimeout(forceDefaultSettings, 2000);
      
      // Add debugging for viewport resolution
      const debugViewportResolution = () => {
        console.log('🔍 Viewport Resolution Debug:');
        console.log('  - Window inner size:', window.innerWidth, 'x', window.innerHeight);
        console.log('  - Device pixel ratio:', window.devicePixelRatio);
        console.log('  - Screen resolution:', screen.width, 'x', screen.height);
        
        if (application?.rootElement) {
          const videoElement = application.rootElement.querySelector('video');
          if (videoElement) {
            console.log('  - Video element size:', videoElement.videoWidth, 'x', videoElement.videoHeight);
            console.log('  - Video element display size:', videoElement.clientWidth, 'x', videoElement.clientHeight);
            console.log('  - Video element computed style:', {
              width: getComputedStyle(videoElement).width,
              height: getComputedStyle(videoElement).height,
              objectFit: getComputedStyle(videoElement).objectFit
            });
          } else {
            console.log('  - No video element found');
          }
          
          const canvas = application.rootElement.querySelector('canvas');
          if (canvas) {
            console.log('  - Canvas size:', canvas.width, 'x', canvas.height);
            console.log('  - Canvas display size:', canvas.clientWidth, 'x', canvas.clientHeight);
            console.log('  - Canvas computed style:', {
              width: getComputedStyle(canvas).width,
              height: getComputedStyle(canvas).height
            });
          } else {
            console.log('  - No canvas element found');
          }
          
          // Check the container dimensions
          const container = application.rootElement.parentElement;
          if (container) {
            console.log('  - Container size:', container.clientWidth, 'x', container.clientHeight);
            console.log('  - Container computed style:', {
              width: getComputedStyle(container).width,
              height: getComputedStyle(container).height
            });
          }
        } else {
          console.log('  - No application root element');
        }
        
        try {
          const currentConfig = (newStream as any).config;
          if (currentConfig?._settingsObj) {
            console.log('  - MatchViewportRes setting:', currentConfig._settingsObj.MatchViewportRes);
            console.log('  - All streaming settings:', {
              MatchViewportRes: currentConfig._settingsObj.MatchViewportRes,
              WebRTCFPS: currentConfig._settingsObj.WebRTCFPS,
              AutoPlayVideo: currentConfig._settingsObj.AutoPlayVideo,
              StartVideoMuted: currentConfig._settingsObj.StartVideoMuted
            });
          }
        } catch (error) {
          console.warn('Could not read config settings:', error);
        }
      };
      
      // Debug viewport resolution periodically
      setTimeout(debugViewportResolution, 2000);
      setTimeout(debugViewportResolution, 5000);
      
      // Debug log the connection settings before connection attempt
      console.log('🔍 About to attempt connection with connectionSettings:', connectionSettings);
      console.log('🔍 connectionSettings.ss:', connectionSettings.ss);
      
      // Connection validation logic
      const hasValidUrl = connectionSettings.ss && connectionSettings.ss !== '';
      const isLocalhostUrl = connectionSettings.ss && (
        connectionSettings.ss.includes('localhost') || 
        connectionSettings.ss.includes('127.0.0.1')
      );
      
      // Allow connection if:
      // 1. Valid non-localhost URL (production instance)
      // 2. Localhost URL and we have debug settings (debug mode)
      const shouldConnect = hasValidUrl && (
        !isLocalhostUrl || // Non-localhost URL (production)
        (isLocalhostUrl && debugSettings) // Localhost URL but in debug mode
      );
      
      if (shouldConnect) {
        console.log('✅ Valid URL found, connecting to signalling server:', connectionSettings.ss);
        newStream.connect();
      } else {
        console.log('❌ Skipping connection - invalid URL or localhost without debug mode. Current ss:', connectionSettings.ss);
        console.log('❌ Debug - ss value:', JSON.stringify(connectionSettings.ss));
        console.log('❌ Debug - isLocalhost:', isLocalhostUrl);
        console.log('❌ Debug - hasDebugSettings:', !!debugSettings);
        console.log('❌ Debug - overrideUrl:', overrideUrl);
        setConnectionState('disconnected');
      }
      
    } catch (error) {
      console.error('Failed to connect to pixel streaming:', error);
      setConnectionState('error');
      setConnectionError(error instanceof Error ? error.message : 'Unknown connection error');
    }
  }, [debugSettings]); // Added debugSettings dependency

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
      // Send as UI interaction to Unreal Engine - send object directly
      stream.emitUIInteraction(command);
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
      // Send as UI interaction to Unreal Engine - send object directly
      stream.emitUIInteraction({ command, data });
      console.log('Sent command:', { command, data });
    } catch (error) {
      console.error('Failed to send command:', error);
    }
  }, [stream, connectionState]);

  // Debug function to force resolution adjustment
  const forceResolutionMatch = useCallback(() => {
    if (!stream) {
      console.warn('Cannot force resolution match: no stream available');
      return;
    }

    try {
      console.log('🔧 Forcing resolution match (mimicking manual double-toggle)...');
      const currentConfig = (stream as any).config;
      
      if (currentConfig) {
        // First, let's inspect the entire Epic Games UI structure
        console.log('🔍 Inspecting Epic Games UI structure...');
        
        const application = (stream as any)._application;
        if (application && application.rootElement) {
          console.log('📱 Application root element found');
          
          // Look for all possible UI elements
          const allInputs = application.rootElement.querySelectorAll('input');
          const allButtons = application.rootElement.querySelectorAll('button');
          const allLabels = application.rootElement.querySelectorAll('label');
          
          console.log(`� Found ${allInputs.length} inputs, ${allButtons.length} buttons, ${allLabels.length} labels`);
          
          // Log all inputs to help us identify the right one
          allInputs.forEach((input: HTMLInputElement, index: number) => {
            const type = input.type;
            const id = input.id;
            const name = input.name;
            const className = input.className;
            const dataset = Object.keys(input.dataset).map(key => `${key}:${input.dataset[key]}`).join(', ');
            const checked = input.type === 'checkbox' ? input.checked : 'N/A';
            
            console.log(`📋 Input ${index}: type=${type}, id=${id}, name=${name}, class=${className}, data=${dataset}, checked=${checked}`);
          });
          
          // Look for text content that might indicate MatchViewportRes
          const allElements = application.rootElement.querySelectorAll('*');
          const matchViewportElements = Array.from(allElements).filter((el) => {
            const element = el as Element;
            const text = element.textContent?.toLowerCase() || '';
            return text.includes('match') && (text.includes('viewport') || text.includes('resolution'));
          });
          
          console.log(`🎯 Found ${matchViewportElements.length} elements with 'match viewport' text`);
          matchViewportElements.forEach((el, index) => {
            const element = el as Element;
            console.log(`📍 Match element ${index}:`, element.tagName, element.textContent, element);
          });
          
          // Try different strategies to find the MatchViewportRes control
          const strategies = [
            // Strategy 1: Look for inputs with specific attributes
            () => application.rootElement.querySelector('input[data-setting="MatchViewportRes"]'),
            () => application.rootElement.querySelector('input[id*="MatchViewportRes"]'),
            () => application.rootElement.querySelector('input[name*="MatchViewportRes"]'),
            () => application.rootElement.querySelector('input[id*="matchviewport"]'),
            () => application.rootElement.querySelector('input[name*="matchviewport"]'),
            
            // Strategy 2: Look for checkboxes near "match viewport" text
            () => {
              const textElements = Array.from(application.rootElement.querySelectorAll('*')).filter((el) => {
                const element = el as Element;
                const text = element.textContent?.toLowerCase() || '';
                return text.includes('match') && (text.includes('viewport') || text.includes('resolution'));
              });
              
              for (const textEl of textElements) {
                const element = textEl as Element;
                // Look for checkbox in the same parent or nearby
                const parent = element.parentElement;
                if (parent) {
                  const checkbox = parent.querySelector('input[type="checkbox"]') as HTMLInputElement;
                  if (checkbox) return checkbox;
                }
                
                // Look for checkbox as next/previous sibling
                const nextSibling = element.nextElementSibling;
                if (nextSibling?.tagName === 'INPUT' && (nextSibling as HTMLInputElement).type === 'checkbox') {
                  return nextSibling as HTMLInputElement;
                }
                
                const prevSibling = element.previousElementSibling;
                if (prevSibling?.tagName === 'INPUT' && (prevSibling as HTMLInputElement).type === 'checkbox') {
                  return prevSibling as HTMLInputElement;
                }
              }
              return null;
            },
            
            // Strategy 3: Look for any checkbox and try them all
            () => {
              const checkboxes = application.rootElement.querySelectorAll('input[type="checkbox"]');
              console.log(`🔍 Found ${checkboxes.length} checkboxes, will try each one`);
              return checkboxes.length > 0 ? checkboxes : null;
            }
          ];
          
          let matchViewportControl = null;
          
          for (let i = 0; i < strategies.length; i++) {
            console.log(`🎯 Trying strategy ${i + 1}...`);
            const result = strategies[i]();
            
            if (result) {
              if (result instanceof NodeList || Array.isArray(result)) {
                console.log(`✅ Strategy ${i + 1} found ${result.length} potential controls`);
                matchViewportControl = result;
              } else {
                console.log(`✅ Strategy ${i + 1} found a control:`, result);
                matchViewportControl = [result];
              }
              break;
            }
          }
          
          if (matchViewportControl) {
            console.log('🎯 Found potential MatchViewportRes control(s), attempting double-toggle...');
            
            const controls = Array.isArray(matchViewportControl) ? matchViewportControl : [matchViewportControl];
            
            controls.forEach((control, index) => {
              console.log(`🔄 Attempting double-toggle on control ${index + 1}/${controls.length}`);
              
              // Simulate the double-toggle that works manually
              const performDoubleToggle = async () => {
                try {
                  // First toggle: OFF
                  console.log('🔄 First toggle: Setting to false');
                  control.checked = false;
                  control.dispatchEvent(new Event('change', { bubbles: true }));
                  control.dispatchEvent(new Event('input', { bubbles: true }));
                  control.click();
                  
                  // Wait a bit
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // Second toggle: ON
                  console.log('🔄 Second toggle: Setting to true');
                  control.checked = true;
                  control.dispatchEvent(new Event('change', { bubbles: true }));
                  control.dispatchEvent(new Event('input', { bubbles: true }));
                  control.click();
                  
                  console.log(`✅ Double-toggle completed for control ${index + 1}`);
                  
                  // Trigger resize after toggle
                  setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    console.log('✅ Dispatched resize event');
                  }, 300);
                  
                } catch (error) {
                  console.error(`❌ Error in double-toggle for control ${index + 1}:`, error);
                }
              };
              
              performDoubleToggle();
            });
            
          } else {
            console.log('❌ Could not find MatchViewportRes control');
          }
        }
        
        // Also try the config-level approach
        if (currentConfig._settingsObj) {
          console.log('🔧 Also trying config-level double-toggle...');
          
          // Double-toggle at config level
          currentConfig._settingsObj.MatchViewportRes = false;
          if (currentConfig.setStreamingSettings) {
            currentConfig.setStreamingSettings({ MatchViewportRes: false });
          }
          
          setTimeout(() => {
            currentConfig._settingsObj.MatchViewportRes = true;
            if (currentConfig.setStreamingSettings) {
              currentConfig.setStreamingSettings({ MatchViewportRes: true });
            }
            console.log('✅ Config-level double-toggle completed');
          }, 300);
        }
      }
    } catch (error) {
      console.error('Failed to force resolution match:', error);
    }
  }, [stream]);

  // Expose debug function globally for console access
  React.useEffect(() => {
    (window as any).forceResolutionMatch = forceResolutionMatch;
    return () => {
      delete (window as any).forceResolutionMatch;
    };
  }, [forceResolutionMatch]);

  return (
    <PixelStreamingContext.Provider value={{ 
      settings, 
      updateSettings, 
      resetSettings,
      debugMode,
      debugSettings,
      setDebugMode: setDebugModeStable,
      setDebugSettings: setDebugSettingsStable,
      getEffectiveSettings,
      devMode,
      setDevMode,
      hideNativeOverlay,
      setHideNativeOverlay,
      stream,
      application,
      connectionState,
      connectionError,
      connect,
      disconnect,
      reconnect,
      sendFittingRoomCommand,
      sendCommand,
      forceResolutionMatch,
      onMessageReceived,
      removeMessageHandler
    }}>
      {children}
    </PixelStreamingContext.Provider>
  );
};
