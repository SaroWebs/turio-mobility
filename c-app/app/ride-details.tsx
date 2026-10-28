import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BookingPaymentLink from '../components/BookingPaymentLink';
import { RideSharingControl } from '../components/RideSharingControl';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Car, CheckCircle2, CreditCard, MapPin, Phone, RefreshCw, ShieldCheck, Star } from 'lucide-react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '@/components/MapView';
import api, { apiErrorMessage } from '../src/lib/api';
import { initEcho } from '../src/lib/echo';
import { GOOGLE_MAP_ID } from '../src/constants/maps';
import { CardShadow, FloatingShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

const terminalStatuses = ['completed', 'cancelled', 'rejected'];
const statusRank: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  driver_assigned: 2,
  driver_arriving: 3,
  pickup: 4,
  in_transit: 5,
  completed: 6,
  cancelled: 6,
  rejected: 6,
};
const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const statusCopy: Record<string, { eyebrow: string; title: string }> = {
  pending: { eyebrow: 'REQUEST SENT', title: 'Finding your driver' },
  confirmed: { eyebrow: 'RIDE CONFIRMED', title: 'Your booking is confirmed' },
  driver_assigned: { eyebrow: 'DRIVER ASSIGNED', title: 'Your driver is on the way' },
  pickup: { eyebrow: 'DRIVER ARRIVED', title: 'Meet your driver at pickup' },
  in_transit: { eyebrow: 'RIDE IN PROGRESS', title: 'You are on your way' },
  completed: { eyebrow: 'RIDE COMPLETED', title: 'Thanks for riding with us' },
  cancelled: { eyebrow: 'RIDE CANCELLED', title: 'This ride was cancelled' },
};

export default function RideDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [booking, setBooking] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const requestVersion = useRef(0);

  const fetchRide = useCallback(async (showRefresh = false) => {
    if (!id) return;
    const version = ++requestVersion.current;
    if (showRefresh) setRefreshing(true);
    setError(null);
    try {
      const fresh = Date.now();
      const [rideResponse, trackingResponse] = await Promise.all([
        api.get(`/rides/${id}`, { params: { fresh } }),
        api.get(`/tracking/ride/${id}`, { params: { fresh } }),
      ]);
      if (version !== requestVersion.current) return;

      const rideData = rideResponse.data?.data;
      const trackingData = trackingResponse.data?.data;
      const trackedBooking = trackingData?.booking;
      const freshBooking = statusRank[String(trackedBooking?.status)] > statusRank[String(rideData?.status)]
        ? { ...rideData, ...trackedBooking }
        : rideData;

      setBooking((current: any) => {
        if (statusRank[String(current?.status)] > statusRank[String(freshBooking?.status)]) return current;
        return freshBooking;
      });
      setTracking(trackingData);
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(apiErrorMessage(requestError, 'We could not open this ride.'));
    } finally {
      if (version !== requestVersion.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchRide();
  }, [fetchRide]);

  useEffect(() => {
    if (!id) return;
    let echo: Awaited<ReturnType<typeof initEcho>> | null = null;
    let mounted = true;

    void initEcho().then((client) => {
      if (!mounted) {
        client.disconnect();
        return;
      }
      echo = client;
      client.private(`ride.${id}`).listen('.ride.status.updated', (event: { status?: string }) => {
        if (!event.status) return;
        setBooking((current: any) => {
          if (statusRank[String(current?.status)] > statusRank[String(event.status)]) return current;
          return { ...current, status: event.status };
        });
        void fetchRide();
      });
    }).catch(() => {
      // Polling below remains the reliable fallback when realtime is unavailable.
    });

    return () => {
      mounted = false;
      echo?.leave(`ride.${id}`);
      echo?.disconnect();
    };
  }, [fetchRide, id]);

  useEffect(() => {
    if (!booking || terminalStatuses.includes(String(booking.status).toLowerCase())) return;
    const interval = setInterval(() => void fetchRide(), 4000);
    return () => clearInterval(interval);
  }, [booking, fetchRide]);

  const submitReview = async () => {
    if (!id || rating === 0) {
      Alert.alert('Choose a rating', 'Select between 1 and 5 stars before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/rides/${id}/review`, { rating, comment: comment.trim() || null });
      setReviewed(true);
      Alert.alert('Review submitted', 'Thank you for sharing your feedback.');
      await fetchRide();
    } catch (requestError) {
      Alert.alert('Could not submit review', apiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const routeCoordinates = useMemo(() => {
    if (!booking) return [];
    return [
      { latitude: Number(booking.pickup_lat), longitude: Number(booking.pickup_lng) },
      { latitude: Number(booking.dropoff_lat), longitude: Number(booking.dropoff_lng) },
    ].filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  }, [booking]);

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.brand} /><Text style={[styles.body, { color: colors.textSecondary }]}>Opening your ride…</Text></View>;
  }

  if (error || !booking) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <RefreshCw size={30} color={colors.textMuted} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Ride unavailable</Text>
        <Text style={[styles.errorCopy, { color: colors.textSecondary }]}>{error || 'This ride could not be found.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => void fetchRide()} style={[styles.primaryButton, { backgroundColor: colors.brand }]}><Text style={styles.primaryButtonText}>Try again</Text></Pressable>
      </View>
    );
  }

  const status = String(booking.status || 'pending').toLowerCase();
  const currentStatus = statusCopy[status] || { eyebrow: status.replace(/_/g, ' ').toUpperCase(), title: 'Ride update' };
  const verification = tracking?.start_verification;
  const showPin = verification?.code && !verification?.verified_at && !terminalStatuses.includes(status);
  const hasReview = reviewed || Boolean(booking.reviews?.length);
  const currentLocation = tracking?.current_location;
  const mapCenter = currentLocation
    ? { latitude: Number(currentLocation.latitude), longitude: Number(currentLocation.longitude) }
    : routeCoordinates[0];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={[styles.topTitle, { color: colors.text }]}>Ride {booking.booking_number || `#${booking.id}`}</Text>
          <Text style={[styles.topMeta, { color: colors.textSecondary }]}>{status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchRide(true)} tintColor={colors.brand} colors={[colors.brand]} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <RideSharingControl booking={booking} onUpdated={(ride) => setBooking((current: any) => ({ ...current, ...ride }))} />
        <View style={[styles.hero, { backgroundColor: isDark ? '#18181B' : '#09090B' }, FloatingShadow]}>
          <Text style={[styles.heroEyebrow, { color: '#F59E0B' }]}>{currentStatus.eyebrow}</Text>
          <Text style={[styles.heroTitle, { color: '#FFFFFF' }]}>{currentStatus.title}</Text>
          <Text style={[styles.heroCopy, { color: '#94A3B8' }]}>Real-time updates synced via secure channel.</Text>
        </View>

        {mapCenter && (
          <View style={[styles.mapCard, { borderColor: colors.border }, CardShadow]}>
            <MapView
              provider={PROVIDER_GOOGLE}
              googleMapId={GOOGLE_MAP_ID}
              style={styles.map}
              initialRegion={{ ...mapCenter, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              {routeCoordinates[0] && <Marker coordinate={routeCoordinates[0]} title="Pickup" />}
              {routeCoordinates[1] && <Marker coordinate={routeCoordinates[1]} title="Drop-off" />}
              {currentLocation && (
                <Marker coordinate={{ latitude: Number(currentLocation.latitude), longitude: Number(currentLocation.longitude) }} title="Driver">
                  <View style={[styles.driverMarker, { backgroundColor: '#F59E0B' }]}><Car size={14} color="#09090B" /></View>
                </Marker>
              )}
              {routeCoordinates.length === 2 && <Polyline coordinates={routeCoordinates} strokeColor="#F59E0B" strokeWidth={4} />}
            </MapView>
          </View>
        )}

        {showPin && (
          <View style={[styles.pinCard, { backgroundColor: isDark ? '#451a03' : '#FEF3C7', borderColor: '#F59E0B' }]}>
            <View style={styles.pinHeading}><ShieldCheck size={20} color="#D97706" /><Text style={[styles.pinLabel, { color: '#D97706' }]}>RIDE START PIN</Text></View>
            <Text accessibilityLabel={`Ride start PIN ${String(verification.code).split('').join(' ')}`} style={[styles.pinCode, { color: colors.text }]}>{verification.code}</Text>
            <Text style={[styles.pinHelp, { color: colors.textSecondary }]}>{verification.instructions || 'Share this PIN only after you meet your assigned driver.'}</Text>
          </View>
        )}

        {booking.driver && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
            <View style={[styles.driverAvatar, { backgroundColor: isDark ? '#27272A' : '#09090B' }]}>
              <Text style={[styles.driverInitials, { color: '#FFFFFF' }]}>{booking.driver.name?.slice(0, 2)?.toUpperCase() || 'DR'}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{booking.driver.name}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{[booking.driver.vehicle_color, booking.driver.vehicle_model, booking.driver.vehicle_number].filter(Boolean).join(' · ') || 'Verified driver'}</Text>
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Text key={s} style={{ color: '#F59E0B', fontSize: 10 }}>★</Text>
                ))}
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Call driver" disabled={!booking.driver.phone} onPress={() => booking.driver.phone && Linking.openURL(`tel:${booking.driver.phone}`)} style={[styles.iconButton, { backgroundColor: '#F43F5E' }]}>
              <Phone size={19} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={[styles.routeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.routeRow}><View style={[styles.routeDot, { backgroundColor: colors.brand }]} /><View style={styles.cardCopy}><Text style={[styles.routeLabel, { color: colors.textMuted }]}>PICKUP</Text><Text style={[styles.routeText, { color: colors.text }]}>{booking.pickup_location}</Text></View></View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}><MapPin size={14} color={colors.error} /><View style={styles.cardCopy}><Text style={[styles.routeLabel, { color: colors.textMuted }]}>DROP-OFF</Text><Text style={[styles.routeText, { color: colors.text }]}>{booking.dropoff_location}</Text></View></View>
        </View>

        {status === 'completed' && (
          <>
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeading}><CreditCard size={20} color={colors.brand} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Bill & payment</Text></View>
              <View style={styles.billRow}><Text style={[styles.billLabel, { color: colors.textSecondary }]}>Ride fare</Text><Text style={[styles.billValue, { color: colors.text }]}>{money(booking.total_fare)}</Text></View>
              {Number(booking.discount_amount) > 0 && <View style={styles.billRow}><Text style={[styles.billLabel, { color: colors.textSecondary }]}>Discount</Text><Text style={[styles.billValue, { color: colors.success }]}>−{money(booking.discount_amount)}</Text></View>}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.billRow}><Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text><Text style={[styles.totalValue, { color: colors.text }]}>{money(booking.total_fare)}</Text></View>
              <View style={[styles.paymentStatus, { backgroundColor: booking.payment_status === 'paid' ? colors.brandSoft : colors.accentSoft }]}>
                {booking.payment_status === 'paid' ? <CheckCircle2 size={18} color={colors.success} /> : <RefreshCw size={18} color={colors.warning} />}
                <View style={styles.cardCopy}>
                  <Text style={[styles.paymentTitle, { color: colors.text }]}>{booking.payment_status === 'paid' ? 'Payment complete' : 'Payment pending'}</Text>
                  <Text style={[styles.paymentCopy, { color: colors.textSecondary }]}>
                    {booking.payment_status === 'paid'
                      ? `Paid by ${booking.payment_method || 'selected method'}`
                      : booking.payment_method === 'cash'
                        ? 'Pay the driver in cash. The driver will confirm it here.'
                        : `Complete the ${booking.payment_method || 'selected'} payment with your driver, then refresh.`}
                  </Text>
                </View>
              </View>
              {booking.payment_status !== 'paid' && (
                <Pressable accessibilityRole="button" onPress={() => void fetchRide(true)} style={[styles.secondaryButton, { borderColor: colors.brand }]}>
                  <RefreshCw size={16} color={colors.brand} /><Text style={[styles.secondaryButtonText, { color: colors.brand }]}>Refresh payment status</Text>
                </Pressable>
              )}
              {id && <BookingPaymentLink key={`ride:${id}`} kind="ride" id={id} />}
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeading}><Star size={20} color={colors.accent} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Rate your ride</Text></View>
              {hasReview ? (
                <View style={styles.reviewed}><CheckCircle2 size={25} color={colors.success} /><Text style={[styles.reviewedTitle, { color: colors.text }]}>Thanks for your review</Text><Text style={[styles.cardMeta, { color: colors.textSecondary }]}>Your feedback has been recorded.</Text></View>
              ) : (
                <>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`} onPress={() => setRating(value)} hitSlop={6}>
                        <Star size={34} color={value <= rating ? colors.accent : colors.border} fill={value <= rating ? colors.accent : 'transparent'} />
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    accessibilityLabel="Ride review"
                    multiline
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Tell us what went well or what we can improve"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.reviewInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                  <Pressable accessibilityRole="button" disabled={submitting} onPress={submitReview} style={[styles.primaryButton, { backgroundColor: colors.brand }, submitting && styles.disabled]}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit review</Text>}
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  body: { ...Typography.body },
  errorTitle: { ...Typography.title, marginTop: 5 },
  errorCopy: { ...Typography.body, textAlign: 'center' },
  topBar: { minHeight: 66, borderBottomWidth: 1, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: '900' },
  topMeta: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', marginTop: 2 },
  scrollContent: { padding: Spacing.md, paddingBottom: 42, gap: 13 },
  hero: { borderRadius: Radius.lg, padding: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { color: '#fff', fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 5 },
  heroCopy: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18, marginTop: 7 },
  mapCard: { height: 210, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
  driverMarker: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pinCard: { borderWidth: 1, borderRadius: Radius.lg, padding: 18, alignItems: 'center' },
  pinHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pinLabel: { ...Typography.label, letterSpacing: 1 },
  pinCode: { fontSize: 38, lineHeight: 48, fontWeight: '900', letterSpacing: 10, marginTop: 8, marginLeft: 10 },
  pinHelp: { ...Typography.body, textAlign: 'center', marginTop: 5 },
  card: { minHeight: 78, borderRadius: Radius.md, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  driverAvatar: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  driverInitials: { fontSize: 15, fontWeight: '900' },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  cardMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  routeCard: { borderWidth: 1, borderRadius: Radius.md, padding: 15 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  routeDot: { width: 13, height: 13, borderRadius: 7 },
  routeLine: { width: 1, height: 19, marginLeft: 6, marginVertical: 4 },
  routeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  routeText: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  sectionCard: { borderWidth: 1, borderRadius: Radius.lg, padding: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15 },
  sectionTitle: { ...Typography.heading },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginVertical: 5 },
  billLabel: { fontSize: 13 },
  billValue: { fontSize: 13, fontWeight: '800' },
  divider: { height: 1, marginVertical: 9 },
  totalLabel: { fontSize: 15, fontWeight: '900' },
  totalValue: { fontSize: 18, fontWeight: '900' },
  paymentStatus: { borderRadius: Radius.md, padding: 12, marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  paymentTitle: { fontSize: 13, fontWeight: '900' },
  paymentCopy: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  primaryButton: { minHeight: 50, borderRadius: Radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 13, fontWeight: '900' },
  stars: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 14 },
  reviewInput: { minHeight: 100, borderWidth: 1, borderRadius: Radius.md, padding: 13, textAlignVertical: 'top', fontSize: 13, lineHeight: 19 },
  reviewed: { alignItems: 'center', paddingVertical: 14 },
  reviewedTitle: { fontSize: 15, fontWeight: '900', marginTop: 9 },
  disabled: { opacity: 0.6 },
});
