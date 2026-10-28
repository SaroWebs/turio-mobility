import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BriefcaseBusiness, BusFront, CarFront, ChevronRight, Clock3, MapPin, Route } from 'lucide-react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { canUseDriverServices } from '../../src/lib/driver-access';
import api from '../../src/lib/api';
import { labelStatus, money, RentalTask, RideTask, TourAssignmentTask, unwrapPage } from '../../src/types/services';

type Tab = 'ride' | 'tour' | 'rental';

const tabs: { key: Tab; label: string }[] = [
  { key: 'ride', label: 'Bookings' },
  { key: 'tour', label: 'Tours' },
  { key: 'rental', label: 'Car rentals' },
];

export default function WorkScreen() {
  const servicesAvailable = useAuthStore((state) => canUseDriverServices(state.user));
  return servicesAvailable ? <ApprovedWorkScreen /> : <Redirect href="/(tabs)" />;
}

function ApprovedWorkScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ride');
  const [rides, setRides] = useState<RideTask[]>([]);
  const [tours, setTours] = useState<TourAssignmentTask[]>([]);
  const [rentals, setRentals] = useState<RentalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [rideRes, tourRes, rentalRes] = await Promise.all([
        api.get('/pending-rides'), api.get('/tour-assignments'), api.get('/rental-assignments'),
      ]);
      setRides(rideRes.data?.rides || []);
      setTours(unwrapPage<TourAssignmentTask>(tourRes.data));
      setRentals(unwrapPage<RentalTask>(rentalRes.data));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unable to load assignments. Pull to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const items = useMemo(() => tab === 'ride' ? rides : tab === 'tour' ? tours : rentals, [tab, rides, tours, rentals]);

  const mutate = async (key: string, endpoint: string, success: string) => {
    setBusy(key);
    try {
      await api.post(endpoint);
      Alert.alert('Done', success);
      await load();
    } catch (e: any) {
      Alert.alert('Could not update', e.response?.data?.message || 'Please try again.');
    } finally { setBusy(null); }
  };

  const openTask = (kind: Tab, item: RideTask | TourAssignmentTask | RentalTask) => {
    if (kind === 'ride') {
      router.push({ pathname: '/active-ride', params: { id: item.id } });
      return;
    }
    router.push({ pathname: '/service-task', params: { kind, payload: JSON.stringify(item) } } as any);
  };

  const renderItem = ({ item }: { item: any }) => {
    const status = item.status || 'pending';
    const isRide = tab === 'ride';
    const isTour = tab === 'tour';
    const title = isRide ? (item.customer_name || 'Ride request') : isTour ? (item.schedule?.tour?.title || 'Tour assignment') : (item.customer?.name || item.customer_name || 'Car rental');
    const origin = isTour ? (item.schedule?.meeting_point || item.schedule?.tour?.start_location || 'Meeting point pending') : (item.pickup_location || 'Pickup pending');
    const destination = isTour ? (item.schedule?.tour?.end_location || `${item.bookings?.length || 0} customer bookings`) : (item.dropoff_location || 'Return point pending');
    const canRespond = isRide || status === 'assigned' || (tab === 'rental' && status === 'driver_assigned');
    const Icon = isRide ? Route : isTour ? BusFront : CarFront;

    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${tab} ${title}`} onPress={() => openTask(tab, item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, isTour ? styles.tourIcon : tab === 'rental' ? styles.rentalIcon : styles.rideIcon]}><Icon size={22} color={isTour ? '#7c3aed' : tab === 'rental' ? '#c2410c' : '#0369a1'} /></View>
          <View style={styles.titleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.reference}>{item.booking_number ? `#${item.booking_number}` : isTour ? `${labelStatus(item.role || 'transport')} role` : 'New request'}</Text>
          </View>
          <View style={styles.status}><Text style={styles.statusText}>{labelStatus(status)}</Text></View>
        </View>
        <View style={styles.routeBlock}>
          <View style={styles.routeRow}><MapPin size={15} color="#0891b2" /><Text style={styles.routeText} numberOfLines={1}>{origin}</Text></View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}><MapPin size={15} color="#e11d48" /><Text style={styles.routeText} numberOfLines={1}>{destination}</Text></View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.meta}><Clock3 size={14} color="#64748b" /><Text style={styles.metaText}>{isTour ? (item.schedule?.departure_date || 'Date pending') : (item.start_date || item.scheduled_at ? new Date(item.start_date || item.scheduled_at).toLocaleDateString() : 'Available now')}</Text></View>
          <Text style={styles.amount}>{money(isTour ? item.fee : item.driver_share || item.total_fare || item.total_price)}</Text>
        </View>
        {canRespond ? (
          <View style={styles.actions}>
            <Pressable disabled={!!busy} onPress={() => mutate(`${tab}-${item.id}-no`, isRide ? `/rides/${item.id}/decline` : isTour ? `/tour-assignments/${item.id}/decline` : `/rentals/${item.id}/decline`, `${labelStatus(tab)} declined.`)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Decline</Text></Pressable>
            <Pressable disabled={!!busy} onPress={async () => {
              if (isRide) {
                setBusy(`${tab}-${item.id}-yes`);
                try { const res = await api.post(`/rides/${item.id}/accept`); router.push({ pathname: '/active-ride', params: { id: res.data.ride.id } }); } catch (e: any) { Alert.alert('Could not accept', e.response?.data?.message || 'Please try again.'); } finally { setBusy(null); }
              } else {
                await mutate(`${tab}-${item.id}-yes`, isTour ? `/tour-assignments/${item.id}/accept` : `/rentals/${item.id}/accept`, `${labelStatus(tab)} accepted.`);
              }
            }} style={styles.primaryButton}>{busy?.startsWith(`${tab}-${item.id}`) ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Accept</Text>}</Pressable>
          </View>
        ) : (
          <View style={styles.openRow}><Text style={styles.openText}>View details & controls</Text><ChevronRight size={18} color="#0f766e" /></View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>DRIVER OPERATIONS</Text><Text style={styles.heading}>Your work</Text></View><BriefcaseBusiness color="#0f766e" size={28} /></View>
      <View style={styles.tabs}>{tabs.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.activeTab]}><Text style={[styles.tabText, tab === item.key && styles.activeTabText]}>{item.label}</Text><View style={[styles.count, tab === item.key && styles.activeCount]}><Text style={[styles.countText, tab === item.key && styles.activeCountText]}>{item.key === 'ride' ? rides.length : item.key === 'tour' ? tours.length : rentals.length}</Text></View></Pressable>)}</View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#0f766e" /><Text style={styles.loadingText}>Loading assignments…</Text></View> : <FlatList data={items} keyExtractor={(item) => `${tab}-${item.id}`} renderItem={renderItem} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null} ListEmptyComponent={<View style={styles.empty}><BriefcaseBusiness size={32} color="#94a3b8" /><Text style={styles.emptyTitle}>No {tabs.find((item) => item.key === tab)?.label.toLowerCase()}</Text><Text style={styles.emptyCopy}>New and assigned work will appear here automatically.</Text></View>} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' }, header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: '#0f766e', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, heading: { color: '#102a2a', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 2 },
  tabs: { marginHorizontal: 16, padding: 4, flexDirection: 'row', backgroundColor: '#e6eeec', borderRadius: 16 }, tab: { flex: 1, minHeight: 48, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, activeTab: { backgroundColor: '#fff' }, tabText: { fontSize: 12, fontWeight: '700', color: '#64748b' }, activeTabText: { color: '#0f766e' }, count: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }, activeCount: { backgroundColor: '#ccfbf1' }, countText: { color: '#475569', fontSize: 10, fontWeight: '900' }, activeCountText: { color: '#0f766e' },
  list: { padding: 16, paddingBottom: 120 }, card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#dfe8e6' }, pressed: { opacity: 0.82 }, cardTop: { flexDirection: 'row', alignItems: 'center' }, iconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, rideIcon: { backgroundColor: '#e0f2fe' }, tourIcon: { backgroundColor: '#ede9fe' }, rentalIcon: { backgroundColor: '#ffedd5' }, titleBlock: { flex: 1, marginLeft: 12 }, cardTitle: { color: '#173232', fontSize: 16, fontWeight: '800' }, reference: { color: '#64748b', fontSize: 12, marginTop: 3 }, status: { backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: '#047857', fontSize: 10, fontWeight: '900' },
  routeBlock: { marginTop: 18 }, routeRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 10 }, routeText: { flex: 1, color: '#334155', fontSize: 13, fontWeight: '600' }, routeLine: { height: 14, width: 1, marginLeft: 7, backgroundColor: '#dbe4e2' }, metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#edf2f1' }, meta: { flexDirection: 'row', gap: 6, alignItems: 'center' }, metaText: { color: '#64748b', fontSize: 12 }, amount: { color: '#0f766e', fontSize: 17, fontWeight: '900' }, actions: { flexDirection: 'row', gap: 10, marginTop: 16 }, secondaryButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#475569', fontWeight: '800' }, primaryButton: { flex: 1.4, minHeight: 48, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '800' }, openRow: { minHeight: 46, marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }, openText: { color: '#0f766e', fontWeight: '800', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loadingText: { color: '#64748b', marginTop: 10 }, empty: { alignItems: 'center', padding: 52, marginTop: 28 }, emptyTitle: { color: '#334155', fontSize: 17, fontWeight: '800', marginTop: 12 }, emptyCopy: { color: '#94a3b8', textAlign: 'center', marginTop: 6, lineHeight: 20 }, error: { backgroundColor: '#fff1f2', color: '#be123c', padding: 12, borderRadius: 12, marginBottom: 12 },
});
