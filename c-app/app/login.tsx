import React, { useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, ArrowRight, Check, MapPinned, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth';
import api, { apiErrorMessage } from '../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

type Step = 'PHONE' | 'REGISTER' | 'OTP';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('PHONE');
  const [action, setAction] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { loginWithOTP, registerWithOTP } = useAuthStore();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

  const handleCheckPhone = async () => {
    if (normalizedPhone.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await api.post('/otp/send', { phone: normalizedPhone, action: 'login' });
      setPhone(normalizedPhone);
      if (response.data.customer_exists === false) {
        setAction('register');
        setStep('REGISTER');
      } else {
        setAction('login');
        setStep('OTP');
      }
    } catch (requestError: any) {
      if (requestError.response?.status === 404) {
        setPhone(normalizedPhone);
        setAction('register');
        setStep('REGISTER');
      } else {
        setError(apiErrorMessage(requestError, 'Unable to send the code. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendRegisterOTP = async () => {
    if (name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/otp/send', { phone, action: 'register' });
      setStep('OTP');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to send the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    setError(null);
    const success = action === 'register'
      ? await registerWithOTP(phone, otp, name.trim())
      : await loginWithOTP(phone, otp);
    if (!success) {
      setError(useAuthStore.getState().error || 'That code is invalid or expired.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.post('/otp/send', { phone, action });
      setOtp('');
      setInfo('A fresh code has been sent.');
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to resend the code.'));
    } finally {
      setLoading(false);
    }
  };

  const copy = {
    PHONE: { title: 'Premium Rides & Tours for Every Journey', subtitle: 'Luxury, comfort and performance — all in one place.' },
    REGISTER: { title: 'Create Your Profile', subtitle: 'Tell us your name before we secure your mobile account.' },
    OTP: { title: 'Security Verification', subtitle: `Enter the 6-digit code sent to +91 ${phone}.` },
  }[step];

  const goBack = () => {
    setStep(step === 'OTP' && action === 'register' ? 'REGISTER' : 'PHONE');
    setOtp('');
    setError(null);
    setInfo(null);
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 24) + 12 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/images/turiya-mark.png')} style={styles.brandLogo} contentFit="contain" />
          <View>
            <Text style={[styles.brandName, { color: colors.text }]}>Turiya Mobility</Text>
            <Text style={[styles.brandSubText, { color: colors.textSecondary }]}>Tours - Rides - Rentals</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.brand }]}>EXCLUSIVE MOBILITY & TOURS</Text>
          <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{copy.subtitle}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
          <View style={styles.progressRow} accessibilityLabel={`Authentication step ${step === 'PHONE' ? 1 : step === 'REGISTER' ? 2 : 3}`}>
            {[0, 1, 2].map((item) => {
              const current = step === 'PHONE' ? 0 : step === 'REGISTER' ? 1 : 2;
              return <View key={item} style={[styles.progress, { backgroundColor: item <= current ? (isDark ? '#FFFFFF' : '#09090B') : colors.border }]} />;
            })}
          </View>
          <Text style={[styles.stepLabel, { color: colors.textMuted }]}>
            Step {step === 'PHONE' ? 1 : step === 'REGISTER' ? 2 : 3} of 3
          </Text>

          {error && (
            <View style={[styles.notice, { backgroundColor: isDark ? '#450a0a' : '#FFF0EE' }]}>
              <TriangleAlert size={18} color={colors.error} />
              <Text style={[styles.noticeText, { color: colors.error }]}>{error}</Text>
            </View>
          )}
          {info && !error && (
            <View style={[styles.notice, { backgroundColor: isDark ? '#064e3b' : '#EDFDF5' }]}>
              <Check size={18} color={colors.success} />
              <Text style={[styles.noticeText, { color: colors.success }]}>{info}</Text>
            </View>
          )}

          {step === 'PHONE' && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Mobile Phone</Text>
              <View style={[styles.phoneInput, { borderColor: colors.border, backgroundColor: isDark ? '#18181B' : '#F8FAFC' }]}>
                <Text style={[styles.prefix, { color: colors.text }]}>+91</Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TextInput
                  style={[styles.flexInput, { color: colors.text }]}
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  textContentType="telephoneNumber"
                  value={phone}
                  maxLength={13}
                  editable={!loading}
                  onChangeText={(value) => { setPhone(value); setError(null); }}
                  onSubmitEditing={handleCheckPhone}
                  accessibilityLabel="Mobile number"
                />
              </View>
              <PrimaryButton label="Get Started" loading={loading} disabled={normalizedPhone.length !== 10} onPress={handleCheckPhone} />
            </View>
          )}

          {step === 'REGISTER' && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
              <View style={[styles.iconInput, { borderColor: colors.border, backgroundColor: isDark ? '#18181B' : '#F8FAFC' }]}>
                <UserRound size={19} color={colors.textMuted} />
                <TextInput
                  style={[styles.flexInput, { color: colors.text }]}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  value={name}
                  editable={!loading}
                  onChangeText={(value) => { setName(value); setError(null); }}
                  onSubmitEditing={handleSendRegisterOTP}
                  accessibilityLabel="Full name"
                />
              </View>
              <View style={[styles.numberPill, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.numberPillText, { color: colors.textSecondary }]}>+91 {phone}</Text>
              </View>
              <PrimaryButton label="Send Verification Code" loading={loading} disabled={name.trim().length < 2} onPress={handleSendRegisterOTP} />
              <SecondaryButton label="Use another number" onPress={goBack} />
            </View>
          )}

          {step === 'OTP' && (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>6-Digit Security Code</Text>
              <TextInput
                style={[styles.otpInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#18181B' : '#F8FAFC' }]}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                value={otp}
                editable={!loading}
                onChangeText={(value) => { setOtp(value.replace(/\D/g, '')); setError(null); setInfo(null); }}
                onSubmitEditing={handleVerifyOTP}
                accessibilityLabel="Six digit verification code"
              />
              <PrimaryButton label={action === 'register' ? 'Complete Registration' : 'Verify & Continue'} loading={loading} disabled={otp.length !== 6} onPress={handleVerifyOTP} />
              <View style={styles.resendRow}>
                <Text style={[styles.resendText, { color: colors.textSecondary }]}>Didn&apos;t receive it?</Text>
                <Pressable onPress={handleResend} disabled={loading} hitSlop={12}>
                  <Text style={[styles.resendLink, { color: colors.brand }]}>Resend Code</Text>
                </Pressable>
              </View>
              <SecondaryButton label="Change Phone Number" onPress={goBack} />
            </View>
          )}
        </View>

        <View style={styles.trustRow}>
          <ShieldCheck size={16} color={colors.success} />
          <Text style={[styles.trustText, { color: colors.textSecondary }]}>End-to-end encrypted session. Safe and confidential.</Text>
        </View>
        <Text style={[styles.footer, { color: colors.textMuted }]}>By continuing, you agree to our Terms of Service & Privacy Policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) {
  const { isDark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: isDark ? '#FFFFFF' : '#09090B' },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isDark ? '#09090B' : '#FFFFFF'} />
      ) : (
        <>
          <Text style={[styles.primaryText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>{label}</Text>
          <ArrowRight size={18} color={isDark ? '#09090B' : '#FFFFFF'} />
        </>
      )}
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      <ArrowLeft size={16} color={colors.textSecondary} />
      <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  brandLogo: { width: 70, height: 42 },
  brandName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginLeft: 4 },
  brandSubText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  hero: { marginTop: 28, marginBottom: 20 },
  eyebrow: { ...Typography.label, letterSpacing: 1.2 },
  title: { ...Typography.display, marginTop: 8, maxWidth: 320 },
  subtitle: { ...Typography.body, marginTop: 8, maxWidth: 330 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 22 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  progress: { flex: 1, height: 4, borderRadius: Radius.pill },
  stepLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: Radius.sm, marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  form: { gap: 16 },
  label: { ...Typography.label, letterSpacing: 0.3 },
  phoneInput: { height: 56, borderWidth: 1, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  iconInput: { height: 56, borderWidth: 1, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  prefix: { fontSize: 16, fontWeight: '800' },
  divider: { width: 1, height: 22, marginHorizontal: 12 },
  flexInput: { flex: 1, height: '100%', fontSize: 16, fontWeight: '500' },
  otpInput: { height: 60, borderWidth: 1, borderRadius: Radius.pill, textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 12 },
  numberPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill },
  numberPillText: { fontSize: 13, fontWeight: '700' },
  primaryButton: { height: 56, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  primaryText: { fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.82 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40 },
  resendText: { fontSize: 13 },
  resendLink: { fontSize: 13, fontWeight: '800' },
  trustRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 22 },
  trustText: { fontSize: 12 },
  footer: { textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 10 },
});
