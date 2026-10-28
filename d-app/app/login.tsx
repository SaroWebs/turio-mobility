import React, { useState } from 'react';
import { Image } from 'expo-image';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView
} from 'react-native';
import { useAuthStore } from '../src/store/auth';
import api, { apiErrorMessage } from '../src/lib/api';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  
  const { loginWithOTP, error: authError } = useAuthStore();
  const visibleError = error || (step === 'VERIFY' ? authError : null);

  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

  const handleRequestOTP = async () => {
    if (normalizedPhone.length !== 10) {
      setLocalError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLocalLoading(true);
    setLocalError(null);
    setInfo(null);
    try {
      const response = await api.post('/otp/send', { phone: normalizedPhone });
      const devOtp = response.data?.dev_otp;
      setPhone(normalizedPhone);
      setStep('VERIFY');
      if (devOtp) {
        setOtp(String(devOtp));
        setInfo(`Code auto-filled for development (${devOtp}).`);
      }
    } catch (e: any) {
      const message = apiErrorMessage(e, 'Unable to send verification code.');
      setLocalError(message);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setLocalError('Enter the complete 6-digit verification code.');
      return;
    }
    setLocalLoading(true);
    setLocalError(null);
    const result = await loginWithOTP(phone.trim(), otp);
    setLocalLoading(false);

    if (result.success && result.requiresProfile) {
      router.replace({
        pathname: '/register',
        params: {
          phone: phone.trim(),
          registration_token: result.registrationToken,
        },
      });
    }
  };

  const handleResend = async () => {
    setLocalLoading(true);
    setLocalError(null);
    setInfo(null);
    try {
      const response = await api.post('/otp/send', { phone: normalizedPhone });
      setOtp('');
      const devOtp = response.data?.dev_otp;
      if (devOtp) setOtp(String(devOtp));
      setInfo('A fresh code has been sent.');
    } catch (e: any) {
      setLocalError(apiErrorMessage(e, 'Unable to resend code.'));
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 20) + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/images/turiya-mark.png')} style={styles.brandLogo} contentFit="contain" />
          <View>
            <Text style={styles.brandName}>Turiya Mobility</Text>
            <Text style={styles.brandBadge}>DRIVER PARTNER</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR ROAD · YOUR WORK</Text>
          <Text style={styles.title}>
            {step === 'REQUEST' ? 'Driver Partner Sign In' : 'Verify Phone Number'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'REQUEST' 
              ? 'Enter your registered mobile number to receive trips & tour assignments.' 
              : `Enter the 6-digit verification code sent to +91 ${phone}.`}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.progressRow} accessibilityLabel={`Step ${step === 'REQUEST' ? 1 : 2} of 2`}>
            <View style={[styles.progress, { backgroundColor: '#0f766e' }]} />
            <View style={[styles.progress, { backgroundColor: step === 'VERIFY' ? '#0f766e' : '#e2e8f0' }]} />
          </View>

          {visibleError && (
            <View style={styles.errorBox}>
              <TriangleAlert size={18} color="#be123c" />
              <Text style={styles.errorText}>{visibleError}</Text>
            </View>
          )}

          {info && !visibleError && (
            <View style={styles.infoBox}>
              <Check size={18} color="#047857" />
              <Text style={styles.infoText}>{info}</Text>
            </View>
          )}

          {step === 'REQUEST' ? (
            <View style={styles.form}>
              <Text style={styles.label}>Mobile number</Text>
              <View style={styles.phoneInput}>
                <Text style={styles.prefix}>+91</Text>
                <View style={styles.divider} />
                <TextInput
                  style={styles.flexInput}
                  placeholder="98765 43210"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  textContentType="telephoneNumber"
                  value={phone}
                  maxLength={13}
                  editable={!localLoading}
                  onChangeText={(val) => { setPhone(val); setLocalError(null); }}
                  onSubmitEditing={handleRequestOTP}
                  accessibilityLabel="Mobile number"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={normalizedPhone.length !== 10 || localLoading}
                onPress={handleRequestOTP}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (normalizedPhone.length !== 10 || localLoading) && styles.disabled,
                  pressed && styles.pressed
                ]}
              >
                {localLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Send Verification Code</Text>
                    <ArrowRight size={18} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                value={otp}
                editable={!localLoading}
                onChangeText={(val) => { 
                  const cleaned = val.replace(/\D/g, ''); 
                  setOtp(cleaned); 
                  setLocalError(null); 
                  setInfo(null);
                }}
                onSubmitEditing={handleVerifyOTP}
                accessibilityLabel="Six digit verification code"
              />
              <Pressable
                accessibilityRole="button"
                disabled={otp.length !== 6 || localLoading}
                onPress={handleVerifyOTP}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (otp.length !== 6 || localLoading) && styles.disabled,
                  pressed && styles.pressed
                ]}
              >
                {localLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Verify &amp; Continue</Text>
                    <ArrowRight size={18} color="#fff" />
                  </>
                )}
              </Pressable>

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>Didn&apos;t get the code?</Text>
                <Pressable onPress={handleResend} disabled={localLoading} hitSlop={12}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </Pressable>
              </View>

              <Pressable 
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={() => { setStep('REQUEST'); setLocalError(null); setInfo(null); }}
                disabled={localLoading}
              >
                <ArrowLeft size={16} color="#475569" />
                <Text style={styles.secondaryText}>Use another number</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.trustRow}>
          <ShieldCheck size={16} color="#047857" />
          <Text style={styles.trustText}>Secure driver gateway · Official Turiya Mobility app</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandLogo: { width: 70, height: 42 },
  brandName: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  brandBadge: { fontSize: 10, fontWeight: '800', color: '#0f766e', letterSpacing: 1 },
  hero: { marginTop: 36, marginBottom: 24 },
  eyebrow: { fontSize: 11, fontWeight: '900', color: '#0f766e', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#64748b', marginTop: 8 },
  card: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 20, backgroundColor: '#fff' },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progress: { flex: 1, height: 4, borderRadius: 999 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff1f2', padding: 12, borderRadius: 12, marginBottom: 16 },
  errorText: { flex: 1, color: '#be123c', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, marginBottom: 16 },
  infoText: { flex: 1, color: '#047857', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  form: { gap: 14 },
  label: { fontSize: 12, fontWeight: '800', color: '#475569', letterSpacing: 0.5, textTransform: 'uppercase' },
  phoneInput: { height: 54, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#f8fafc' },
  prefix: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  divider: { width: 1, height: 24, backgroundColor: '#cbd5e1', marginHorizontal: 12 },
  flexInput: { flex: 1, height: '100%', fontSize: 16, color: '#0f172a' },
  otpInput: { height: 60, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, textAlign: 'center', fontSize: 26, fontWeight: '900', letterSpacing: 10, backgroundColor: '#f8fafc', color: '#0f172a' },
  primaryButton: { minHeight: 56, width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#0f766e', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  resendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 48 },
  resendText: { fontSize: 13, color: '#64748b' },
  resendLink: { fontSize: 13, fontWeight: '800', color: '#0f766e' },
  trustRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 24 },
  trustText: { fontSize: 12, color: '#64748b' },
});
