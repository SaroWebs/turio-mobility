import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Eye, Lock, MapPin, Send } from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

type SharedTourData = { title: string; status: string; travel_date: string; pickup: string; days: { day: number; title: string; details: string }[] };

export default function SharedTourScreen() {
  const { token: paramToken } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [token] = useState(paramToken || '');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState('');
  const [tour, setTour] = useState<SharedTourData | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Once we have a session, fetch the shared tour view
  useEffect(() => {
    if (!session) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await api.get('/tour-shares/view', { headers: { 'X-Tour-Share-Session': session } });
        if (!active) return;
        setTour(response.data?.data ?? null);
        setMessage('');
      } catch (error: any) {
        if (!active) return;
        if (error?.response?.status === 404) {
          setSession('');
          setMessage('Shared access has ended.');
        } else {
          setMessage(apiErrorMessage(error));
        }
      }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [session]);

  const sendOtp = async () => {
    if (!phone.trim() || token.length !== 64) {
      setMessage('Enter the mobile number you were invited with.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api.post('/tour-shares/otp', { token, phone: phone.trim() });
      setOtpSent(true);
      setMessage('OTP sent. Check your messages.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!code.trim() || code.length !== 6) {
      setMessage('Enter the 6-digit OTP.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await api.post('/tour-shares/verify', { token, phone: phone.trim(), code: code.trim() });
      const newSession = response.data?.data?.session;
      if (newSession) {
        setSession(newSession);
      }
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // Invalid or missing token
  if (!token || token.length !== 64) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Lock size={30} color={colors.textMuted} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Invalid invitation</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>This link is not valid. Ask the person who shared the tour for a new invitation.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.brand }]}><Text style={styles.primaryText}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface }]}><ArrowLeft size={20} color={colors.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{tour?.title || 'Shared tour'}</Text>
          {tour && <Text style={[styles.headerMeta, { color: colors.textSecondary }]}>{tour.travel_date} · {tour.status.replace(/_/g, ' ')}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!!message && <Text style={[styles.messageText, { color: message.includes('sent') ? colors.success : colors.error }]}>{message}</Text>}

        {!session ? (
          // Verification flow
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}><Lock size={20} color={colors.brand} /><Text style={[styles.cardTitle, { color: colors.text }]}>Verify your number</Text></View>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Enter the mobile number your friend or family member invited. We will send you an OTP to verify.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Mobile number"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={(text) => { setPhone(text); setOtpSent(false); }}
              keyboardType="phone-pad"
              maxLength={20}
            />
            <Pressable accessibilityRole="button" disabled={busy || !phone.trim()} onPress={sendOtp} style={[styles.primaryButton, { backgroundColor: colors.brand, opacity: busy || !phone.trim() ? 0.6 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Send size={16} color="#fff" />}
              <Text style={styles.primaryText}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
            </Pressable>
            {otpSent && (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, fontSize: 22, letterSpacing: 6, textAlign: 'center' }]}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable accessibilityRole="button" disabled={busy || code.length !== 6} onPress={verifyOtp} style={[styles.primaryButton, { backgroundColor: colors.brand, opacity: busy || code.length !== 6 ? 0.6 : 1 }]}>
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Eye size={16} color="#fff" />}
                  <Text style={styles.primaryText}>Verify & view tour</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : tour ? (
          // Tour view
          <>
            <View style={[styles.hero, { backgroundColor: colors.brandStrong }, CardShadow]}>
              <Text style={styles.heroEyebrow}>SHARED TOUR</Text>
              <Text style={styles.heroTitle}>{tour.title}</Text>
              <Text style={styles.heroCopy}>{tour.travel_date} · {tour.status.replace(/_/g, ' ')}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.row}><MapPin size={20} color={colors.brand} /><Text style={[styles.cardTitle, { color: colors.text }]}>Pickup point</Text></View>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{tour.pickup}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Day-by-day plan</Text>
              {tour.days.map((day, index) => (
                <View key={index} style={[styles.dayCard, { borderColor: colors.border }]}>
                  <Text style={[styles.dayLabel, { color: colors.brand }]}>Day {day.day}</Text>
                  <Text style={[styles.dayTitle, { color: colors.text }]}>{day.title}</Text>
                  <Text style={[styles.caption, { color: colors.textSecondary }]}>{day.details}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.footnote, { color: colors.textMuted }]}>View-only access. For changes, contact the person who booked this tour.</Text>
          </>
        ) : (
          <View style={styles.centered}><ActivityIndicator color={colors.brand} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading tour…</Text></View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  header: { minHeight: 64, borderBottomWidth: 1, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerMeta: { fontSize: 11, marginTop: 2 },
  content: { padding: Spacing.md, paddingBottom: 48, gap: 14 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: 17, gap: 12 },
  cardTitle: { ...Typography.heading },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  caption: { ...Typography.body },
  body: { ...Typography.body, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  messageText: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  hero: { borderRadius: Radius.lg, padding: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,.72)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 8 },
  heroCopy: { color: 'rgba(255,255,255,.8)', fontSize: 13, lineHeight: 19, marginTop: 7, textTransform: 'capitalize' },
  dayCard: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  dayLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  dayTitle: { fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  errorTitle: { ...Typography.title, textAlign: 'center' },
});
