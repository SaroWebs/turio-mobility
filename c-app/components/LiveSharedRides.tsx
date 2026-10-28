import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { postBooking } from '../src/lib/booking-attempt';
import type { CarpoolLocation } from '../src/lib/carpool';

type Offer = { offer_id: string; expires_at: string; pickup_at: string; dropoff_at: string; fare: number; driver_name: string; vehicle: string; extension: boolean };
type Props = { origin: CarpoolLocation; destination: CarpoolLocation; onJoined: (booking: any) => void;
  rideSelection?: React.ReactNode; scheduledAt?: Date | null };

export function LiveSharedRides({ origin, destination, onJoined, rideSelection, scheduledAt }: Props) {
  const [tab, setTab] = useState<'car' | 'pool'>('car');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [seats, setSeats] = useState(1);
  const [payment, setPayment] = useState<'cash' | 'wallet'>('cash');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const scheduledTime = scheduledAt?.getTime() ?? null;
  const scheduledTooFar = scheduledTime !== null && (scheduledTime - clock > 600000 || scheduledTime <= clock);
  const available = !loading && !error && !scheduledTooFar && offers.some((offer) => Date.parse(offer.expires_at) > clock);
  // Keep an open panel usable when offers expire or a different seat count has no
  // matches, so the customer can refresh or reduce seats without losing controls.
  const showPool = rideSelection === undefined || tab === 'pool';
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const start = setTimeout(() => {
    setLoading(true); setOffers([]); setError('');
    const readyIn = scheduledTime === null ? 30 : Math.ceil((scheduledTime - Date.now()) / 1000);
    if (readyIn > 600 || readyIn < 0) { setLoading(false); return; }
    api.post('/shared-rides/search', { pickup_lat: origin.lat, pickup_lng: origin.lng, pickup_location: origin.name,
      dropoff_lat: destination.lat, dropoff_lng: destination.lng, dropoff_location: destination.name, seats, ready_in_seconds: readyIn }, { signal: controller.signal, timeout: 60000 })
      .then(({ data }) => { if (!controller.signal.aborted) setOffers(data.data); })
      .catch((e) => { if (!controller.signal.aborted) setError(apiErrorMessage(e, 'Shared ride search unavailable.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(start); controller.abort(); };
  }, [origin.lat, origin.lng, origin.name, destination.lat, destination.lng, destination.name, seats, revision, scheduledTime]);

  const refresh = () => {
    setLoading(true);
    setOffers([]);
    setError('');
    setRevision((value) => value + 1);
  };

  const selectSeats = (value: number) => {
    if (value === seats) return;
    setLoading(true);
    setOffers([]);
    setError('');
    setSeats(value);
  };

  const join = async (offer: Offer) => {
    if (joining || loading || scheduledTooFar || Date.parse(offer.expires_at) <= Date.now()) return;
    setJoining(offer.offer_id); setError('');
    try {
      const { data } = await postBooking('/shared-rides/join', { offer_id: offer.offer_id, payment_method: payment });
      onJoined(data.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not join. Refresh to check availability.'));
    } finally { setJoining(null); }
  };
  return <View style={styles.section}>
    {rideSelection !== undefined && <>
      <View style={styles.tabs}>
        <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: !showPool }} disabled={!!joining} onPress={() => setTab('car')} style={[styles.tab, !showPool && styles.selected]}><Text style={styles.title}>Car ride</Text><Text style={styles.text}>Choose your car</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: showPool, disabled: !available || !!joining }} disabled={!available || !!joining} onPress={() => setTab('pool')} style={[styles.tab, showPool && styles.selected, !available && styles.disabled]}><Text style={styles.title}>Car pooling</Text><Text style={styles.text}>{loading ? 'Checking…' : available ? 'Rides available' : 'Unavailable'}</Text></TouchableOpacity>
      </View>
      <View style={styles.availability}>
        <Text style={[styles.text, { flex: 1 }]}>{scheduledTooFar ? 'Live pooling is available for pickups within the next 10 minutes.' : loading ? 'Checking rides along your route and pickup time…' : error || (available ? 'Join a car already heading your way.' : 'No sharing cars match this route and time. You can book a car ride.')}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh pooling availability" disabled={loading || !!joining} onPress={refresh} style={styles.button}><Text>Refresh</Text></TouchableOpacity>
      </View>
    </>}
    {!showPool && rideSelection}
    {showPool && <>
    <Text accessibilityRole="header" style={styles.title}>Join a ride on the way</Text>
    <Text style={styles.text}>Share with other passengers. Your pickup and destination must fit the remaining journey.</Text>
    <View style={styles.row}>{[1, 2, 3].map((n) => <TouchableOpacity key={n} accessibilityRole="button" accessibilityState={{ selected: seats === n }} disabled={!!joining} onPress={() => selectSeats(n)} style={[styles.button, seats === n && styles.selected]}><Text>{n} {n === 1 ? 'seat' : 'seats'}</Text></TouchableOpacity>)}</View>
    <View style={styles.row}>{(['cash', 'wallet'] as const).map((method) => <TouchableOpacity key={method} accessibilityRole="button" accessibilityState={{ selected: payment === method }} disabled={!!joining} onPress={() => setPayment(method)} style={[styles.button, payment === method && styles.selected]}><Text>{method === 'cash' ? 'Pay cash' : 'Pay with wallet'}</Text></TouchableOpacity>)}</View>
    {loading && <ActivityIndicator accessibilityLabel="Finding live shared rides" />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!loading && !error && !offers.length && <Text style={styles.text}>No live shared rides fit this journey right now.</Text>}
    {offers.map((offer) => {
      const expired = Date.parse(offer.expires_at) <= clock;
      return <View key={offer.offer_id} style={styles.offer}>
        <Text style={styles.title}>{offer.driver_name} · {offer.vehicle}</Text>
        <Text style={styles.text}>Pickup {new Date(offer.pickup_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Arrival {new Date(offer.dropoff_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        {offer.extension && <Text style={styles.text}>Driver allows continuing to your destination.</Text>}
        <Text style={styles.text}>Total ₹{Number(offer.fare).toFixed(2)} for {seats} {seats === 1 ? 'seat' : 'seats'}</Text>
        <TouchableOpacity accessibilityRole="button" disabled={expired || loading || scheduledTooFar || !!joining} onPress={() => void join(offer)} style={styles.button}>
          <Text>{joining === offer.offer_id ? 'Joining…' : expired ? 'Offer expired — refresh below' : `Agree to share & book · ${payment}`}</Text>
        </TouchableOpacity>
      </View>;
    })}
    <TouchableOpacity accessibilityRole="button" disabled={loading || !!joining} onPress={refresh} style={styles.button}><Text>Refresh shared rides</Text></TouchableOpacity>
    {rideSelection === undefined && <Text style={styles.title}>Scheduled intercity carpools</Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 10 }, tab: { flex: 1, padding: 14, gap: 4, borderRadius: 14, borderWidth: 1, borderColor: '#BCCFC5', minHeight: 76 },
  disabled: { backgroundColor: '#F1F5F3', opacity: 0.65 }, availability: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  section: { gap: 12, marginBottom: 16 }, title: { fontSize: 17, fontWeight: '600', color: '#16332B' },
  text: { color: '#40534B', lineHeight: 21 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { padding: 12, minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: '#BCCFC5', borderRadius: 8 },
  selected: { backgroundColor: '#DCEEE5' }, offer: { paddingVertical: 16, gap: 8, borderBottomWidth: 1, borderColor: '#BCCFC5' }, error: { color: '#A12A2A' },
});
