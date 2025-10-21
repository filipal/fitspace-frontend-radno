import { useState } from 'react';
import { usePixelStreaming } from '../hooks/usePixelStreamingSettings';
import { AppPixelStreamingWrapper } from '../components/AppPixelStreamingWrapper/AppPixelStreamingWrapper';
import Header from '../components/Header/Header';
import { useNavigate } from 'react-router-dom';
import {
  type ClothingCategory,
  getClothingIdentifierBySubCategory,
} from '../constants/clothing';

export default function PixelStreamingDemo() {
  const navigate = useNavigate();
  const { 
    connectionState, 
    connectionError, 
    sendFitSpaceCommand,
    connect,
    disconnect 
  } = usePixelStreaming();
  
  const [selectedClothing, setSelectedClothing] = useState('');
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(1);

  const handleClothingSelect = (category: ClothingCategory, subCategory: string) => {
    const { itemId, subCategory: normalizedSubCategory } =
      getClothingIdentifierBySubCategory(category, subCategory);

    setSelectedClothing(`${category}-${normalizedSubCategory}`);

    sendFitSpaceCommand('selectClothing', {
      category,
      subCategory: normalizedSubCategory,
      itemId
    });
  };

  const handleCameraRotate = (direction: 'left' | 'right') => {
    const degrees = direction === 'left' ? -45 : 45;
    const newRotation = cameraRotation + degrees;
    setCameraRotation(newRotation);
    
    sendFitSpaceCommand('rotateCamera', {
      direction,
      degrees: 45,
      totalRotation: newRotation
    });
  };

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(3, cameraZoom + delta));
    setCameraZoom(newZoom);
    
    sendFitSpaceCommand('zoomCamera', {
      level: newZoom,
      delta
    });
  };

  const handleMorphAdjustment = (morphName: string, value: number) => {
    sendFitSpaceCommand('morphAdjustment', {
      morphName,
      value,
      timestamp: Date.now()
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header
        title="Pixel Streaming Demo"
        variant="dark"
        onExit={() => navigate('/')}
      />
      
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Pixel Streaming View */}
        <div style={{ flex: 1, background: '#000' }}>
          <AppPixelStreamingWrapper />
        </div>
        
        {/* Controls Panel */}
        <div style={{ 
          width: '300px', 
          padding: '20px', 
          background: '#f5f5f5',
          overflowY: 'auto'
        }}>
          <h3>Connection Status</h3>
          <p>State: <strong>{connectionState}</strong></p>
          {connectionError && (
            <p style={{ color: 'red' }}>Error: {connectionError}</p>
          )}
          
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => connect()} disabled={connectionState !== 'disconnected'}>
              Connect
            </button>
            <button onClick={disconnect} disabled={connectionState !== 'connected'}>
              Disconnect
            </button>
          </div>

          <h3>Clothing Selection</h3>
          <p>Selected: {selectedClothing || 'None'}</p>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => handleClothingSelect('top', 'Jackets')}>
              Select Jacket
            </button>
            <button onClick={() => handleClothingSelect('top', 'T-Shirt')}>
              Select Shirt
            </button>
            <button onClick={() => handleClothingSelect('bottom', 'Jeans')}>
              Select Pants
            </button>
            <button onClick={() => handleClothingSelect('bottom', 'Shorts')}>
              Select Shorts
            </button>
          </div>

          <h3>Camera Controls</h3>
          <p>Rotation: {cameraRotation}°</p>
          <p>Zoom: {cameraZoom.toFixed(1)}x</p>
          <div style={{ marginBottom: '20px' }}>
            <button onClick={() => handleCameraRotate('left')}>
              ← Rotate Left
            </button>
            <button onClick={() => handleCameraRotate('right')}>
              Rotate Right →
            </button>
            <br />
            <button onClick={() => handleZoom(-0.2)}>
              Zoom Out
            </button>
            <button onClick={() => handleZoom(0.2)}>
              Zoom In
            </button>
          </div>

          <h3>Body Morphs</h3>
          <div style={{ marginBottom: '20px' }}>
            <label>
              Height:
              <input 
                type="range" 
                min="-1" 
                max="1" 
                step="0.1"
                onChange={(e) => handleMorphAdjustment('height', parseFloat(e.target.value))}
              />
            </label>
            <br />
            <label>
              Weight:
              <input 
                type="range" 
                min="-1" 
                max="1" 
                step="0.1"
                onChange={(e) => handleMorphAdjustment('weight', parseFloat(e.target.value))}
              />
            </label>
            <br />
            <label>
              Muscle:
              <input 
                type="range" 
                min="-1" 
                max="1" 
                step="0.1"
                onChange={(e) => handleMorphAdjustment('muscle', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <h3>Actions</h3>
          <div>
            <button onClick={() => sendFitSpaceCommand('resetAvatar')}>
              Reset Avatar
            </button>
            <button onClick={() => sendFitSpaceCommand('saveLook', { timestamp: Date.now() })}>
              Save Current Look
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
