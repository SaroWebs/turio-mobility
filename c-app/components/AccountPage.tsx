import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

export function AccountPage({ title, children, loading = false, error = '', reload }: {
  title: string; children: React.ReactNode; loading?: boolean; error?: string; reload?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[accountStyles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
          style={({ pressed }) => [
            accountStyles.back,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
            pressed && { opacity: 0.7 },
          ]}
        >
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Text style={[accountStyles.title, { color: colors.text }]}>{title}</Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={accountStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={reload ? <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
      >
        {loading && <ActivityIndicator color={colors.brand} style={{ marginVertical: 12 }} />}
        {!!error && (
          <View style={[accountStyles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FCA5A5' }]}>
            <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>{error}</Text>
            {reload && <Action label="Try again" onPress={reload} />}
          </View>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

export function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[accountStyles.panel, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
      <Text style={[accountStyles.heading, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Copy({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>{children}</Text>;
}

export function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        accountStyles.action,
        {
          backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF',
          borderColor: isDark ? 'rgba(37,99,235,0.35)' : '#BFDBFE',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

export const accountStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  back: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', flex: 1 },
  heading: { fontSize: 16, fontWeight: '800' },
  content: { padding: Spacing.md, paddingBottom: 60, gap: 14 },
  panel: { padding: 18, borderRadius: Radius.lg, borderWidth: 1, gap: 10 },
  action: { minHeight: 44, borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.full, minHeight: 48, paddingHorizontal: 16, fontSize: 15 },
  errorBox: { padding: 14, borderRadius: Radius.md, borderWidth: 1, gap: 10 },
});
