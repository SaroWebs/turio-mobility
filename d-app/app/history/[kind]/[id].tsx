import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, BusFront, CalendarDays, CarFront, CircleUserRound, MapPin, ReceiptIndianRupee, Route } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { apiErrorMessage } from '../../../src/lib/api';
import { labelStatus, money } from '../../../src/types/services';

type Kind = 'ride' | 'tour' | 'rental';

export default function ServiceHistoryDetailScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: Kind; id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!kind || !id) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/history/${kind}/${id}`);
      setRecord(response.data?.data || null);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to load this service record.'));
    } finally {
      setLoading(false);
    }
  }, [id, kind]);

  useEffect(() => {
    let ignore = false;
    const fetchRecord = async () => {
      try {
        const response = await api.get(`/history/${kind}/${id}`);
        if (!ignore) setRecord(response.data?.data || null);
      } catch (requestError) {
        if (!ignore) setError(apiErrorMessage(requestError, 'Unable to load this service record.'));
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    if (kind && id) {
      void fetchRecord();
    }
    return () => { ignore = true; };
  }, [id, kind]);

  const details = useMemo(() => {
    if (!record) return [];
    if (kind === 'tour') return [
      { icon: CalendarDays, label: 'Departure', value: record.schedule?.departure_date },
      { icon: MapPin, label: 'Meeting point', value: record.schedule?.meeting_point || record.schedule?.tour?.start_location },
      { icon: CircleUserRound, label: 'Bookings served', value: String(record.bookings?.length || 0) },
      { icon: ReceiptIndianRupee, label: 'Driver fee', value: money(record.fee) },
    ];
    if (kind === 'rental') return [
      { icon: CalendarDays, label: 'Service dates', value: [record.start_date, record.end_date].filter(Boolean).join(' to ') },
      { icon: MapPin, label: 'Pickup', value: record.pickup_location },
      { icon: Route, label: 'Drop-off', value: record.dropoff_location },
      { icon: ReceiptIndianRupee, label: 'Earnings', value: money(record.driver_share || record.total_price) },
    ];
    return [
      { icon: CalendarDays, label: 'Ride date', value: record.scheduled_at ? new Date(record.scheduled_at).toLocaleString() : null },
      { icon: MapPin, label: 'Pickup', value: record.pickup_location },
      { icon: Route, label: 'Drop-off', value: record.dropoff_location },
      { icon: ReceiptIndianRupee, label: 'Fare', value: money(record.driver_share || record.total_fare) },
    ];
  }, [kind, record]);

  const title = kind === 'tour'
    ? record?.schedule?.tour?.title || 'Tour assignment'
    : kind === 'rental'
      ? record?.booking_number ? `Rental #${record.booking_number}` : 'Rental service'
      : record?.booking_number ? `Ride #${record.booking_number}` : 'Ride service';
  const TypeIcon = kind === 'tour' ? BusFront : kind === 'rental' ? CarFront : Route;
  const accent = kind === 'tour' ? '#7c3aed' : kind === 'rental' ? '#c2410c' : '#0369a1';

  return <View style={styles.container}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back to service history" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><ArrowLeft size={22} color="#173232" /></Pressable>
      <View style={styles.headerText}><Text style={styles.eyebrow}>SERVICE RECORD</Text><Text style={styles.title} numberOfLines={1}>{title}</Text></View>
      <View style={[styles.typeIcon, { backgroundColor: `${accent}15` }]}><TypeIcon size={22} color={accent} /></View>
    </View>

    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#0f766e" /></View> : error ? <View style={styles.center}><Text style={styles.errorTitle}>Record unavailable</Text><Text style={styles.errorCopy}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.hero}><Text style={styles.heroLabel}>STATUS</Text><Text style={styles.status}>{labelStatus(record?.status)}</Text><Text style={styles.reference}>Reference #{record?.booking_number || record?.id}</Text></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Service details</Text>{details.map(({ icon: Icon, label, value }) => <View key={label} style={styles.detail}><View style={styles.detailIcon}><Icon size={19} color="#0f766e" /></View><View style={styles.detailBody}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Not recorded'}</Text></View></View>)}</View>

      {/* Fare & Payment Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fare & Deductions</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Customer Total Fare</Text>
            <Text style={styles.breakdownValue}>{money(record?.total_fare || record?.amount || 0)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Payment Method</Text>
            <View style={[styles.methodBadge, record?.payment_method === 'cash' ? styles.methodCash : styles.methodOnline]}>
              <Text style={[styles.methodBadgeText, record?.payment_method === 'cash' ? styles.methodCashText : styles.methodOnlineText]}>
                {record?.payment_method ? record.payment_method.toUpperCase() : 'CASH'}
              </Text>
            </View>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Payment Status</Text>
            <View style={[styles.statusBadge, record?.payment_status === 'completed' || record?.payment_status === 'paid' ? styles.statusPaid : styles.statusPending]}>
              <Text style={[styles.statusBadgeText, record?.payment_status === 'completed' || record?.payment_status === 'paid' ? styles.statusPaidText : styles.statusPendingText]}>
                {labelStatus(record?.payment_status || 'paid')}
              </Text>
            </View>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownRow}>
            <View>
              <Text style={styles.breakdownLabel}>System Charge (Deduction)</Text>
              <Text style={styles.breakdownHint}>
                {record?.payment_method === 'cash' ? 'Deducted from driver wallet' : 'Deducted from online payment'}
              </Text>
            </View>
            <Text style={styles.breakdownDeduction}>
              - {money(record?.commission_amount || (record?.total_fare ? (Number(record.total_fare) * 0.025) : 0))}
            </Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownTotalRow}>
            <View>
              <Text style={styles.breakdownTotalLabel}>Net Driver Income</Text>
              <Text style={styles.breakdownHint}>
                {record?.payment_method === 'cash' ? 'Collected in full from customer' : 'Credited to driver wallet'}
              </Text>
            </View>
            <Text style={styles.breakdownTotalValue}>
              {money(record?.driver_share || (record?.total_fare ? (Number(record.total_fare) * 0.975) : (record?.amount || 0)))}
            </Text>
          </View>
        </View>
      </View>

      {(record?.customer?.name || record?.customer_name) && <View style={styles.section}><Text style={styles.sectionTitle}>Customer</Text><View style={styles.customer}><View style={styles.avatar}><Text style={styles.avatarText}>{(record.customer?.name || record.customer_name).charAt(0)}</Text></View><View><Text style={styles.customerName}>{record.customer?.name || record.customer_name}</Text><Text style={styles.customerMeta}>{record.customer?.phone || record.customer_phone || 'Phone not recorded'}</Text></View></View></View>}
      {(record?.driver_notes || record?.notes || record?.special_requests) && <View style={styles.section}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.notes}>{record.driver_notes || record.notes || record.special_requests}</Text></View>}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' }, header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8e6' }, back: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f1f5f4', alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.68 }, headerText: { flex: 1 }, eyebrow: { color: '#0f766e', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: '#173232', fontSize: 18, fontWeight: '900', marginTop: 2 }, typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' }, content: { padding: 16 }, hero: { borderRadius: 22, padding: 20, backgroundColor: '#0f766e' }, heroLabel: { color: '#bce7df', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, status: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 5 }, reference: { color: '#d7f4ee', fontSize: 12, marginTop: 9 }, section: { marginTop: 24 }, sectionTitle: { color: '#173232', fontSize: 17, fontWeight: '900', marginBottom: 10 }, detail: { minHeight: 72, padding: 14, marginBottom: 10, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e6', flexDirection: 'row', alignItems: 'center' }, detailIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#e9f6f3', alignItems: 'center', justifyContent: 'center' }, detailBody: { flex: 1, marginLeft: 12 }, detailLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' }, detailValue: { color: '#173232', fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 3 }, customer: { padding: 16, borderRadius: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#dff4ef', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#0f766e', fontSize: 19, fontWeight: '900' }, customerName: { color: '#173232', fontSize: 15, fontWeight: '800' }, customerMeta: { color: '#64748b', fontSize: 12, marginTop: 4 }, notes: { padding: 16, borderRadius: 16, backgroundColor: '#fff', color: '#475569', fontSize: 14, lineHeight: 21 }, errorTitle: { color: '#173232', fontSize: 20, fontWeight: '900' }, errorCopy: { color: '#64748b', textAlign: 'center', lineHeight: 20, marginTop: 8 }, retry: { minWidth: 120, minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', marginTop: 20 }, retryText: { color: '#fff', fontWeight: '900' },
  breakdownCard: { padding: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe8e6' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  breakdownLabel: { color: '#475569', fontSize: 14, fontWeight: '600' },
  breakdownValue: { color: '#173232', fontSize: 15, fontWeight: '700' },
  breakdownHint: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  breakdownDeduction: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
  breakdownDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  breakdownTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  breakdownTotalLabel: { color: '#0f766e', fontSize: 16, fontWeight: '800' },
  breakdownTotalValue: { color: '#0f766e', fontSize: 20, fontWeight: '900' },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  methodCash: { backgroundColor: '#fef3c7' },
  methodOnline: { backgroundColor: '#e0f2fe' },
  methodBadgeText: { fontSize: 11, fontWeight: '800' },
  methodCashText: { color: '#92400e' },
  methodOnlineText: { color: '#0284c7' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPaid: { backgroundColor: '#dcfce7' },
  statusPending: { backgroundColor: '#fee2e2' },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  statusPaidText: { color: '#166534' },
  statusPendingText: { color: '#b91c1c' },
});
