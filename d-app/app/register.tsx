import React, { useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BriefcaseBusiness, Check, UserRound } from 'lucide-react-native';
import { useAuthStore } from '../src/store/auth';

type ServiceType = 'ride' | 'tour' | 'rental';

const SERVICE_OPTIONS: { key: ServiceType; title: string; description: string }[] = [
  { key: 'ride', title: 'Ride bookings', description: 'Short and long-distance trips' },
  { key: 'tour', title: 'Tour transport', description: 'Scheduled tour assignments' },
  { key: 'rental', title: 'Car rental', description: 'Vehicle delivery and collection' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { phone: phoneParam, registration_token: registrationTokenParam } = useLocalSearchParams<{
    phone?: string;
    registration_token?: string;
  }>();
  const phone = typeof phoneParam === 'string' ? phoneParam : '';
  const registrationToken = typeof registrationTokenParam === 'string' ? registrationTokenParam : '';
  const { completeProfile, error: authError } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceType[]>(['ride']);
  const [form, setForm] = useState({
    name: '',
    email: '',
  });

  const canSubmit = useMemo(
    () => Boolean(phone && registrationToken && form.name.trim().length >= 2 && services.length),
    [form.name, phone, registrationToken, services.length],
  );

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleService = (service: ServiceType) => {
    setServices((current) => current.includes(service)
      ? current.filter((item) => item !== service)
      : [...current, service]);
  };

  const submit = async () => {
    if (!canSubmit || loading) return;

    setLoading(true);
    const success = await completeProfile({
      phone,
      registration_token: registrationToken,
      ...form,
      name: form.name.trim(),
      email: form.email.trim() || null,
      service_types: services,
    });
    setLoading(false);

    if (success) {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to login"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color="#0f172a" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>DRIVER ONBOARDING</Text>
            <Text style={styles.title}>Let’s start with you</Text>
            <Text style={styles.subtitle}>
              Your phone is verified. Create your account now, then add your documents and car when you’re ready.
            </Text>
          </View>

          {authError && (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorTitle}>Please check your details</Text>
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}

          <Section icon={<UserRound size={20} color="#0369a1" />} title="Personal details">
            <Field label="Phone number" required>
              <TextInput
                accessibilityLabel="Phone number"
                style={[styles.input, styles.readOnlyInput]}
                value={phone}
                editable={false}
              />
              <Text style={styles.helper}>Taken from the login screen and cannot be changed here.</Text>
            </Field>
            <Field label="Full name" required>
              <TextInput
                accessibilityLabel="Full name"
                style={styles.input}
                value={form.name}
                onChangeText={(value) => update('name', value)}
                autoCapitalize="words"
                autoComplete="name"
                placeholder="Your legal name"
              />
            </Field>
            <Field label="Email address">
              <TextInput
                accessibilityLabel="Email address"
                style={styles.input}
                value={form.email}
                onChangeText={(value) => update('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="name@example.com"
              />
            </Field>
          </Section>

          <Section icon={<BriefcaseBusiness size={20} color="#0369a1" />} title="Services you can handle">
            <Text style={styles.sectionHint}>Select at least one. You can update availability after approval.</Text>
            <View style={styles.serviceList}>
              {SERVICE_OPTIONS.map((option) => {
                const selected = services.includes(option.key);
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleService(option.key)}
                    style={({ pressed }) => [styles.serviceCard, selected && styles.serviceCardSelected, pressed && styles.pressed]}
                  >
                    <View style={[styles.checkBox, selected && styles.checkBoxSelected]}>
                      {selected && <Check size={16} strokeWidth={3} color="#ffffff" />}
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceTitle}>{option.title}</Text>
                      <Text style={styles.serviceDescription}>{option.description}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>What happens next?</Text>
            <Text style={styles.noticeText}>
              Next: upload your driver documents and add your car. Each upload is saved separately, so you can return later. Trips become available after verification and approval.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit || loading }}
            disabled={!canSubmit || loading}
            onPress={submit}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || loading) && styles.submitDisabled,
              pressed && canSubmit && styles.submitPressed,
            ]}
          >
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>Create driver account</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconBox}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label} {required && <Text style={styles.required}>*</Text>}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  backButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16 },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.68 },
  hero: { marginTop: 12, marginBottom: 24 },
  eyebrow: { color: '#0369a1', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: '#0f172a', fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: '#475569', fontSize: 16, lineHeight: 24, marginTop: 10 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 16, marginBottom: 16 },
  errorTitle: { color: '#991b1b', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  errorText: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
  section: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' },
  sectionHint: { color: '#64748b', fontSize: 14, lineHeight: 20, marginTop: -8, marginBottom: 4 },
  fields: { gap: 18 },
  field: { gap: 8 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600' },
  required: { color: '#b91c1c' },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, color: '#0f172a', backgroundColor: '#ffffff', fontSize: 16 },
  readOnlyInput: { color: '#475569', backgroundColor: '#f1f5f9' },
  helper: { color: '#64748b', fontSize: 12, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 22, paddingHorizontal: 15, backgroundColor: '#ffffff' },
  chipSelected: { borderColor: '#0284c7', backgroundColor: '#e0f2fe' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: '#075985' },
  serviceList: { gap: 10 },
  serviceCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 14 },
  serviceCardSelected: { borderColor: '#0284c7', backgroundColor: '#f0f9ff' },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  checkBoxSelected: { borderColor: '#0284c7', backgroundColor: '#0284c7' },
  serviceCopy: { flex: 1 },
  serviceTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  serviceDescription: { color: '#64748b', fontSize: 13, lineHeight: 18, marginTop: 2 },
  notice: { borderRadius: 16, padding: 16, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 20 },
  noticeTitle: { color: '#1e3a8a', fontSize: 15, fontWeight: '700', marginBottom: 5 },
  noticeText: { color: '#1e40af', fontSize: 14, lineHeight: 21 },
  submitButton: { minHeight: 56, borderRadius: 14, backgroundColor: '#0284c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  submitPressed: { backgroundColor: '#0369a1' },
  submitDisabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
