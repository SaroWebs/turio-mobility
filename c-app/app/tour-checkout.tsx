import { postBooking } from '../src/lib/booking-attempt';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, CreditCard, CheckCircle, Compass, Users, ShieldCheck } from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import BookingPaymentLink from '../components/BookingPaymentLink';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

interface Schedule {
  id: number;
  departure_date: string;
  available_seats: number;
  price: number;
  child_price: number;
}

export default function TourCheckoutScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { tourId, tourTitle, price } = useLocalSearchParams();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  
  const [selectedSchedule, setSelectedSchedule] = useState<number | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'upi'>('cash');
  const [upfrontChoice, setUpfrontChoice] = useState<'minimum' | 'custom' | 'full'>('minimum');
  const [upfrontAmount, setUpfrontAmount] = useState('');
  const [depositRequired, setDepositRequired] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    fetchSchedules();
    fetchWalletBalance();
    // These initial requests only depend on immutable route parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get('/wallet');
      setWalletBalance(parseFloat(response.data.data.balance));
    } catch (error) {
      console.error('Wallet fetch error', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const details = await api.get(`/public/tours/${tourId}`);
      setCancellationPolicy(details.data?.data?.cancellation_policy || 'Contact support for cancellation terms before booking.');
      const response = await api.get(`/tour-schedules/${tourId}`);
      setError('');
      setSchedules(response.data.data);
      if (response.data.data.length > 0) {
        setSelectedSchedule(response.data.data[0].id);
      }
    } catch (error) {
      console.error('Schedules fetch error', error);
      setSchedules([]);
      setSelectedSchedule(null);
      setError('Departures could not be loaded. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const payload = useMemo(() => ({tour_id: Number(tourId), tour_schedule_id: selectedSchedule, number_of_adults: adults, number_of_children: children, payment_method: paymentMethod, upfront_choice: upfrontChoice,
    ...(upfrontChoice === 'custom' ? { upfront_amount_minor: /^\d+(\.\d{1,2})?$/.test(upfrontAmount) ? Math.round(Number(upfrontAmount) * 100) : null } : {})}), [tourId, selectedSchedule, adults, children, paymentMethod, upfrontChoice, upfrontAmount]);
  useEffect(() => {
    let active = true;
    setQuote(null);
    if (!selectedSchedule) return;
    const timer = setTimeout(() => { void api.post('/tours/quote', payload).then(r => { if (active) { setQuote(r.data.data); setDepositRequired(Boolean(r.data.data.payment_plan)); if (r.data.data.payment_plan) setPaymentMethod('cash'); setQuoteError(''); } }).catch(e => { if (active) setQuoteError(apiErrorMessage(e, 'Could not calculate price.')); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [payload, selectedSchedule]);

  const handleBook = async () => {
    if (!quote || booking) return;
    setBooking(true);
    try {
      const response = await postBooking('/tours/book', { ...payload, quote_token: quote.quote_token });
      if (response.data.success) {
        setCreated(response.data.data);
      }
    } catch (error: any) {
      Alert.alert('Booking Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (created) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={52} color="#10B981" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>{created.status === 'confirmed' ? 'Booking Confirmed' : 'Reservation Received'}</Text>
        <Text style={[styles.successSub, { color: colors.textSecondary }]}>
          {tourTitle}: {created.status}. Payment: {created.payment_status}. Your trip details show the next step.
        </Text>
        <BookingPaymentLink kind="tour" id={String(created.id)} />
        <TouchableOpacity 
          style={[styles.doneBtn, { backgroundColor: colors.brand }]}
          onPress={() => router.replace({ pathname: '/service-activity', params: { id: created.id, kind: 'tour', title: String(tourTitle) } })}
        >
          <Text style={styles.doneBtnText}>View In My Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPrice = Number(quote?.subtotal || 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Tour Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Tour Header Card */}
        <View style={[styles.tourSummary, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Compass size={16} color={colors.brand} />
            <Text style={{ fontSize: 10, fontWeight: '900', color: colors.brand, letterSpacing: 0.8 }}>TRAVEL HUB</Text>
          </View>
          <Text style={[styles.tourName, { color: colors.text }]}>{tourTitle}</Text>
          <Text style={[styles.tourEntry, { color: colors.textSecondary }]}>₹{parseInt(price as string || '0').toLocaleString()} per adult</Text>
          {!!cancellationPolicy && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>{cancellationPolicy}</Text>
            </View>
          )}
        </View>

        {/* Departure Date Section */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Departure Date</Text>
          {!!error && (
            <TouchableOpacity onPress={fetchSchedules}>
              <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{error} Tap to retry.</Text>
            </TouchableOpacity>
          )}
          {!error && schedules.length === 0 && (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No departures available currently.</Text>
          )}
          {!!quoteError && (
            <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{quoteError}</Text>
          )}
          <View style={styles.scheduleList}>
            {schedules.map((s) => {
              const active = selectedSchedule === s.id;
              const seatsShort = s.available_seats < adults + children;
              return (
                <TouchableOpacity 
                  key={s.id}
                  disabled={booking || seatsShort}
                  style={[
                    styles.scheduleCard,
                    {
                      backgroundColor: active ? (isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF') : colors.surface,
                      borderColor: active ? colors.brand : colors.border,
                      opacity: seatsShort ? 0.45 : 1,
                    },
                  ]}
                  onPress={() => setSelectedSchedule(s.id)}
                >
                  <Calendar size={18} color={active ? colors.brand : colors.textSecondary} />
                  <Text style={[styles.scheduleDate, { color: active ? colors.brand : colors.text }]}>
                    {new Date(s.departure_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <View style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={styles.seatsLeft}>{s.available_seats} seats left</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Travelers Section */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Travelers</Text>
          <View style={styles.counterRow}>
            <View>
              <Text style={[styles.counterLabel, { color: colors.text }]}>Adults</Text>
              <Text style={[styles.counterSub, { color: colors.textSecondary }]}>Ages 12+</Text>
            </View>
            <View style={styles.counterAction}>
              <TouchableOpacity onPress={() => setAdults(Math.max(1, adults - 1))} style={[styles.countBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.countBtnText, { color: colors.text }]}>-</Text></TouchableOpacity>
              <Text style={[styles.countValue, { color: colors.text }]}>{adults}</Text>
              <TouchableOpacity onPress={() => setAdults(adults + 1)} style={[styles.countBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.countBtnText, { color: colors.text }]}>+</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.counterRow}>
            <View>
              <Text style={[styles.counterLabel, { color: colors.text }]}>Children</Text>
              <Text style={[styles.counterSub, { color: colors.textSecondary }]}>Departure child discount applied</Text>
            </View>
            <View style={styles.counterAction}>
              <TouchableOpacity onPress={() => setChildren(Math.max(0, children - 1))} style={[styles.countBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.countBtnText, { color: colors.text }]}>-</Text></TouchableOpacity>
              <Text style={[styles.countValue, { color: colors.text }]}>{children}</Text>
              <TouchableOpacity onPress={() => setChildren(children + 1)} style={[styles.countBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}><Text style={[styles.countBtnText, { color: colors.text }]}>+</Text></TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {(depositRequired ? ['cash'] as const : ['wallet', 'cash'] as const).map((method) => {
              const active = paymentMethod === method;
              return (
                <TouchableOpacity 
                  key={method}
                  style={[
                    styles.paymentBtn,
                    {
                      backgroundColor: active ? (isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF') : colors.surface,
                      borderColor: active ? colors.brand : colors.border,
                    },
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <CreditCard size={18} color={active ? colors.brand : colors.textSecondary} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.paymentBtnText, { color: active ? colors.brand : colors.text }]}>
                      {depositRequired ? 'ONLINE DEPOSIT + CASH BALANCE' : method === 'cash' ? 'Cash' : 'Travel Wallet'}
                    </Text>
                    {method === 'wallet' && (
                      <Text style={[styles.balanceText, { color: colors.textSecondary }]}>Balance: ₹{walletBalance.toLocaleString('en-IN')}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Deposit Plan if Required */}
        {depositRequired && (
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Online Deposit Choice</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>A verified deposit is required to confirm your seats.</Text>
            <View style={{ gap: 8 }}>
              {(['minimum', 'custom', 'full'] as const).map(choice => (
                <TouchableOpacity
                  key={choice}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: upfrontChoice === choice }}
                  style={[
                    styles.scheduleCard,
                    {
                      backgroundColor: upfrontChoice === choice ? (isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF') : colors.surface,
                      borderColor: upfrontChoice === choice ? colors.brand : colors.border,
                    },
                  ]}
                  onPress={() => setUpfrontChoice(choice)}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                    {choice === 'minimum' ? 'Minimum deposit' : choice === 'full' ? 'Full amount' : 'Custom deposit amount'}
                  </Text>
                  {upfrontChoice === choice && <Text style={{ color: colors.brand, fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
            {upfrontChoice === 'custom' && (
              <TextInput
                accessibilityLabel="Custom online amount in rupees"
                keyboardType="decimal-pad"
                value={upfrontAmount}
                placeholder="Enter deposit amount in ₹"
                placeholderTextColor={colors.textMuted}
                onChangeText={setUpfrontAmount}
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, marginTop: 10 }]}
              />
            )}
            {quote?.payment_plan && (
              <View style={[styles.planCard, { backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : '#EFF6FF', borderColor: isDark ? 'rgba(37,99,235,0.25)' : '#BFDBFE' }]}>
                <Text style={{ fontSize: 12, color: colors.brand, lineHeight: 18, fontWeight: '600' }}>
                  Min deposit: ₹{(quote.payment_plan.minimum_minor / 100).toFixed(2)}{'\n'}
                  Online now: ₹{(quote.payment_plan.selected_minor / 100).toFixed(2)}{'\n'}
                  Due at departure: ₹{((quote.payment_plan.total_minor - quote.payment_plan.selected_minor) / 100).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Price Summary */}
        <View style={[styles.priceSummary, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Subtotal ({adults + children} travelers)</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>₹{totalPrice.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Taxes and service fees</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>₹{(Number(quote?.tax || 0) + Number(quote?.service_fee || 0)).toLocaleString('en-IN')}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.priceRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total Amount</Text>
            <Text style={[styles.totalValue, { color: colors.brand }]}>₹{Number(quote?.total || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating CTA */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.bookBtn, { backgroundColor: colors.brand }]}
          onPress={handleBook}
          disabled={booking || !quote}
          activeOpacity={0.88}
        >
          {booking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>Confirm Tour · ₹{Number(quote?.total || 0).toLocaleString('en-IN')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { borderBottomWidth: 1, paddingTop: Platform.OS === 'ios' ? 12 : 44 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  scroll: { flex: 1 },
  tourSummary: { margin: Spacing.md, padding: 18, borderRadius: Radius.lg, borderWidth: 1, gap: 6 },
  tourName: { fontSize: 18, fontWeight: '900', marginTop: 4 },
  tourEntry: { fontSize: 13, fontWeight: '600' },

  section: { paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1 },
  sectionTitle: { ...Typography.label, marginBottom: 10 },
  
  scheduleList: { gap: 10 },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 12,
  },
  scheduleDate: { flex: 1, fontSize: 14, fontWeight: '700' },
  seatsLeft: { fontSize: 10, color: '#EF4444', fontWeight: '800' },

  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  counterLabel: { fontSize: 15, fontWeight: '800' },
  counterSub: { fontSize: 11, marginTop: 2 },
  counterAction: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  countBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  countBtnText: { fontSize: 18, fontWeight: '700' },
  countValue: { fontSize: 16, fontWeight: '900', minWidth: 20, textAlign: 'center' },

  paymentOptions: { flexDirection: 'row', gap: 10 },
  paymentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: Radius.md, borderWidth: 1 },
  paymentBtnText: { fontSize: 12, fontWeight: '800' },
  balanceText: { fontSize: 10, marginTop: 2 },

  input: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 16, minHeight: 46, fontSize: 14 },
  planCard: { padding: 12, borderRadius: Radius.md, borderWidth: 1, marginTop: 10 },

  priceSummary: { marginHorizontal: Spacing.md, padding: 16, borderRadius: Radius.lg, borderWidth: 1, gap: 10, marginTop: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 4 },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalValue: { fontSize: 17, fontWeight: '900' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, borderTopWidth: 1 },
  bookBtn: { paddingVertical: 16, borderRadius: Radius.full, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 12 },
  successTitle: { fontSize: 22, fontWeight: '900', marginTop: 10 },
  successSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  doneBtn: { marginTop: 20, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radius.full },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' }
});
