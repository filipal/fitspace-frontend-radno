import { PixelStreamingView } from '../PixelStreamingView/PixelStreamingView';

interface AppPixelStreamingWrapperProps {
  style?: React.CSSProperties;
  className?: string;
  autoConnect?: boolean;
}

/**
 * App-specific wrapper for pixel streaming that uses the centralized context.
 * This is the component that should be used in the main application pages
 * like UnrealMeasurements and VirtualTryOn.
 */
export const AppPixelStreamingWrapper: React.FC<AppPixelStreamingWrapperProps> = ({
  style,
  className,
  autoConnect = true
}) => {
  return (
    <PixelStreamingView 
      style={style} 
      className={className}
      autoConnect={autoConnect}
    />
  );
};