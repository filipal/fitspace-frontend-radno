// Copyright Epic Games, Inc. All Rights Reserved.

import { useRef, useEffect } from 'react';
import {
    Config,
    PixelStreaming
} from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6';
import { 
    Application, 
    PixelStreamingApplicationStyle 
} from '@epicgames-ps/lib-pixelstreamingfrontend-ui-ue5.6';

import type { AllSettings } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.6/dist/types/Config/Config';

export interface PixelStreamingWrapperProps {
    useUrlParams?: boolean;
    initialSettings?: Partial<AllSettings>;
    onSettingsChange?: (newSettings: Partial<AllSettings>) => void;
}

export const PixelStreamingWrapper = ({
    useUrlParams = true,
    initialSettings,
    onSettingsChange
}: PixelStreamingWrapperProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            // Apply styles (exactly like showcase.ts)
            const PixelStreamingApplicationStyles = new PixelStreamingApplicationStyle();
            PixelStreamingApplicationStyles.applyStyleSheet();

            // Create a config object (exactly like showcase.ts)
            const config = new Config({ useUrlParams, initialSettings });

            // Create Pixel Streaming application (exactly like showcase.ts)
            const stream = new PixelStreaming(config);
            const application = new Application({
                stream,
                onColorModeChanged: (isLightMode: boolean) => PixelStreamingApplicationStyles.setColorMode(isLightMode)
            });

            // TODO: Implement settings change detection
            // The Epic Games Pixel Streaming library might not expose direct settings change events
            // This could be implemented by periodically checking for changes or by intercepting UI interactions
            
            // Append to container (exactly like showcase.ts)
            containerRef.current.appendChild(application.rootElement);

            return () => {
                try {
                    stream.disconnect();
                } catch {
                    // Ignore errors during disconnect
                }
            };
        }
    }, [initialSettings, useUrlParams, onSettingsChange]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%'
            }}
        />
    );
};
