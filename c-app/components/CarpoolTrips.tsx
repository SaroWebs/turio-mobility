import React, { useEffect, useState } from 'react';
import { LiveSharedRides } from './LiveSharedRides';
import { ActivityIndicator, BackHandler, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Car, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiErrorMessage } from '../src/lib/api';
import { carpoolMoney, carpoolTiming, findCarpoolTrips, type CarpoolLocation, type CarpoolTrip } from '../src/lib/carpool';

type Props = {
  origin: CarpoolLocation;
  destination: CarpoolLocation;
  onEditRoute: () => void;
  onSearchCar: () => void;
  onJoined: (booking: any) => void;
};

function TripCard({ trip }: { trip: CarpoolTrip }) {
  const [expanded, setExpanded] = useState(false);
  const timing = carpoolTiming(trip);
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>CARPOOL · {trip.booking_mode === 'instant' ? 'Instant booking' : 'Driver approval'}</Text>
    <Text style={styles.cardTitle}>{trip.origin} → {trip.destination}</Text>
    <View style={styles.timing}>
      <View style={styles.timeColumn}><Text style={styles.muted}>Departure</Text><Text style={styles.time}>{timing.departure}</Text></View>
      <View style={styles.timeColumn}><Text style={styles.muted}>Estimated arrival</Text><Text style={styles.time}>{timing.arrival}</Text></View>
    </View>
    <Text style={styles.muted}>{timing.duration} journey · Times in {trip.timezone}</Text>
    <Text style={styles.body}>{trip.driver.name}{trip.driver.verified ? ' · Verified driver' : ''}</Text>
    <Text style={styles.muted}>{trip.vehicle.make} {trip.vehicle.model} · {trip.remaining_seats} {trip.remaining_seats === 1 ? 'seat' : 'seats'} left</Text>
    <Text style={styles.price}>{carpoolMoney(trip.price_minor, trip.currency)} <Text style={styles.muted}>contribution per seat</Text></Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.detailsButton}>
      <Text style={styles.link}>{expanded ? 'Hide trip details' : 'Trip details'}</Text>
      {expanded ? <ChevronUp size={20} color="#0F766E" /> : <ChevronDown size={20} color="#0F766E" />}
    </TouchableOpacity>
    {expanded && <View style={styles.details}>
      <Text style={styles.body}>One seat total: {carpoolMoney(trip.total_minor, trip.currency)} (includes {carpoolMoney(trip.fee_minor, trip.currency)} platform fee)</Text>
      <Text style={styles.body}>{trip.driver.rating ? `${Number(trip.driver.rating).toFixed(1)} / 5` : 'No reviews yet'} · {trip.driver.completed_trips} completed carpools</Text>
      <Text style={styles.body}>Luggage: {trip.luggage || 'Not specified'}</Text>
      <Text style={styles.body}>{trip.preferences.ac ? 'Air conditioning' : 'No air conditioning'} · {trip.preferences.smoking ? 'Smoking allowed' : 'No smoking'} · {trip.preferences.pets ? 'Pets allowed' : 'No pets'}</Text>
      <Text style={styles.muted}>Free cancellation until {trip.cancellation.free_hours} hours before departure. Later refunds: {trip.cancellation.late_refund_bps / 100}% of the contribution.</Text>
      <Text style={styles.muted}>Full-route trips only. Exact meeting instructions are shared after confirmation.</Text>
    </View>}
  </View>;
}

export function CarpoolTrips({ origin, destination, onEditRoute, onSearchCar, onJoined }: Props) {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<CarpoolTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onEditRoute(); return true; });
    return () => subscription.remove();
  }, [onEditRoute]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      setTrips([]);
      findCarpoolTrips(origin, destination, controller.signal)
        .then((data) => { if (active) setTrips(data); })
        .catch((e) => { if (active) setError(apiErrorMessage(e, 'Unable to load trips. Please retry.')); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [origin, destination, revision]);

  return <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit origin and destination" onPress={onEditRoute} style={styles.back}>
        <ArrowLeft color="#172321" size={22} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>AVAILABLE RIDES</Text>
        <Text accessibilityRole="header" style={styles.title}>Available trips</Text>
      </View>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit route from ${origin.name} to ${destination.name}`} onPress={onEditRoute} style={styles.route}>
      <Text style={styles.body}>{origin.name} → {destination.name}</Text>
      <Text style={styles.link}>Edit route</Text>
    </TouchableOpacity>
    <FlatList
      data={trips}
      keyExtractor={(trip) => String(trip.id)}
      renderItem={({ item }) => <TripCard trip={item} />}
      contentContainerStyle={styles.list}
      refreshing={loading}
      onRefresh={() => setRevision((value) => value + 1)}
      ListHeaderComponent={<LiveSharedRides origin={origin} destination={destination} onJoined={onJoined} />}
      ListEmptyComponent={<View style={styles.empty} accessibilityLiveRegion="polite">
        {loading ? <><ActivityIndicator color="#0F766E" /><Text style={styles.body}>Finding available trips…</Text></> : error ? <>
          <Text accessibilityRole="alert" style={styles.body}>{error}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setRevision((value) => value + 1)} style={styles.detailsButton}><Text style={styles.link}>Retry trip search</Text></TouchableOpacity>
        </> : <><Text style={styles.cardTitle}>No matching trips yet</Text><Text style={styles.muted}>Try another route, pull down to refresh, or search for a car below.</Text></>}
      </View>}
    />
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Text style={styles.footerNote}>Prefer your own car? Check Fast Ride fares.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityHint="Opens Fast Ride vehicle choices and fares for this route" style={styles.searchButton} onPress={onSearchCar}>
        <Car size={22} color="#FFFFFF" /><Text style={styles.searchText}>Search car</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#F4F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 16 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { color: '#0F766E', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: '#172321', fontSize: 26, fontWeight: '700' },
  route: { padding: 16, marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 16, gap: 8, minHeight: 48 },
  list: { padding: 20, gap: 16, flexGrow: 1 },
  card: { padding: 18, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DCE6E0', gap: 12 },
  cardTitle: { color: '#172321', fontSize: 20, fontWeight: '700' },
  timing: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 12, borderRadius: 12, backgroundColor: '#EDF5F1' },
  timeColumn: { flexGrow: 1, flexBasis: 120, gap: 4 },
  time: { color: '#172321', fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body: { color: '#172321', fontSize: 16, lineHeight: 24 },
  muted: { color: '#53655E', fontSize: 14, lineHeight: 21 },
  price: { color: '#172321', fontSize: 22, fontWeight: '700' },
  detailsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 8 },
  link: { color: '#0F766E', fontSize: 16, fontWeight: '600' },
  details: { borderTopWidth: 1, borderTopColor: '#DCE6E0', paddingTop: 12, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  footer: { padding: 16, gap: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DCE6E0' },
  footerNote: { color: '#53655E', fontSize: 14, textAlign: 'center' },
  searchButton: { minHeight: 52, padding: 16, borderRadius: 16, backgroundColor: '#0F766E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  searchText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
