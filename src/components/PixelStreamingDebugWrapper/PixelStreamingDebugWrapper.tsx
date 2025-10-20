// Copyright Epic Games, Inc. All Rights Reserved.

import { useState, useEffect, useRef } from 'react';
import { usePixelStreaming } from '../../context/PixelStreamingContext';
import type {
  FitSpaceCommandData,
  FittingRoomCommandType,
} from '../../context/PixelStreamingContext';
import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';
import {
  getClothingIdentifierBySubCategory,
  getDefaultClothingSelection,
} from '../../constants/clothing';

export interface PixelStreamingWrapperProps {
  initialDebugSettings?: Partial<AllSettings>;
  onDebugSettingsChange?: (settings: Partial<AllSettings>) => void
}

/**
 * Debug UI component that provides controls for the main PixelStreaming connection.
 * This component does NOT create its own connection - it controls the main app connection
 * managed by PixelStreamingContext.
 */
export const PixelStreamingWrapper = ({
  initialDebugSettings,
  onDebugSettingsChange,
}: PixelStreamingWrapperProps) => {
  const {
    debugMode,
    connectionState,
    connectionError,
    application,
    settings,
    devMode,
    setDebugMode,
    setDebugSettings,
    connect,
    disconnect,
    sendCommand,
    sendFitSpaceCommand
  } = usePixelStreaming();

  const initialSettingsAppliedRef = useRef(false);
  const initialSettingsRef = useRef<Partial<AllSettings> | null>(null);
  const [showCustomControls, setShowCustomControls] = useState(true); // Default to true = custom controls (don't steal the main UI)
  const [commandInput, setCommandInput] = useState('');
  const [commandData, setCommandData] = useState('');
  const [signallingUrl, setSignallingUrl] = useState(settings.ss || 'ws://localhost:80');

  // Store initial settings on first render
  if (!initialSettingsRef.current && initialDebugSettings) {
    initialSettingsRef.current = initialDebugSettings;
  }

  // Apply initial debug settings if provided, but only once
  useEffect(() => {
    if (initialSettingsRef.current && !initialSettingsAppliedRef.current) {
      initialSettingsAppliedRef.current = true;
      setDebugSettings(initialSettingsRef.current);
      onDebugSettingsChange?.(initialSettingsRef.current);
    }
  }, []); // Empty dependency array - only run once

  // Enable debug mode when debug wrapper is mounted, but only if not already enabled
  useEffect(() => {
    let mounted = true;
    if (!debugMode && mounted) {
      setDebugMode(false);
    }
    return () => {
      mounted = false;
      // Don't automatically disable debug mode on unmount
      // Let the user control it via the UI
    };
  }, []); // Empty dependency array prevents infinite re-renders

  // Auto-set signalling URL based on devMode
  useEffect(() => {
    if (devMode === 'localhost') {
      const localhostUrl = 'ws://localhost:80';
      if (signallingUrl !== localhostUrl) {
        console.log('🏠 Localhost mode detected, setting URL to:', localhostUrl);
        setSignallingUrl(localhostUrl);
        
        // Enable debug mode to ensure settings override works
        if (!debugMode) {
          console.log('🔧 Enabling debug mode for localhost override');
          setDebugMode(true);
        }
        
        // Update debug settings to override main app settings
        const next = { ss: localhostUrl } as Partial<AllSettings>;
        setDebugSettings(next);
        onDebugSettingsChange?.(next);
        console.log('🔧 Set debug settings for localhost:', next);
      }
    }
  }, [devMode, signallingUrl, setDebugSettings, onDebugSettingsChange, debugMode, setDebugMode]); // Run when devMode changes

  // Mount the main application's UI when available and in native mode
  // DISABLED: Don't move the application.rootElement to debug panel as it breaks the main app
  // useEffect(() => {
  //   if (containerRef.current && !showCustomControls && application) {
  //     // Clear any existing content
  //     containerRef.current.innerHTML = '';

  //     // Mount the main application's UI
  //     if (application.rootElement && application.rootElement.parentNode !== containerRef.current) {
  //       containerRef.current.appendChild(application.rootElement);
  //     }
  //   }
  // }, [showCustomControls, application]);

  const handleDebugModeToggle = () => {
    const next = !debugMode;
    setDebugMode(next);
    
    if (next) {
      // Entering debug mode - apply initial settings
      const init = initialSettingsRef.current || {};
      setDebugSettings(init);
      onDebugSettingsChange?.(init);
    } else {
      // Exiting debug mode - clear debug settings
      setDebugSettings(null);
      onDebugSettingsChange?.({});
    }
  };

  const handleSignallingUrlChange = (newUrl: string) => {
    setSignallingUrl(newUrl);
    // Update debug settings to override main app settings
    const next = { ss: newUrl } as Partial<AllSettings>;
    setDebugSettings(next);
    onDebugSettingsChange?.(next);
  };

  const handleConnect = () => {
    // Ensure URL is set in debug settings before connecting
    if (signallingUrl !== settings.ss) {
      const debugSettingsUpdate = { ss: signallingUrl };
      setDebugSettings(debugSettingsUpdate);
      console.log('🔧 Updated debug signalling URL to:', signallingUrl);
      console.log('🔧 Current settings.ss:', settings.ss);
      console.log('🔧 Debug settings update:', debugSettingsUpdate);
      onDebugSettingsChange?.(debugSettingsUpdate);
    }
    
    // For localhost mode, ensure debug mode is enabled and settings are applied
    if (devMode === 'localhost') {
      if (!debugMode) {
        console.log('🏠 Enabling debug mode for localhost connection');
        setDebugMode(true);
      }
      
      // Force the debug settings again to ensure they take effect
      const localhostSettings = { ss: 'ws://localhost:80' };
      setDebugSettings(localhostSettings);
      console.log('🏠 Forced localhost debug settings before connect:', localhostSettings);
      onDebugSettingsChange?.(localhostSettings);
    }
    
    console.log('🚀 Attempting to connect with current effective settings...');
    connect();
  };

  const handleSendCommand = () => {
    if (!commandInput.trim()) return;
    
    try {
      const data = commandData.trim() ? JSON.parse(commandData) : undefined;
      sendCommand(commandInput.trim(), data);
      console.log('Sent command via main context:', { command: commandInput.trim(), data });

      setCommandInput('');
      setCommandData('');
    } catch (e) {
      console.error('Invalid JSON in command data:', e);
      alert('Invalid JSON in command data');
    }
  };

  type PayloadCommand = Exclude<FittingRoomCommandType, 'resetAvatar'>;

  function handleSendFittingRoomCommand(type: 'resetAvatar'): void;
  function handleSendFittingRoomCommand<T extends PayloadCommand>(
    type: T,
    customData?: FitSpaceCommandData<T>
  ): void;
  function handleSendFittingRoomCommand(
    type: FittingRoomCommandType,
    customData?: FitSpaceCommandData<FittingRoomCommandType>
  ): void {
    if (type === 'resetAvatar') {
      sendFitSpaceCommand('resetAvatar');
      console.log('Sent fitting room command via main context:', {
        type: 'resetAvatar',
        data: undefined,
      });
      return;
    }

    const payloadType = type as PayloadCommand;
    const fallbackData =
      (customData as FitSpaceCommandData<typeof payloadType> | undefined) ??
      (payloadType === 'selectClothing'
        ? ({
            category: 'top',
            ...getDefaultClothingSelection('top'),
          } as FitSpaceCommandData<typeof payloadType>)
        : undefined);

    if (fallbackData === undefined) {
      console.warn('Missing payload for fitting room command', { type: payloadType });
      return;
    }

    sendFitSpaceCommand(payloadType, fallbackData);
    console.log('Sent fitting room command via main context:', {
      type: payloadType,
      data: fallbackData,
    });
  }

  return (
    <div style={{ 
      padding: '10px', 
      border: '1px solid #ccc', 
      borderRadius: '8px',
      backgroundColor: '#f9f9f9',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>🔧 Pixel Streaming Debug</h3>

        {/* Toggle between debug controls and connection info */}
        <button 
          onClick={() => setShowCustomControls(!showCustomControls)}
          style={{ fontSize: '11px', padding: '4px 8px' }}
        >
          {showCustomControls ? 'Show Connection Info' : 'Show Debug Controls'}
        </button>

        {/* Debug Mode Toggle */}
        <label style={{ fontSize: '11px' }}>
          <input 
            type="checkbox" 
            checked={debugMode} 
            onChange={handleDebugModeToggle}
            style={{ marginRight: '5px' }}
          />
          Debug Override
        </label>

        {/* Connection Status Indicator */}
        <div style={{ 
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '3px',
          backgroundColor: connectionState === 'connected' ? '#d4edda' : 
                          connectionState === 'error' ? '#f8d7da' : '#fff3cd',
          color: connectionState === 'connected' ? '#155724' : 
                connectionState === 'error' ? '#721c24' : '#856404'
        }}>
          MAIN: {connectionState.toUpperCase()}
        </div>

        {/* Dev Mode Indicator */}
        <div style={{ 
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '3px',
          backgroundColor: devMode === 'prod' ? '#e2e3e5' : 
                          devMode === 'dev' ? '#cce5ff' : '#ffe0b3',
          color: devMode === 'prod' ? '#383d41' : 
                devMode === 'dev' ? '#004085' : '#7a4f00'
        }}>
          MODE: {devMode.toUpperCase()}
        </div>

        {/* Exit instructions */}
        <div style={{ 
          fontSize: '10px',
          color: '#666',
          marginLeft: 'auto'
        }}>
          Press Escape or Ctrl+Shift+D to exit
        </div>
      </div>

      {debugMode && (
        <div style={{ 
          marginBottom: '10px', 
          padding: '8px', 
          backgroundColor: '#fff3cd', 
          borderRadius: '4px',
          fontSize: '11px',
          color: '#856404'
        }}>
          🔧 Debug settings are overriding main app settings
        </div>
      )}

      {devMode === 'localhost' && (
        <div style={{ 
          marginBottom: '10px', 
          padding: '8px', 
          backgroundColor: '#ffe0b3', 
          borderRadius: '4px',
          fontSize: '11px',
          color: '#7a4f00'
        }}>
          🏠 Localhost mode active - Signalling URL auto-set to ws://localhost:80
        </div>
      )}

      {showCustomControls ? (
        // Command Playground - Focus on emit interactions
        <div>
          <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>🎮 Command Playground</h4>
          
          {/* Connection Controls - Always visible */}
          <div style={{ 
            marginBottom: '15px', 
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
              Connection
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Signalling URL:
              </div>
              <input 
                type="text" 
                value={signallingUrl}
                onChange={(e) => handleSignallingUrlChange(e.target.value)}
                style={{ 
                  flex: 1,
                  minWidth: '200px',
                  fontSize: '11px', 
                  padding: '4px 6px',
                  border: '1px solid #ccc',
                  borderRadius: '3px'
                }}
                placeholder="ws://localhost:80"
              />
              <button 
                onClick={handleConnect}
                disabled={connectionState === 'connecting'}
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 8px',
                  backgroundColor: connectionState === 'connected' ? '#28a745' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px'
                }}
              >
                {connectionState === 'connected' ? 'Connected' : 'Connect'}
              </button>
              <button 
                onClick={disconnect}
                disabled={connectionState === 'disconnected'}
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 8px',
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px'
                }}
              >
                Disconnect
              </button>
            </div>
            <div style={{ 
              fontSize: '10px', 
              marginTop: '5px',
              color: connectionState === 'connected' ? '#28a745' : 
                     connectionState === 'error' ? '#dc3545' : '#6c757d'
            }}>
              Status: {connectionState.toUpperCase()}
              {connectionError && ` - ${connectionError}`}
            </div>
          </div>
          
          <div style={{ 
            fontSize: '11px', 
            color: '#666', 
            marginBottom: '15px',
            padding: '8px',
            backgroundColor: '#f0f8ff',
            borderRadius: '4px'
          }}>
            Test interactions between frontend and UE streamer. All commands go through the main connection.
          </div>

          {/* Generic Command Interface */}
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 8px 0' }}>Generic Commands</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Command name (e.g., 'rotateCamera')" 
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  style={{ 
                    flex: 2, 
                    fontSize: '11px', 
                    padding: '4px 6px'
                  }}
                />
                <input 
                  type="text" 
                  placeholder='JSON data (e.g., {"angle": 45})' 
                  value={commandData}
                  onChange={(e) => setCommandData(e.target.value)}
                  style={{ 
                    flex: 3, 
                    fontSize: '11px', 
                    padding: '4px 6px'
                  }}
                />
                <button 
                  onClick={handleSendCommand} 
                  disabled={connectionState !== 'connected' || !commandInput.trim()}
                  style={{ 
                    padding: '4px 12px', 
                    fontSize: '11px',
                    backgroundColor: connectionState === 'connected' ? '#007bff' : '#ccc',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Predefined Fitting Room Commands */}
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 8px 0' }}>Fitting Room Commands</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
              <button 
                onClick={() => handleSendFittingRoomCommand('rotateCamera', { direction: 'left', speed: 1 })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Rotate Left
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('rotateCamera', { direction: 'right', speed: 1 })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Rotate Right
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('zoomCamera', { direction: 'in', amount: 0.1 })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Zoom
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('moveCamera', { direction: 'up', amount: 0.1 })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Move Cam
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('resetAvatar')}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Reset Avatar
              </button>
              <button
                onClick={() => {
                  const { itemId, subCategory } = getClothingIdentifierBySubCategory('top', 'Jackets');
                  handleSendFittingRoomCommand('selectClothing', {
                    category: 'top',
                    subCategory,
                    itemId,
                  });
                }}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Select Test Jacket
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('morphAdjustment', { bodyPart: 'chest', adjustment: 0.1 })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Adjust Chest
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('saveLook', { lookName: 'debug_test_' + Date.now() })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Save Look
              </button>
            </div>
          </div>

          {/* Custom Event Emitters */}
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 8px 0' }}>Custom Events</h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button 
                onClick={() => {
                  sendCommand('testConnection', { timestamp: Date.now() });
                }}
                disabled={connectionState !== 'connected'}
                style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Test Connection
              </button>
              <button 
                onClick={() => {
                  sendCommand('requestState');
                }}
                disabled={connectionState !== 'connected'}
                style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Request State
              </button>
              <button 
                onClick={() => {
                  sendCommand('ping', { clientTime: Date.now() });
                }}
                disabled={connectionState !== 'connected'}
                style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Ping Server
              </button>
              <button 
                onClick={() => {
                  sendCommand('debugInfo');
                }}
                disabled={connectionState !== 'connected'}
                style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Debug Info
              </button>
            </div>
          </div>

          {/* Connection Status for Commands */}
          <div style={{
            padding: '8px',
            backgroundColor: connectionState === 'connected' ? '#d4edda' : '#f8d7da',
            borderRadius: '4px',
            fontSize: '11px',
            textAlign: 'center'
          }}>
            {connectionState === 'connected' 
              ? '✅ Debug stream connected - commands ready!' 
              : `❌ Debug stream ${connectionState} - connect in native UI first`
            }
            {connectionError && (
              <div style={{ color: '#721c24', marginTop: '4px' }}>
                Error: {connectionError}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Connection Information Display
        <div>
          <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>📊 Connection Information</h4>
          
          <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#666' }}>
              Signalling URL:
            </div>
            <input 
              type="text" 
              value={signallingUrl}
              onChange={(e) => handleSignallingUrlChange(e.target.value)}
              style={{ 
                flex: 1,
                fontSize: '11px', 
                padding: '4px 6px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
              placeholder="ws://localhost:80"
            />
            <button 
              onClick={handleConnect}
              disabled={connectionState === 'connecting'}
              style={{ 
                fontSize: '11px', 
                padding: '4px 8px',
                backgroundColor: connectionState === 'connected' ? '#28a745' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '3px'
              }}
            >
              {connectionState === 'connected' ? 'Connected' : 'Connect'}
            </button>
            <button 
              onClick={disconnect}
              disabled={connectionState === 'disconnected'}
              style={{ 
                fontSize: '11px', 
                padding: '4px 8px',
                backgroundColor: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '3px'
              }}
            >
              Disconnect
            </button>
          </div>
          
          {/* Connection Status Display */}
          <div style={{
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa'
          }}>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <strong>Status:</strong> <span style={{
                color: connectionState === 'connected' ? '#28a745' : 
                       connectionState === 'error' ? '#dc3545' : '#6c757d'
              }}>
                {connectionState.toUpperCase()}
              </span>
            </div>
            
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <strong>Dev Mode:</strong> <span style={{
                color: devMode === 'prod' ? '#6c757d' : 
                       devMode === 'dev' ? '#007bff' : '#ffc107'
              }}>
                {devMode.toUpperCase()}
              </span>
              {devMode === 'localhost' && (
                <span style={{ fontSize: '10px', color: '#7a4f00', marginLeft: '8px' }}>
                  (Auto-connects to localhost)
                </span>
              )}
            </div>
            
            {connectionError && (
              <div style={{ fontSize: '11px', color: '#dc3545', marginBottom: '8px' }}>
                <strong>Error:</strong> {connectionError}
              </div>
            )}
            
            {application && (
              <div style={{ fontSize: '11px', color: '#28a745' }}>
                ✅ Pixel Streaming application is running on the main page
              </div>
            )}
            
            {!application && (
              <div style={{ fontSize: '11px', color: '#6c757d' }}>
                ⏳ No active Pixel Streaming application
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};