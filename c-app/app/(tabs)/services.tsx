import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Car, ChevronRight, Compass, CreditCard, Gift, Headphones, KeyRound, ShieldCheck } from 'lucide-react-native';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../../src/constants/theme';

const serviceGroups = [
  {
    title: 'Plan a journey',
    items: [
      { title: 'Book a ride', description: 'Local and intercity travel', icon: Car, route: '/ride-booking' as const, bg: '#FEF3C7', color: '#D97706', darkBg: '#451a03', darkColor: '#F59E0B' },
      { title: 'Car rentals', description: 'Cars for a day or longer', icon: KeyRound, route: '/(tabs)/rentals' as const, bg: '#F1F5F9', color: '#09090B', darkBg: '#27272A', darkColor: '#FFFFFF' },
      { title: 'Tours', description: 'Curated regional experiences', icon: Compass, route: '/(tabs)/tours' as const, bg: '#EFF6FF', color: '#2563EB', darkBg: '#1E3A8A', darkColor: '#60A5FA' },
    ],
  },
  {
    title: 'Manage your account',
    items: [
      { title: 'Wallet', description: 'Balance and transactions', icon: CreditCard, route: '/wallet' as const, bg: '#ECFDF5', color: '#059669', darkBg: '#064e3b', darkColor: '#34D399' },
      { title: 'Offers', description: 'Available savings', icon: Gift, route: '/offers' as const, bg: '#FDF2F8', color: '#DB2777', darkBg: '#831843', darkColor: '#F472B6' },
      { title: 'Travel protection', description: 'Insurance and assistance', icon: ShieldCheck, route: '/travel-protection' as const, bg: '#EEF2FF', color: '#4F46E5', darkBg: '#312E81', darkColor: '#818CF8' },
      { title: 'Notifications', description: 'Booking updates', icon: Bell, route: '/notifications' as const, bg: '#F5F3FF', color: '#7C3AED', darkBg: '#4C1D95', darkColor: '#A78BFA' },
      { title: 'Help and support', description: 'Get help with a journey', icon: Headphones, route: '/help-center' as const, bg: '#F0F9FF', color: '#0284C7', darkBg: '#0C4A6E', darkColor: '#38BDF8' },
    ],
  },
];

export default function ServicesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.brand }]}>EVERYTHING IN ONE PLACE</Text>
          <Text style={[styles.title, { color: colors.text }]}>Services</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose what you need and we&apos;ll take you there.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {serviceGroups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{group.title}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
              {group.items.map((item, index) => {
                const Icon = item.icon;
                const iconBg = isDark ? item.darkBg : item.bg;
                const iconColor = isDark ? item.darkColor : item.color;
                return (
                  <Pressable
                    key={item.title}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.description}`}
                    onPress={() => router.push(item.route)}
                    style={({ pressed }) => [styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }, pressed && styles.pressed]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                      <Icon size={21} color={iconColor} strokeWidth={2.2} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>{item.description}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { backgroundColor: 'transparent' },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  eyebrow: { ...Typography.label, letterSpacing: 1 },
  title: { ...Typography.display, marginTop: 6 },
  subtitle: { ...Typography.body, marginTop: 7, maxWidth: 320 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: 110, gap: Spacing.lg },
  group: { gap: 10 },
  groupTitle: { ...Typography.label, marginLeft: 4 },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 13 },
  pressed: { opacity: 0.68 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
});
