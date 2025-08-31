import { usePixelStreamingSettings } from '../../hooks/usePixelStreamingSettings';
import { PixelStreamingWrapper as BasePixelStreamingWrapper } from '../PixelStreamingDebugWrapper/PixelStreamingDebugWrapper';

interface AppPixelStreamingWrapperProps {
  style?: React.CSSProperties;
  className?: string;
}

export const AppPixelStreamingWrapper: React.FC<AppPixelStreamingWrapperProps> = ({ 
  style,
  className 
}) => {
  const { settings } = usePixelStreamingSettings();

  return (
    <div style={style} className={className}>
      <BasePixelStreamingWrapper 
        useUrlParams={true}
        initialSettings={settings}
      />
    </div>
  );
};
