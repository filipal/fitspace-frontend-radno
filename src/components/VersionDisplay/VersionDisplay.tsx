// Copyright Epic Games, Inc. All Rights Reserved.

import packageJson from '../../../package.json';

export const VersionDisplay = () => {
    return (
        <div
            style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
                zIndex: 10000,
                userSelect: 'none',
                pointerEvents: 'none'
            }}
        >
            v{packageJson.version}
        </div>
    );
};