import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight, CarFront, Gauge, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react-native';
import api from '../../src/lib/api';
import { CardShadow, FloatingShadow, Radius, Spacing, Typography, useTheme } from '../../src/constants/theme';

interface RentalVehicle {
  id: number;
  make: string;
  model: string;
  year: number;
  fuel_type: string;
  seats: number;
  cover_image?: string | null;
  base_fare: number;
  category?: {
    name?: string;
    description?: string;
  } | null;
}

export default function RentalsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [vehicles, setVehicles] = useState<RentalVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchVehicles = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/public/rental-vehicles');
      setVehicles(response.data?.data || []);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchVehicles(); }, [fetchVehicles]);

  const categories = ['All', 'Sports', 'SUV', 'Luxury', 'Sedan'];

  const filteredVehicles = vehicles.filter((v) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      v.category?.name?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      v.model?.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      !searchQuery ||
      `${v.make} ${v.model} ${v.category?.name || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={isDark ? '#FFFFFF' : '#09090B'} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Curating vehicle fleet…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CarFront size={18} color={colors.textMuted} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search cars, locations..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={[styles.filterBtn, { backgroundColor: colors.surfaceMuted }]}>
            <SlidersHorizontal size={14} color={colors.text} />
          </View>
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryPill,
                  { backgroundColor: isSelected ? (isDark ? '#FFFFFF' : '#09090B') : colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    { color: isSelected ? (isDark ? '#09090B' : '#FFFFFF') : colors.textSecondary },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchVehicles(true)} tintColor={colors.brand} colors={[colors.brand]} />}
      >
        {offline && (
          <View style={[styles.notice, { backgroundColor: isDark ? '#451a03' : '#FEF3C7' }]}>
            <Text style={[styles.noticeText, { color: colors.warning }]}>Vehicle fleet is currently operating in cached mode.</Text>
          </View>
        )}

        {/* Special Offer Promo Card */}
        <View style={[styles.promoCard, { backgroundColor: isDark ? '#18181B' : '#09090B' }, FloatingShadow]}>
          <View style={styles.promoTextCol}>
            <Text style={styles.promoEyebrow}>SPECIAL OFFER</Text>
            <Text style={styles.promoHeading}>Get 20% Off</Text>
            <Text style={styles.promoDescription}>On your first luxury car rental</Text>
            <View style={styles.promoAction}>
              <Text style={styles.promoActionText}>Book Now →</Text>
            </View>
          </View>
          <View style={styles.promoBadge}>
            <ShieldCheck size={28} color="#E2E8F0" />
          </View>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Cars</Text>
          <Text style={[styles.seeAllText, { color: colors.textMuted }]}>
            {filteredVehicles.length} available →
          </Text>
        </View>

        {filteredVehicles.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <CarFront size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No cars match your criteria</Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>Try selecting &apos;All&apos; categories or clear search.</Text>
          </View>
        )}

        {filteredVehicles.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/rental-details', params: { id: vehicle.id } })}
            style={({ pressed }) => [
              styles.vehicleCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              CardShadow,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.carThumbBox, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}>
              {vehicle.cover_image ? (
                <Image source={{ uri: vehicle.cover_image }} style={styles.carImage} contentFit="cover" transition={200} />
              ) : (
                <CarFront size={32} color={isDark ? '#A1A1AA' : '#64748B'} strokeWidth={1.8} />
              )}
            </View>

            <View style={styles.cardDetails}>
              <Text style={[styles.vehicleName, { color: colors.text }]} numberOfLines={1}>
                {vehicle.make} {vehicle.model}
              </Text>
              <Text style={[styles.vehicleMeta, { color: colors.textMuted }]}>
                {vehicle.category?.name || 'Luxury'} • {vehicle.seats} Seats
              </Text>

              {/* Spec Pills */}
              <View style={styles.specPillsRow}>
                <View style={[styles.specPill, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
                  <Gauge size={11} color={colors.textSecondary} />
                  <Text style={[styles.specPillText, { color: colors.textSecondary }]}>Auto</Text>
                </View>
                <View style={[styles.specPill, { backgroundColor: isDark ? '#27272A' : '#F8FAFC' }]}>
                  <Users size={11} color={colors.textSecondary} />
                  <Text style={[styles.specPillText, { color: colors.textSecondary }]}>{vehicle.fuel_type || 'Petrol'}</Text>
                </View>
              </View>

              {/* Price and Action Button */}
              <View style={styles.priceActionRow}>
                <Text style={[styles.priceTag, { color: colors.text }]}>
                  ₹{Number(vehicle.base_fare).toLocaleString('en-IN')}
                  <Text style={[styles.perDayText, { color: colors.textMuted }]}> /day</Text>
                </Text>
                <View style={[styles.circleArrowBtn, { backgroundColor: isDark ? '#FFFFFF' : '#09090B' }]}>
                  <ArrowRight size={14} color={isDark ? '#09090B' : '#FFFFFF'} strokeWidth={2.4} />
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...Typography.body },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 12,
  },
  searchBar: {
    height: 50,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '500',
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
    gap: 14,
  },
  notice: {
    minHeight: 40,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  noticeText: { fontSize: 12, fontWeight: '700' },
  promoCard: {
    borderRadius: Radius.card,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoTextCol: { gap: 4, flex: 1 },
  promoEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  promoHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  promoDescription: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 6,
  },
  promoAction: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  promoActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },
  promoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { marginTop: 6, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  vehicleCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pressed: { opacity: 0.8 },
  carThumbBox: {
    width: 96,
    height: 84,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImage: { width: '100%', height: '100%' },
  cardDetails: { flex: 1, gap: 4 },
  vehicleName: { fontSize: 16, fontWeight: '800' },
  vehicleMeta: { fontSize: 12, fontWeight: '500' },
  specPillsRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  specPillText: { fontSize: 11, fontWeight: '600' },
  priceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceTag: { fontSize: 15, fontWeight: '900' },
  perDayText: { fontSize: 11, fontWeight: '500' },
  circleArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
