import JourneyMap from '../components/JourneyMap';
import BookingPaymentLink from '../components/BookingPaymentLink';
import { postBooking } from '../src/lib/booking-attempt';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, CreditCard, ListChecks, RefreshCw, Share2, ShieldCheck } from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

type ServiceKind = 'tour' | 'rental';

export default function ServiceActivityScreen() {
  const { id, kind, title, price } = useLocalSearchParams<{ id: string; kind: ServiceKind; title?: string; price?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [tracking, setTracking] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [serviceRating, setServiceRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);

  const load = useCallback(async (refresh = false) => {
    if (!id || !['tour', 'rental'].includes(String(kind))) return;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const resource = kind === 'tour' ? 'tour-bookings' : 'car-rentals';
      const [response, position] = await Promise.all([api.get(`/${resource}/${id}/next-steps`), api.get(`/tracking/${kind}/${id}`)]);
      setDetails(response.data?.data);
      setTracking(position.data?.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'We could not open this booking.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, kind]);

  useEffect(() => {
    void load();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => listener.remove();
  }, [load]);
  useEffect(() => {
    if (['completed', 'cancelled'].includes(details?.status)) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 5000);
    return () => clearInterval(timer);
  }, [load, details?.status]);
  const act = async (action: string, data: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const resource = kind === 'tour' ? 'tour-bookings' : 'car-rentals';
      if (action.startsWith('mock:')) await postBooking(`/mock-payments/${kind}/${id}`, {scenario: action.slice(5)});
      else await api.post(`/${resource}/${id}/${action}`, data);
      await load();
    } catch (e) { Alert.alert('Action failed', apiErrorMessage(e)); } finally { setBusy(false); }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.brand} /><Text style={[styles.body, { color: colors.textSecondary }]}>Opening booking…</Text></View>;
  }

  if (!details) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <RefreshCw size={30} color={colors.textMuted} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Booking unavailable</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.primaryButton, { backgroundColor: colors.brand }]}><Text style={styles.primaryText}>Try again</Text></Pressable>
      </View>
    );
  }

  const status = String(details.status || 'pending').replace(/_/g, ' ');
  const verification = details.start_verification;
  const showPin = verification?.code && !verification?.verified && !['completed', 'cancelled'].includes(String(details.status));
  const instructions = Array.isArray(details.instructions) ? details.instructions : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface }]}><ArrowLeft size={20} color={colors.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{title || (kind === 'tour' ? 'Tour booking' : 'Car rental')}</Text>
          <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>{details.booking_number || `#${id}`}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} colors={[colors.brand]} />}
        contentContainerStyle={styles.content}
      >
        {!!error && <Text style={{color: colors.warning}}>Showing last known trip. {error}</Text>}
        <View style={[styles.hero, { backgroundColor: colors.brandStrong }, CardShadow]}>
          <Text style={styles.heroEyebrow}>{kind === 'tour' ? 'TOUR BOOKING' : 'CAR RENTAL'}</Text>
          <Text style={styles.heroTitle}>{status}</Text>
          <Text style={styles.heroCopy}>This booking stays available from Activity so you can resume it at any time.</Text>
        </View>

        {showPin && (
          <View style={[styles.pinCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <View style={styles.row}><ShieldCheck size={20} color={colors.warning} /><Text style={[styles.pinLabel, { color: colors.warning }]}>START VERIFICATION PIN</Text></View>
            <Text accessibilityLabel={`Start PIN ${String(verification.code).split('').join(' ')}`} style={[styles.pin, { color: colors.text }]}>{verification.code}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>Share this code only at tour check-in or vehicle handover.</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}><CreditCard size={20} color={colors.brand} /><Text style={[styles.cardTitle, { color: colors.text }]}>Booking & payment</Text></View>
          <InfoRow label="Amount" value={details.total ? `?${Number(details.total).toLocaleString('en-IN')}` : price || 'See receipt'} />
          <InfoRow label="Payment" value={String(details.payment_status || 'pending').replace(/_/g, ' ')} />
          <InfoRow label="Status" value={status} />
          <BookingPaymentLink key={`${kind}:${id}`} kind={kind} id={id} />
        </View>

        {kind === 'tour' && ['pending', 'confirmed'].includes(String(details.status)) && (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/tour-share', params: { id, title: title || details.tour_title || 'Tour' } })} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Share2 size={20} color={colors.brand} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>Share tour</Text><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Let family or friends view your tour plan</Text></View>
            <ArrowLeft size={16} color={colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}><ListChecks size={20} color={colors.brand} /><Text style={[styles.cardTitle, { color: colors.text }]}>What happens next</Text></View>
          {instructions.map((instruction: string, index: number) => (
            <View key={`${instruction}-${index}`} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.brandSoft }]}><Text style={[styles.stepNumberText, { color: colors.brand }]}>{index + 1}</Text></View>
              <Text style={[styles.stepText, { color: colors.textSecondary }]}>{instruction}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}><JourneyMap tracking={tracking} /></View>
        {kind === 'tour' && tracking?.booking?.tour?.itineraries?.map((stop: any, index: number) => <View key={stop.id} style={[styles.card, {backgroundColor: colors.surface, borderColor: index === tracking.booking.current_stop_index ? colors.brand : colors.border}]}><Text style={{color: colors.brand}}>Day {stop.day_number} {index === tracking.booking.current_stop_index ? '? Current stop' : ''}</Text><Text style={{color: colors.text, fontWeight:'700'}}>{stop.title}</Text><Text style={{color: colors.textSecondary}}>{stop.details || stop.description}</Text></View>)}
        {(tracking?.booking?.driver_assignments || []).filter((a: any) => a.status === 'accepted').map((a: any) => <Pressable key={a.id} disabled={!a.driver?.phone} onPress={() => Linking.openURL(`tel:${a.driver.phone}`)} style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}><Text style={{color: colors.text}}>{a.driver?.name} ? {a.role}</Text><Text style={{color: colors.brand}}>Call operator</Text></Pressable>)}
        {tracking?.rental?.driver?.phone && <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(`tel:${tracking.rental.driver.phone}`)}><Text style={{color: colors.brand}}>Call driver: {tracking.rental.driver.name}</Text></Pressable>}
        {details.actions?.can_check_in && <Pressable disabled={busy} style={[styles.primaryButton, {backgroundColor: colors.brand}]} onPress={() => act('check-in')}><Text style={styles.primaryText}>I am at the meeting point</Text></Pressable>}
        {details.actions?.can_cancel && <Pressable disabled={busy} style={styles.primaryButton} onPress={() => Alert.alert('Cancel booking?', 'The booking cancellation policy applies.', [{text:'Keep booking',style:'cancel'},{text:'Cancel booking',style:'destructive',onPress:()=>act('cancel',{reason:'Customer requested cancellation'})}])}><Text style={{color:colors.error}}>Cancel booking</Text></Pressable>}
        {details.mock_payments_enabled && details.payment_status !== 'paid' && !['completed','cancelled'].includes(details.status) && <View style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}><Text style={{color:colors.text}}>Test payment ? no real charge</Text>{['success','failed','pending','timeout'].map(scenario=><Pressable disabled={busy} key={scenario} style={styles.primaryButton} onPress={()=>act(`mock:${scenario}`)}><Text style={{color:colors.brand}}>Simulate {scenario}</Text></Pressable>)}</View>}
        {details.actions?.can_review && <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[{ label: kind === 'tour' ? 'Tour' : 'Rental', value: serviceRating, set: setServiceRating }, { label: 'Driver', value: driverRating, set: setDriverRating }].map(field => <View key={field.label}>
            <Text style={{ color: colors.text }}>{field.label} rating</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{[1, 2, 3, 4, 5].map(rating => <Pressable key={rating} accessibilityRole="button" accessibilityLabel={`${field.label}: ${rating} stars`} accessibilityState={{ selected: field.value === rating }} disabled={busy} style={{ minHeight: 48, minWidth: 44, justifyContent: 'center' }} onPress={() => field.set(rating)}><Text style={{ color: colors.brand }}>{rating} {field.value === rating ? '★' : '☆'}</Text></Pressable>)}</View>
          </View>)}
          <Pressable accessibilityRole="button" disabled={busy || !serviceRating || !driverRating} style={[styles.primaryButton, { backgroundColor: colors.brand, opacity: busy || !serviceRating || !driverRating ? 0.5 : 1 }]} onPress={() => void act('review', { [kind === 'tour' ? 'tour_rating' : 'rental_rating']: serviceRating, driver_rating: driverRating })}><Text style={styles.primaryText}>Submit review</Text></Pressable>
        </View>}
        {details.actions?.can_review && (
          <View style={[styles.completeCard, { backgroundColor: colors.brandSoft }]}>
            <CheckCircle2 size={24} color={colors.success} />
            <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.text }]}>Service completed</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Your receipt and review options remain linked to this booking.</Text></View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={styles.infoRow}><Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  header: { minHeight: 64, borderBottomWidth: 1, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerMeta: { fontSize: 11, marginTop: 2 },
  content: { padding: Spacing.md, paddingBottom: 48, gap: 14 },
  hero: { borderRadius: Radius.lg, padding: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,.72)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textTransform: 'capitalize', marginTop: 8 },
  heroCopy: { color: 'rgba(255,255,255,.8)', fontSize: 13, lineHeight: 19, marginTop: 7 },
  pinCard: { borderWidth: 1, borderRadius: Radius.lg, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pinLabel: { fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  pin: { fontSize: 34, fontWeight: '900', letterSpacing: 8, marginVertical: 12 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: 17, gap: 12 },
  cardTitle: { ...Typography.heading },
  body: { ...Typography.body, textAlign: 'center' },
  infoRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 13, fontWeight: '800', textTransform: 'capitalize', textAlign: 'right', flex: 1 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  completeCard: { borderRadius: Radius.lg, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12 },
  errorTitle: { ...Typography.title, textAlign: 'center' },
  primaryButton: { minHeight: 48, minWidth: 140, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
