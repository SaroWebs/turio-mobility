import { postBooking } from '../src/lib/booking-attempt';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Car, Info, CheckCircle, CreditCard, ShieldCheck } from 'lucide-react-native';
import api from '../src/lib/api';
import DateTimeField from '../components/DateTimeField';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

export default function RentalCheckoutScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { vehicleId, categoryId, categoryName, basePrice } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState('');
  
  const formatDateParam = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const [pickupLocation, setPickupLocation] = useState('Airport Terminal 1');
  const [dropoffLocation, setDropoffLocation] = useState('Airport Terminal 1');
  const [specialRequests, setSpecialRequests] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'upi'>('cash');
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => {
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get('/wallet');
      setWalletBalance(parseFloat(response.data.data.balance));
    } catch (error) {
      console.error('Wallet fetch error', error);
    }
  };

  const startDateStr = useMemo(() => formatDateParam(startDate), [startDate]);
  const endDateStr = useMemo(() => formatDateParam(endDate), [endDate]);

  const calcDays = useMemo(() => {
    const startMs = new Date(`${startDateStr}T00:00:00`).getTime();
    const endMs = new Date(`${endDateStr}T00:00:00`).getTime();
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  }, [startDateStr, endDateStr]);

  const payload = useMemo(() => ({
    vehicle_id: vehicleId ? Number(vehicleId) : undefined,
    car_category_id: Number(categoryId),
    start_date: startDateStr,
    end_date: endDateStr,
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
    special_requests: specialRequests,
    payment_method: paymentMethod,
  }), [vehicleId, categoryId, startDateStr, endDateStr, pickupLocation, dropoffLocation, specialRequests, paymentMethod]);

  useEffect(() => {
    let active = true; setQuote(null);
    const timer = setTimeout(() => { void api.post('/rentals/quote', payload).then(r => { if (active) { setQuote(r.data.data); setQuoteError(''); } }).catch(e => { if (active) setQuoteError(e.response?.data?.message || 'Check dates and pickup details.'); }); }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [payload]);
  const handleBook = async () => {
    if (!quote || loading) return;
    setLoading(true);
    try {
      const response = await postBooking('/car-rentals', { ...payload, quote_token: quote.quote_token });
      if (response.data.success) {
        setCreated(response.data.data);
      }
    } catch (error: any) {
      Alert.alert('Rental Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={52} color="#10B981" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Reservation Confirmed</Text>
        <Text style={[styles.successSub, { color: colors.textSecondary }]}>
          Your {categoryName} is reserved from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}. Status: {created.status}. Payment: {created.payment_status}.
        </Text>
        <TouchableOpacity 
          style={[styles.doneBtn, { backgroundColor: colors.brand }]}
          onPress={() => router.replace({ pathname: '/service-activity', params: { kind: 'rental', id: created.id, title: String(categoryName) } })}
        >
          <Text style={styles.doneBtnText}>View In My Activity</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const quoteDays = quote?.pricing_components?.number_of_days;
  const days = quoteDays ?? calcDays;
  const unitPrice = parseInt(basePrice as string || '0', 10);
  const totalPrice = Number(quote?.total ?? (unitPrice * days));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>DriveLux Rental</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }}>
        {!!quoteError && (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>{quoteError}</Text>
          </View>
        )}

        {/* Vehicle Header Card */}
        <View style={[styles.carSummary, { backgroundColor: isDark ? '#18181B' : '#0F172A' }, CardShadow]}>
          <View style={styles.carIconBox}>
            <Car size={28} color="#fff" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.carBrandTag}>DRIVELUX FLEET</Text>
            <Text style={styles.carName}>{categoryName}</Text>
            <Text style={styles.carPrice}>₹{parseInt(basePrice as string || '0').toLocaleString()} / day</Text>
          </View>
        </View>

        {/* Location Section */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Pick-up &amp; Drop-off</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MapPin size={18} color={colors.brand} />
            <TextInput 
              style={[styles.input, { color: colors.text }]} 
              placeholder="Pick-up location"
              placeholderTextColor={colors.textMuted}
              value={pickupLocation}
              onChangeText={setPickupLocation}
            />
          </View>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MapPin size={18} color={colors.textSecondary} />
            <TextInput 
              style={[styles.input, { color: colors.text }]} 
              placeholder="Drop-off location (optional)"
              placeholderTextColor={colors.textMuted}
              value={dropoffLocation}
              onChangeText={setDropoffLocation}
            />
          </View>
        </View>

        {/* Dates Section */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Rental Duration ({days} {days === 1 ? 'day' : 'days'})</Text>
          <View style={styles.dateSelectorRow}>
            <View style={{ flex: 1 }}>
              <DateTimeField label="Start date" value={startDate} minimumDate={tomorrow} onChange={date => {
                if (!date) return;
                setStartDate(date);
                if (endDate < date) setEndDate(date);
              }} />
            </View>
            <View style={{ flex: 1 }}>
              <DateTimeField label="End date" value={endDate} minimumDate={startDate} onChange={date => { if (date) setEndDate(date); }} />
            </View>
          </View>
        </View>

        {/* Special Requests */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Special Instructions</Text>
          <TextInput 
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} 
            placeholder="Chauffeur preferences or flight arrival details"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={specialRequests}
            onChangeText={setSpecialRequests}
          />
        </View>

        {/* Payment Method */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {(['cash', 'wallet'] as const).map((method) => {
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentBtnText, { color: active ? colors.brand : colors.text }]}>
                      {method === 'cash' ? 'Cash on Delivery' : 'Travel Wallet'}
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

        {/* Chauffeur Trust Notice */}
        <View style={[styles.infoBanner, { backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF', borderColor: isDark ? 'rgba(37,99,235,0.3)' : '#BFDBFE' }]}>
          <ShieldCheck size={18} color="#2563EB" />
          <Text style={[styles.infoText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
            Professional chauffeur included. No personal driving licence required.
          </Text>
        </View>

        {/* Price Breakdown */}
        <View style={[styles.priceSummary, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Rate ({days} {days === 1 ? 'day' : 'days'})</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>₹{unitPrice.toLocaleString('en-IN')} x {days}</Text>
          </View>
          {Number(quote?.discount || 0) > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.success }]}>Coupon Discount</Text>
              <Text style={[styles.priceValue, { color: colors.success }]}>-₹{Number(quote.discount).toLocaleString('en-IN')}</Text>
            </View>
          )}
          {Number(quote?.tax || 0) + Number(quote?.service_fee || 0) > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Taxes &amp; Fees</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>+₹{(Number(quote.tax || 0) + Number(quote.service_fee || 0)).toLocaleString('en-IN')}</Text>
            </View>
          )}
          {Number(quote?.deposit || 0) > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Security Deposit</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>+₹{Number(quote.deposit).toLocaleString('en-IN')}</Text>
            </View>
          )}
          <View style={[styles.priceRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total (all inclusive)</Text>
            <Text style={[styles.totalValue, { color: colors.brand }]}>₹{totalPrice.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating CTA */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.bookBtn, { backgroundColor: colors.brand }]}
          onPress={handleBook}
          disabled={loading || !quote}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>Reserve Vehicle · ₹{totalPrice.toLocaleString('en-IN')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1, paddingTop: Platform.OS === 'ios' ? 12 : 44 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  scroll: { flex: 1 },
  errorBanner: { margin: Spacing.md, padding: 12, borderRadius: Radius.md },
  carSummary: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: Spacing.md, padding: 18, borderRadius: Radius.lg },
  carIconBox: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  carBrandTag: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  carName: { fontSize: 17, fontWeight: '900', color: '#fff', marginTop: 2 },
  carPrice: { fontSize: 13, color: '#F59E0B', fontWeight: '800', marginTop: 3 },

  section: { paddingHorizontal: Spacing.md, paddingVertical: 14, borderBottomWidth: 1 },
  sectionTitle: { ...Typography.label, marginBottom: 10 },
  
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: Radius.full, marginBottom: 10, borderWidth: 1 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14 },
  textArea: { borderRadius: Radius.md, borderWidth: 1, padding: 12, minHeight: 70, textAlignVertical: 'top' },

  dateSelectorRow: { flexDirection: 'row', gap: 12 },
  dateBox: { flex: 1, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  dateLabel: { fontSize: 11, marginBottom: 4, fontWeight: '700' },
  dateValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 13, fontWeight: '800' },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.md, marginVertical: 12, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  priceSummary: { marginHorizontal: Spacing.md, padding: 16, borderRadius: Radius.lg, borderWidth: 1, gap: 10, marginTop: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 13, fontWeight: '700' },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalValue: { fontSize: 17, fontWeight: '900' },
  
  paymentOptions: { gap: 10 },
  paymentBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, borderWidth: 1 },
  paymentBtnText: { fontSize: 14, fontWeight: '800' },
  balanceText: { fontSize: 11, marginTop: 2 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, borderTopWidth: 1 },
  bookBtn: { paddingVertical: 16, borderRadius: Radius.full, alignItems: 'center' },
  bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 12 },
  successTitle: { fontSize: 22, fontWeight: '900', marginTop: 10 },
  successSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  doneBtn: { marginTop: 20, paddingHorizontal: 28, paddingVertical: 14, borderRadius: Radius.full },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' }
});
