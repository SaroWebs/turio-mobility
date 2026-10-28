import { useRef } from 'react';
import { Text, View, Pressable } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from './MapView';
import { useTheme } from '../src/constants/theme';

export function coordinate(latitude: unknown, longitude: unknown) {
  if (latitude === null || longitude === null || latitude === undefined || longitude === undefined || latitude === '' || longitude === '') return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : null;
}

export default function JourneyMap({ tracking }: { tracking: any }) {
  const { colors } = useTheme();
  const ref = useRef<any>(null);
  const location = tracking?.current_location;
  const point = coordinate(location?.latitude, location?.longitude);
  const center = point || coordinate(tracking?.pickup?.latitude, tracking?.pickup?.longitude);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{tracking?.tracking?.state === 'live' ? 'Live journey' : 'Journey location'}</Text>
    <Text style={{ color: colors.textSecondary }}>{tracking?.location_reason || 'Waiting for your assigned driver to share a position.'}</Text>
    {location?.last_update && <Text style={{ color: colors.textSecondary }}>Last update: {new Date(location.last_update).toLocaleTimeString()} · {tracking?.location_source?.replace(/_/g, ' ')}</Text>}
    {center && <><MapView ref={ref} provider={PROVIDER_GOOGLE} style={{ height: 230, borderRadius: 16 }} initialRegion={{ ...center, latitudeDelta: .03, longitudeDelta: .03 }} onMapReady={() => ref.current?.animateToRegion({ ...center, latitudeDelta: .03, longitudeDelta: .03 }, 300)}>{point && <Marker coordinate={point} title="Assigned driver" />}</MapView><Pressable accessibilityRole="button" onPress={() => ref.current?.animateToRegion({ ...center, latitudeDelta: .03, longitudeDelta: .03 }, 300)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.brand }}>Recenter map</Text></Pressable></>}
  </View>;
}
