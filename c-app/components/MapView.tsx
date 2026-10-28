import React, { forwardRef, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import RNMapView, {
  Marker,
  Polyline,
  Circle,
  Callout,
  PROVIDER_GOOGLE as RN_PROVIDER_GOOGLE,
  type MapViewProps,
} from 'react-native-maps';

/**
 * Native (iOS / Android) entry point.
 * On Android, Google Maps is used.
 * On iOS, automatically falls back to native Apple Maps in Expo Go / environments
 * without native Google Maps CocoaPods linked, avoiding UIManager missing component crashes.
 */
export const PROVIDER_GOOGLE = Platform.OS === 'android' ? RN_PROVIDER_GOOGLE : undefined;

export const MapView = forwardRef<RNMapView, MapViewProps>((props, ref) => {
  const loaded = useRef(false);
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setTimeout(() => {
      if (!loaded.current) console.warn('[Maps] No tile-loaded event after 30 seconds.', {
        platform: Platform.OS,
        runtime: Constants.executionEnvironment,
        hint: 'Check Android logcat for Maps authorization/network errors. Expo Go uses its own native Maps credentials.',
      });
    }, 30000);
    return () => clearTimeout(timer);
  }, []);
  // If running on iOS and Google Maps is requested, safely fallback to native Apple Maps
  const safeProvider =
    Platform.OS === 'ios' && props.provider === RN_PROVIDER_GOOGLE
      ? undefined
      : props.provider ?? (Platform.OS === 'android' ? RN_PROVIDER_GOOGLE : undefined);

  return (
    <RNMapView
      ref={ref}
      {...props}
      provider={safeProvider}
      onMapReady={(event) => {
        if (__DEV__) console.info('[Maps] Native map ready.', { platform: Platform.OS, runtime: Constants.executionEnvironment });
        props.onMapReady?.(event);
      }}
      onMapLoaded={(event) => {
        loaded.current = true;
        if (__DEV__) console.info('[Maps] Map tiles loaded.');
        props.onMapLoaded?.(event);
      }}
    />
  );
});

export { Marker, Polyline, Circle, Callout };
export default MapView;
