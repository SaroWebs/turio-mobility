/**
 * Web shim for react-native-maps.
 * react-native-maps calls codegenNativeComponent() which does not exist in
 * react-native-web, causing the crash:
 *   "(0 , _reactNativeWebDistIndex.codegenNativeComponent) is not a function"
 *
 * Expo resolves platform-specific files automatically:
 *   - MapView.web.tsx  → loaded on web
 *   - MapView.tsx      → loaded on iOS/Android (re-exports react-native-maps)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Map } from 'lucide-react-native';

// --- Named exports matching react-native-maps API ---

export const PROVIDER_GOOGLE = 'google' as const;

export const Marker = (_props: any) => null;
export const Polyline = (_props: any) => null;
export const Circle = (_props: any) => null;
export const Callout = (_props: any) => null;

interface MapViewProps {
  style?: any;
  region?: any;
  children?: React.ReactNode;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  provider?: any;
  [key: string]: any;
}

export const MapView = ({ style, children }: MapViewProps) => (
  <View style={[styles.placeholder, style]}>
    <View style={styles.iconWrap}>
      <Map color="#0ea5e9" size={40} />
    </View>
    <Text style={styles.title}>Live Map</Text>
    <Text style={styles.subtitle}>Available on iOS & Android</Text>
  </View>
);

// Default export so `import MapView from '...'` also works
export default MapView;

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    gap: 10,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
