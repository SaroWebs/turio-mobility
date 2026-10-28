import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
import RNMapView, {
  Marker,
  Polyline,
  Circle,
  Callout,
  PROVIDER_GOOGLE as RN_PROVIDER_GOOGLE,
  type MapViewProps,
} from 'react-native-maps';

export const PROVIDER_GOOGLE = Platform.OS === 'android' ? RN_PROVIDER_GOOGLE : undefined;

export const MapView = forwardRef<RNMapView, MapViewProps>((props, ref) => {
  const safeProvider =
    Platform.OS === 'ios' && props.provider === RN_PROVIDER_GOOGLE
      ? undefined
      : props.provider ?? (Platform.OS === 'android' ? RN_PROVIDER_GOOGLE : undefined);

  return <RNMapView ref={ref} {...props} provider={safeProvider} />;
});

MapView.displayName = 'MapView';

export { MapView as default, Marker, Polyline, Circle, Callout };
