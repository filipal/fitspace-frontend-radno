// Copyright Epic Games, Inc. All Rights Reserved.

import { useState, useEffect, useRef } from 'react';
import { usePixelStreaming } from '../../context/PixelStreamingContext';
import type { FittingRoomCommand } from '../../context/PixelStreamingContext';
import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';

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
    setDebugMode,
    setDebugSettings,
    connect,
    disconnect,
    sendCommand,
    sendFittingRoomCommand
  } = usePixelStreaming();

  const containerRef = useRef<HTMLDivElement>(null);
  const [showCustomControls, setShowCustomControls] = useState(false); // Default to false = native UI
  const [commandInput, setCommandInput] = useState('');
  const [commandData, setCommandData] = useState('');
  const [signallingUrl, setSignallingUrl] = useState(settings.ss || 'ws://localhost:80');

  // Apply initial debug settings if provided
  useEffect(() => {
    if (initialDebugSettings) {
      setDebugSettings(initialDebugSettings);
      onDebugSettingsChange?.(initialDebugSettings);
    }
  }, [initialDebugSettings, setDebugSettings, onDebugSettingsChange]);

  // Enable debug mode when debug wrapper is mounted
  useEffect(() => {
    setDebugMode(true);
    return () => {
      setDebugMode(false);
    };
  }, [setDebugMode]);

  // Mount the main application's UI when available and in native mode
  useEffect(() => {
    if (containerRef.current && !showCustomControls && application) {
      // Clear any existing content
      containerRef.current.innerHTML = '';

      // Mount the main application's UI
      if (application.rootElement && application.rootElement.parentNode !== containerRef.current) {
        containerRef.current.appendChild(application.rootElement);
      }
    }
  }, [showCustomControls, application]);

  const handleDebugModeToggle = () => {
    const next = !debugMode;
    setDebugMode(next)
    if (next) {
      const init = initialDebugSettings || {};
      setDebugSettings(init)
      onDebugSettingsChange?.(init)
    } else {
      setDebugSettings(null);
    }
  }

  const handleSignallingUrlChange = (newUrl: string) => {
    setSignallingUrl(newUrl);
    // Update debug settings to override main app settings
    const next = { ss: newUrl } as Partial<AllSettings>
    setDebugSettings(next)
    onDebugSettingsChange?.(next)
  }

  const handleConnect = () => {
    // Ensure URL is set in debug settings before connecting
    if (signallingUrl !== settings.ss) {
      setDebugSettings({ ss: signallingUrl });
      console.log('Updated debug signalling URL to:', signallingUrl);
      onDebugSettingsChange?.({ ss: signallingUrl });
    }
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

  const handleSendFittingRoomCommand = (
    type: FittingRoomCommand['type'],
    customData?: Record<string, unknown>
  ) => {
    const data = customData || { timestamp: Date.now() };
    sendFittingRoomCommand(type, data);
    console.log('Sent fitting room command via main context:', { type, data });
  };

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

        {/* Toggle between native PS UI and custom controls */}
        <button 
          onClick={() => setShowCustomControls(!showCustomControls)}
          style={{ fontSize: '11px', padding: '4px 8px' }}
        >
          {showCustomControls ? 'Show Native UI' : 'Show Command Playground'}
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

      {showCustomControls ? (
        // Command Playground - Focus on emit interactions
        <div>
          <h4 style={{ margin: '0 0 12px 0', color: '#333' }}>🎮 Command Playground</h4>
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
                Zoom In
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('zoomCamera', { direction: 'out', amount: 0.1 })}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Zoom Out
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('resetAvatar')}
                disabled={connectionState !== 'connected'}
                style={{ padding: '6px 8px', fontSize: '10px', borderRadius: '3px' }}
              >
                Reset Avatar
              </button>
              <button 
                onClick={() => handleSendFittingRoomCommand('selectClothing', { itemId: 'test_jacket_01', category: 'tops' })}
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
        // Native Pixel Streaming UI Container with URL Control
        <div>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          <div 
            ref={containerRef}
            style={{
              width: '100%',
              height: '500px', // Fixed height for the native UI
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#000'
            }}
          />
          {!application && (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px', 
              color: '#666',
              fontSize: '11px'
            }}>
              Enter signalling URL and click Connect to see the interface
            </div>
          )}
        </div>
      )}
    </div>
  );
};
