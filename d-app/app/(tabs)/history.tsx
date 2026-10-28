import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { History } from 'lucide-react-native';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import api from '../../src/lib/api';
import { labelStatus, unwrapPage } from '../../src/types/services';

import TripHistoryCard from '../../components/TripHistoryCard';
import { useTheme } from '../../src/constants/theme';

type Kind = 'ride' | 'tour' | 'rental';
type Filter = 'all' | Kind;
type RecordItem = {
  id: string;
  kind: Kind;
  title: string;
  subtitle: string;
  status: string;
  date?: string;
  amount?: number | string;
  payment_method?: string;
  payment_status?: string;
};

const loadHistoryPage = async (path: string): Promise<{ data: any; requestError: any | null }> => {
  try {
    const response = await api.get(path);
    return { data: response.data, requestError: null };
  } catch (requestError) {
    return { data: [], requestError };
  }
};

export default function HistoryScreen() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [rideResponse, tourResponse, rentalResponse] = await Promise.all([
        loadHistoryPage('/history'), loadHistoryPage('/tour-assignments'), loadHistoryPage('/rental-assignments'),
      ]);
      const rides: RecordItem[] = unwrapPage<any>(rideResponse.data).map((item) => ({
        id: `ride-${item.id}`,
        kind: 'ride',
        title: item.pickup_location || `Ride #${item.booking_number}`,
        subtitle: item.dropoff_location || item.customer?.name || 'Customer ride',
        status: item.status,
        date: item.scheduled_at || item.updated_at,
        amount: item.driver_share ?? item.total_fare,
        payment_method: item.payment_method || 'cash',
        payment_status: item.payment_status || 'completed'
      }));
      const tours: RecordItem[] = unwrapPage<any>(tourResponse.data).filter((item) => ['completed', 'declined'].includes(item.status)).map((item) => ({ id: `tour-${item.id}`, kind: 'tour', title: item.schedule?.tour?.title || 'Tour assignment', subtitle: `${labelStatus(item.role || 'transport')} · ${item.bookings?.length || 0} bookings`, status: item.status, date: item.schedule?.departure_date || item.updated_at, amount: item.fee }));
      const rentals: RecordItem[] = unwrapPage<any>(rentalResponse.data).filter((item) => ['completed', 'cancelled'].includes(item.status)).map((item) => ({ id: `rental-${item.id}`, kind: 'rental', title: item.pickup_location || `Rental #${item.booking_number}`, subtitle: item.dropoff_location || item.car_category?.name || 'Car rental', status: item.status, date: item.end_date || item.updated_at, amount: item.driver_share || item.total_price }));
      const failures = [rideResponse, tourResponse, rentalResponse].filter((response) => response.requestError);
      if (failures.length === 3) throw failures[0].requestError;
      if (failures.length > 0) setError('Some service records could not be refreshed. Pull down to try again.');
      setRecords([...rides, ...tours, ...rentals].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to load service history. Pull down to try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));
  const visible = useMemo(() => filter === 'all' ? records : records.filter((item) => item.kind === filter), [filter, records]);
  const filters: Filter[] = ['all', 'ride', 'tour', 'rental'];

  return <View style={[styles.container, { backgroundColor: c.background }]}>
    <View style={styles.header}><Text style={[styles.eyebrow, { color: c.brand }]}>YOUR ACTIVITY</Text><Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Trips</Text><Text style={[styles.copy, { color: c.textSecondary }]}>Rides, tours and rentals — all in one place.</Text></View>
    <View style={[styles.filters, { backgroundColor: c.surfaceMuted }]}>{filters.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === item }} key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && { backgroundColor: c.surface }]}><Text style={[styles.filterText, { color: filter === item ? c.brand : c.textSecondary }]}>{item === 'all' ? 'All' : item === 'ride' ? 'Rides' : labelStatus(item)}</Text></Pressable>)}</View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color={c.brand} /></View> : <FlatList data={visible} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl tintColor={c.brand} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} ListHeaderComponent={error ? <Text style={[styles.error, { color: c.error, backgroundColor: c.surface }]}>{error}</Text> : null} ListEmptyComponent={<View style={styles.empty}><History size={36} color={c.brand} /><Text style={[styles.emptyTitle, { color: c.text }]}>No trips here yet</Text><Text style={[styles.emptyCopy, { color: c.textSecondary }]}>Your completed and past work will appear here.</Text></View>} renderItem={({ item }) => {
      const resourceId = item.id.slice(item.kind.length + 1);
      return <TripHistoryCard item={item} onPress={() => router.push(`/history/${item.kind}/${resourceId}` as Href)} />;
    }} />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { padding: 20, paddingTop: 28, width: '100%', maxWidth: 680, alignSelf: 'center' }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { fontSize: 28, fontWeight: '800', marginTop: 8 }, copy: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  filters: { marginHorizontal: 20, padding: 4, borderRadius: 16, flexDirection: 'row' }, filter: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, filterText: { fontSize: 13, fontWeight: '700' },
  list: { padding: 20, paddingBottom: 32, width: '100%', maxWidth: 680, alignSelf: 'center', flexGrow: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64 }, emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 16 }, emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }, error: { padding: 16, borderRadius: 16, marginBottom: 14, lineHeight: 21 },
});
