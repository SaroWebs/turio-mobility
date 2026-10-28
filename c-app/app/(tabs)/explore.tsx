import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Car, Compass, KeyRound, MapPin, Sparkles, Wallet, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../../src/constants/theme';
import api from '../../src/lib/api';

interface Place {
  id: number;
  name: string;
  category?: { name: string };
  city?: string;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/public/destinations')
      .then((res) => {
        if (active && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
          setPlaces(list.slice(0, 5));
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const shortcuts = [
    {
      title: 'Daily Ride',
      desc: 'On-demand city pickup',
      icon: Car,
      route: '/ride-booking' as const,
      tag: 'TAXI',
      color: '#F59E0B',
      bg: isDark ? 'rgba(245,158,11,0.18)' : '#FEF3C7',
    },
    {
      title: 'Tour Packages',
      desc: 'Curated day & multi-day trips',
      icon: Compass,
      route: '/(tabs)/tours' as const,
      tag: 'TRAVEL',
      color: '#2563EB',
      bg: isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF',
    },
    {
      title: 'Car Rentals',
      desc: 'Self-drive & chauffeur cars',
      icon: KeyRound,
      route: '/(tabs)/rentals' as const,
      tag: 'DRIVELUX',
      color: isDark ? '#E4E4E7' : '#18181B',
      bg: isDark ? 'rgba(255,255,255,0.1)' : '#F4F4F5',
    },
    {
      title: 'Travel Wallet',
      desc: 'Manage funds & payments',
      icon: Wallet,
      route: '/wallet' as const,
      tag: 'BALANCE',
      color: '#10B981',
      bg: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5',
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + Spacing.md }]}>
        <Text style={[styles.eyebrow, { color: colors.brand }]}>DISCOVER &amp; GO</Text>
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Quick shortcuts and top destinations for your trip.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.banner, { backgroundColor: isDark ? '#18181B' : '#0F172A' }, CardShadow]}>
          <View style={[styles.sparkleBox, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
            <Sparkles size={22} color="#F59E0B" />
          </View>
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>Explore Turiya Mobility</Text>
            <Text style={styles.bannerText}>DriveLux rental fleets, Travel curated tours, and Taxi on-demand rides.</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Explore by Pillar</Text>
        <View style={styles.grid}>
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.desc}`}
                onPress={() => router.push(item.route)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  CardShadow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                    <Icon size={20} color={item.color} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.tag, { backgroundColor: item.bg, color: item.color }]}>{item.tag}</Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.destSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Popular Destinations</Text>
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 12 }} />
          ) : places.length > 0 ? (
            <View style={[styles.destCard, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
              {places.map((place, index) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/tours',
                      params: { destination_id: String(place.id), destination: place.name },
                    })
                  }
                  style={({ pressed }) => [styles.destRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, pressed && styles.pressed]}
                >
                  <View style={[styles.destIcon, { backgroundColor: isDark ? 'rgba(37,99,235,0.18)' : '#EFF6FF' }]}>
                    <MapPin size={18} color="#2563EB" />
                  </View>
                  <View style={styles.destCopy}>
                    <Text style={[styles.destName, { color: colors.text }]}>{place.name}</Text>
                    <Text style={[styles.destCategory, { color: colors.textSecondary }]}>{place.category?.name || place.city || 'Regional attraction'}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable onPress={() => router.push('/(tabs)/tours')} style={[styles.destCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: 18 }, CardShadow]}>
              <Text style={[styles.destName, { color: colors.text }]}>Featured Regional Tours</Text>
              <Text style={[styles.destCategory, { color: colors.textSecondary, marginTop: 4 }]}>Tap to browse all available tours and sightseeing trips.</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  eyebrow: { ...Typography.label, letterSpacing: 1 },
  title: { ...Typography.display, marginTop: 4 },
  subtitle: { ...Typography.body, marginTop: 4 },
  content: { paddingHorizontal: Spacing.md, paddingBottom: 110, gap: Spacing.lg },
  banner: { borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  sparkleBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bannerCopy: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  bannerText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 17, marginTop: 3 },
  sectionTitle: { ...Typography.label, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48.2%', minHeight: 128, borderRadius: Radius.lg, borderWidth: 1, padding: 14, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBox: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tag: { fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  cardTitle: { fontSize: 14, fontWeight: '900', marginTop: 12 },
  cardDesc: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  destSection: { gap: 10 },
  destCard: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  destRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  destIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  destCopy: { flex: 1 },
  destName: { fontSize: 14, fontWeight: '800' },
  destCategory: { fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.72 },
});
