import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, BusFront, CalendarDays, CarFront, CheckCircle2, MapPin, Navigation, Phone, ShieldCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import api from '../src/lib/api';
import { labelStatus, money, RentalTask, TourAssignmentTask, TourBookingTask } from '../src/types/services';

export default function ServiceTaskScreen() {
  const { kind, payload } = useLocalSearchParams<{ kind: 'tour' | 'rental'; payload: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const initial = useMemo(() => { try { return JSON.parse(payload || '{}'); } catch { return {}; } }, [payload]);
  const [task, setTask] = useState<TourAssignmentTask | RentalTask>(initial);
  const [selectedBooking, setSelectedBooking] = useState<TourBookingTask | null>(kind === 'tour' ? initial.bookings?.[0] || null : null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const isTour = kind === 'tour';
  const rental = task as RentalTask;
  const tour = task as TourAssignmentTask;
  const operationalStatus = isTour ? selectedBooking?.status : rental.status;
  const customerName = isTour ? (selectedBooking?.customer?.name || selectedBooking?.customer_name) : (rental.customer?.name || rental.customer_name);
  const customerPhone = isTour ? (selectedBooking?.customer?.phone || selectedBooking?.customer_phone) : (rental.customer?.phone || rental.customer_phone);

  const updateTask = useCallback(async () => {
    try {
      const response = await api.get(isTour ? '/tour-assignments' : '/rental-assignments');
      const rows = response.data?.data?.data || response.data?.data || [];
      const fresh = rows.find((item: any) => item.id === Number((task as any).id));
      if (fresh) {
        setTask(fresh);
        if (isTour && selectedBooking) setSelectedBooking(fresh.bookings?.find((item: TourBookingTask) => item.id === selectedBooking.id) || fresh.bookings?.[0] || null);
      }
    } catch { /* retain the current task when refresh is unavailable */ }
  }, [isTour, selectedBooking, task]);

  useEffect(() => {
    if (!['in_progress'].includes(operationalStatus || '')) return;
    let subscription: Location.LocationSubscription | undefined;
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 10000 }, (location) => {
        const id = isTour ? selectedBooking?.id : rental.id;
        if (id) void api.post(`/tracking/${kind}/${id}/location`, { latitude: location.coords.latitude, longitude: location.coords.longitude, heading: location.coords.heading, speed: location.coords.speed, accuracy: location.coords.accuracy }).catch(() => undefined);
      });
    })();
    return () => subscription?.remove();
  }, [isTour, kind, operationalStatus, rental.id, selectedBooking?.id]);

  const updateStatus = async (status: string) => {
    const id = isTour ? selectedBooking?.id : rental.id;
    if (!id) return;
    setBusy(true);
    try {
      const response = await api.post(`/tracking/${kind}/${id}/status`, { status, start_pin: pin || undefined });
      if (isTour) setSelectedBooking(response.data.data); else setTask((old) => ({ ...old, ...response.data.data }));
      setPin('');
      Alert.alert('Updated', status === 'in_progress' ? `${isTour ? 'Tour' : 'Rental'} started. Live location sharing is active.` : `${isTour ? 'Tour' : 'Rental'} completed successfully.`);
      await updateTask();
    } catch (e: any) {
      Alert.alert('Action failed', e.response?.data?.message || 'Please check the details and try again.');
    } finally { setBusy(false); }
  };

  const completeAssignment = async () => {
    setBusy(true);
    try { await api.post(`/tour-assignments/${tour.id}/complete`); Alert.alert('Assignment complete', 'This tour assignment has been closed.', [{ text: 'Done', onPress: () => router.back() }]); }
    catch (e: any) { Alert.alert('Could not complete', e.response?.data?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };

  const navigate = () => {
    const query = encodeURIComponent(isTour ? (tour.schedule?.meeting_point || tour.schedule?.tour?.start_location || '') : (operationalStatus === 'in_progress' ? rental.dropoff_location : rental.pickup_location) || '');
    const url = Platform.select({ ios: `maps:0,0?q=${query}`, android: `geo:0,0?q=${query}` });
    if (url) void Linking.openURL(url);
  };

  const bookings = tour.bookings || [];
  const allBookingsDone = bookings.length > 0 && bookings.every((item) => ['completed', 'cancelled'].includes(item.status));

  return (
    <View style={styles.container}>
      <View style={styles.header}><Pressable accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color="#173232" /></Pressable><View style={styles.headerText}><Text style={styles.eyebrow}>{isTour ? 'TOUR OPERATIONS' : 'RENTAL OPERATIONS'}</Text><Text style={styles.title} numberOfLines={1}>{isTour ? tour.schedule?.tour?.title || 'Tour assignment' : rental.booking_number ? `Rental #${rental.booking_number}` : 'Car rental'}</Text></View><View style={[styles.typeIcon, isTour ? styles.tourIcon : styles.rentalIcon]}>{isTour ? <BusFront size={22} color="#7c3aed" /> : <CarFront size={22} color="#c2410c" />}</View></View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.hero}>
          <View style={styles.heroTop}><Text style={styles.heroLabel}>CURRENT STATUS</Text><Text style={styles.heroStatus}>{labelStatus(isTour ? tour.status : rental.status)}</Text></View>
          <View style={styles.detailRow}><CalendarDays size={18} color="#0f766e" /><Text style={styles.detailText}>{isTour ? `${tour.schedule?.departure_date || 'Date pending'}${tour.schedule?.departure_time ? ` at ${tour.schedule.departure_time}` : ''}` : `${rental.start_date || 'Start pending'} – ${rental.end_date || 'Return pending'}`}</Text></View>
          <View style={styles.detailRow}><MapPin size={18} color="#0f766e" /><Text style={styles.detailText}>{isTour ? tour.schedule?.meeting_point || tour.schedule?.tour?.start_location || 'Meeting point pending' : rental.pickup_location || 'Pickup pending'}</Text></View>
          <View style={styles.detailRow}><Navigation size={18} color="#0f766e" /><Text style={styles.detailText}>{isTour ? tour.schedule?.tour?.end_location || 'Route is in the itinerary' : rental.dropoff_location || 'Return point pending'}</Text></View>
        </View>

        {isTour && <View style={styles.section}><Text style={styles.sectionTitle}>Customer bookings</Text><Text style={styles.sectionCopy}>Select a booking to verify its start OTP and manage its journey.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookingStrip}>{bookings.map((item) => <Pressable key={item.id} onPress={() => { setSelectedBooking(item); setPin(''); }} style={[styles.bookingChip, selectedBooking?.id === item.id && styles.bookingChipActive]}><Text style={[styles.bookingChipTitle, selectedBooking?.id === item.id && styles.bookingChipTitleActive]}>{item.booking_number || `Booking ${item.id}`}</Text><Text style={styles.bookingChipMeta}>{labelStatus(item.status)}</Text></Pressable>)}</ScrollView>{bookings.length === 0 && <View style={styles.notice}><Text style={styles.noticeText}>No customer bookings are attached to this schedule yet. You can still review the itinerary and complete the assignment when instructed.</Text></View>}</View>}

        {(customerName || customerPhone) && <View style={styles.section}><Text style={styles.sectionTitle}>{isTour ? 'Selected customer' : 'Customer'}</Text><View style={styles.customerCard}><View style={styles.avatar}><Text style={styles.avatarText}>{customerName?.charAt(0) || 'C'}</Text></View><View style={{ flex: 1 }}><Text style={styles.customerName}>{customerName || 'Customer'}</Text><Text style={styles.customerMeta}>{isTour ? `${(selectedBooking?.number_of_adults || 0) + (selectedBooking?.number_of_children || 0)} travellers · ${money(selectedBooking?.total_price)}` : `${rental.car_category?.name || 'Vehicle'} · ${money(rental.driver_share || rental.total_price)}`}</Text></View>{customerPhone && <Pressable accessibilityLabel="Call customer" onPress={() => Linking.openURL(`tel:${customerPhone}`)} style={styles.call}><Phone size={20} color="#0f766e" /></Pressable>}</View></View>}

        {isTour && (tour.schedule?.tour?.itineraries?.length || 0) > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Itinerary</Text>{tour.schedule?.tour?.itineraries?.map((item, index) => <View key={item.id} style={styles.itinerary}><View style={styles.day}><Text style={styles.dayText}>{item.day_number || index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.itineraryTitle}>{item.title || `Day ${index + 1}`}</Text>{item.description && <Text style={styles.itineraryCopy} numberOfLines={3}>{item.description}</Text>}</View></View>)}</View>}

        {!!((isTour ? selectedBooking?.customer_phone : rental.special_requests)) && <View style={styles.section}><Text style={styles.sectionTitle}>Service notes</Text><Text style={styles.notes}>{isTour ? tour.notes || 'Keep all travellers together and follow the published itinerary.' : rental.special_requests}</Text></View>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable accessibilityLabel="Open navigation" onPress={navigate} style={styles.navButton}><Navigation size={20} color="#0f766e" /></Pressable>
        {operationalStatus === 'confirmed' || operationalStatus === 'driver_assigned' ? <View style={styles.startWrap}><View style={styles.pinWrap}><ShieldCheck size={18} color="#64748b" /><TextInput accessibilityLabel="Four digit start OTP" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} placeholder="Start OTP" placeholderTextColor="#94a3b8" style={styles.pin} /></View><Pressable disabled={pin.length !== 4 || busy} onPress={() => updateStatus('in_progress')} style={[styles.actionButton, (pin.length !== 4 || busy) && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Start</Text>}</Pressable></View> : operationalStatus === 'in_progress' ? <Pressable disabled={busy} onPress={() => Alert.alert(`Complete ${isTour ? 'tour' : 'rental'}?`, 'Confirm the customer journey and handover are finished.', [{ text: 'Not yet', style: 'cancel' }, { text: 'Complete', onPress: () => updateStatus('completed') }])} style={styles.actionButton}>{busy ? <ActivityIndicator color="#fff" /> : <><CheckCircle2 size={20} color="#fff" /><Text style={styles.actionText}>Complete</Text></>}</Pressable> : isTour && tour.status === 'accepted' && (!selectedBooking || allBookingsDone) ? <Pressable disabled={busy} onPress={completeAssignment} style={styles.actionButton}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Close assignment</Text>}</Pressable> : <View style={styles.done}><CheckCircle2 size={19} color="#047857" /><Text style={styles.doneText}>{labelStatus(operationalStatus || (isTour ? tour.status : rental.status))}</Text></View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' }, header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8e6' }, back: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f1f5f4', alignItems: 'center', justifyContent: 'center' }, headerText: { flex: 1 }, eyebrow: { color: '#0f766e', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: '#173232', fontSize: 18, fontWeight: '900', marginTop: 2 }, typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, tourIcon: { backgroundColor: '#ede9fe' }, rentalIcon: { backgroundColor: '#ffedd5' }, content: { padding: 16 },
  hero: { backgroundColor: '#fff', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#dfe8e6' }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }, heroLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, heroStatus: { color: '#047857', backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '900' }, detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 }, detailText: { flex: 1, color: '#334155', fontSize: 14, lineHeight: 20, fontWeight: '600' }, section: { marginTop: 24 }, sectionTitle: { color: '#173232', fontSize: 17, fontWeight: '900' }, sectionCopy: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 4 }, bookingStrip: { gap: 10, paddingVertical: 12 }, bookingChip: { minWidth: 138, padding: 13, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce6e3' }, bookingChipActive: { backgroundColor: '#ccfbf1', borderColor: '#5eead4' }, bookingChipTitle: { color: '#334155', fontSize: 12, fontWeight: '800' }, bookingChipTitleActive: { color: '#0f766e' }, bookingChipMeta: { color: '#64748b', fontSize: 10, marginTop: 5 }, notice: { backgroundColor: '#fff7ed', borderRadius: 14, padding: 14, marginTop: 12 }, noticeText: { color: '#9a3412', lineHeight: 19, fontSize: 12 }, customerCard: { marginTop: 12, padding: 16, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#dff4ef', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#0f766e', fontSize: 19, fontWeight: '900' }, customerName: { color: '#173232', fontSize: 15, fontWeight: '800' }, customerMeta: { color: '#64748b', fontSize: 12, marginTop: 4 }, call: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }, itinerary: { flexDirection: 'row', gap: 12, marginTop: 14, padding: 15, borderRadius: 16, backgroundColor: '#fff' }, day: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }, dayText: { color: '#7c3aed', fontWeight: '900' }, itineraryTitle: { color: '#334155', fontSize: 14, fontWeight: '800' }, itineraryCopy: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 5 }, notes: { marginTop: 10, padding: 16, borderRadius: 16, backgroundColor: '#fff', color: '#475569', lineHeight: 20 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dfe8e6' }, navButton: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, borderColor: '#99d5cb', alignItems: 'center', justifyContent: 'center' }, startWrap: { flex: 1, flexDirection: 'row', gap: 8 }, pinWrap: { flex: 1, height: 54, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 16, backgroundColor: '#f1f5f4' }, pin: { flex: 1, color: '#173232', fontSize: 15, fontWeight: '800' }, actionButton: { flex: 1, height: 54, borderRadius: 16, backgroundColor: '#0f766e', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, actionText: { color: '#fff', fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.45 }, done: { flex: 1, height: 54, borderRadius: 16, backgroundColor: '#ecfdf5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, doneText: { color: '#047857', fontWeight: '900' },
});
