import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, ArrowRight, CarFront, Check, Fuel, Gauge,
  Heart, Headphones, ShieldCheck, Share2, Star, Users
} from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { CardShadow, FloatingShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

export default function RentalDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const load = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    try {
      const response = await api.get(`/public/rental-vehicles/${id}`);
      setVehicle(response.data?.data);
      setError('');
    } catch (requestError) {
      setVehicle(null);
      setError(apiErrorMessage(requestError, 'This vehicle is no longer available for rent.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${vehicle?.make} ${vehicle?.model} on Turiya Mobility!`,
      });
    } catch {
      // Ignored
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={isDark ? '#FFFFFF' : '#09090B'} />
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading vehicle details…</Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Couldn’t open this car</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>{error}</Text>
        <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: colors.brand }]}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const category = vehicle.category || {};
  const images = Array.isArray(vehicle.images) && vehicle.images.length > 0
    ? vehicle.images
    : vehicle.cover_image
    ? [vehicle.cover_image]
    : [];
  const features = Array.isArray(category.features) ? category.features : [];

  const book = () => router.push({
    pathname: '/rental-checkout',
    params: {
      vehicleId: vehicle.id,
      categoryId: category.id,
      categoryName: `${vehicle.make} ${vehicle.model}`,
      basePrice: vehicle.base_fare,
    },
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={[styles.headerIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Car Details</Text>
        <View style={styles.headerRightActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsFavorite(!isFavorite)}
            style={[styles.headerIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Heart size={18} color={isFavorite ? '#EF4444' : colors.text} fill={isFavorite ? '#EF4444' : 'none'} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleShare}
            style={[styles.headerIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Share2 size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Car Showcase with Photo Counter Badge */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? '#18181B' : '#F1F5F9' }]}>
          {images.length > 0 ? (
            <Image
              source={{ uri: images[activeImageIndex] || images[0] }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <CarFront size={68} color={isDark ? '#71717A' : '#94A3B8'} strokeWidth={1.4} />
          )}
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>
              {activeImageIndex + 1}/{Math.max(images.length, 1)}
            </Text>
          </View>
        </View>

        {/* Thumbnail row if multiple images exist */}
        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {images.map((image: string, idx: number) => (
              <Pressable
                key={image}
                onPress={() => setActiveImageIndex(idx)}
                style={[
                  styles.thumbWrap,
                  { borderColor: activeImageIndex === idx ? (isDark ? '#FFFFFF' : '#09090B') : colors.border },
                ]}
              >
                <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Title and Subtitle */}
        <View style={styles.titleSection}>
          <Text style={[styles.carTitle, { color: colors.text }]}>{vehicle.make} {vehicle.model}</Text>
          <Text style={[styles.carSubtitle, { color: colors.textSecondary }]}>
            {category.name || 'Sports Car'} • {vehicle.seats} Seats • {vehicle.fuel_type || 'Petrol'}
          </Text>
        </View>

        {/* 3-Column Specifications Grid from Image 1 */}
        <View style={styles.specGrid}>
          <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
            <Gauge size={22} color={colors.text} strokeWidth={2} />
            <Text style={[styles.specValue, { color: colors.text }]}>Auto</Text>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>Transmission</Text>
          </View>
          <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
            <Fuel size={22} color={colors.text} strokeWidth={2} />
            <Text style={[styles.specValue, { color: colors.text }]}>{vehicle.fuel_type || 'Petrol'}</Text>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>Fuel</Text>
          </View>
          <View style={[styles.specCard, { backgroundColor: colors.surface, borderColor: colors.border }, CardShadow]}>
            <Users size={22} color={colors.text} strokeWidth={2} />
            <Text style={[styles.specValue, { color: colors.text }]}>{vehicle.seats} Seats</Text>
            <Text style={[styles.specLabel, { color: colors.textMuted }]}>Capacity</Text>
          </View>
        </View>

        {/* Price and Rating Row */}
        <View style={[styles.priceRatingRow, { borderColor: colors.border }]}>
          <View>
            <Text style={[styles.priceTag, { color: colors.text }]}>
              ₹{Number(vehicle.base_fare || 0).toLocaleString('en-IN')}
              <Text style={[styles.perDaySub, { color: colors.textMuted }]}> /day</Text>
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Star size={16} color="#F59E0B" fill="#F59E0B" />
            <Text style={[styles.ratingScore, { color: colors.text }]}>4.9</Text>
            <Text style={[styles.ratingCount, { color: colors.textMuted }]}>(124 reviews)</Text>
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.descriptionSection}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Description</Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {category.description ||
              `The ${vehicle.make} ${vehicle.model} combines breathtaking performance with iconic design. Perfect for those who want to experience the thrill of the road with absolute comfort.`}
          </Text>
        </View>

        {/* Trust and Guarantee Badges from Image 1 */}
        <View style={styles.guaranteeRow}>
          <View style={[styles.guaranteeBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Check size={16} color={colors.success} strokeWidth={2.4} />
            <Text style={[styles.guaranteeText, { color: colors.text }]}>Free Cancellation</Text>
          </View>
          <View style={[styles.guaranteeBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Headphones size={16} color={colors.brand} strokeWidth={2.2} />
            <Text style={[styles.guaranteeText, { color: colors.text }]}>24/7 Support</Text>
          </View>
          <View style={[styles.guaranteeBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ShieldCheck size={16} color="#3B82F6" strokeWidth={2.2} />
            <Text style={[styles.guaranteeText, { color: colors.text }]}>Full Insurance</Text>
          </View>
        </View>

        {/* Included Features Checklist */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Vehicle Highlights</Text>
          {(features.length ? features : ['Verified Host Car', 'Instant Confirmation', 'Sanitized & Inspected', 'Unlimited Km Plan']).map((feature: string) => (
            <View key={feature} style={styles.featureItem}>
              <Check size={16} color={colors.success} strokeWidth={2.4} />
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar with Rent Now CTA */}
      <View style={[styles.stickyFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={book}
          style={({ pressed }) => [
            styles.rentNowBtn,
            { backgroundColor: isDark ? '#FFFFFF' : '#09090B' },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.rentNowText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>Rent Now</Text>
          <ArrowRight size={18} color={isDark ? '#09090B' : '#FFFFFF'} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  header: {
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerRightActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: { padding: Spacing.md, paddingBottom: 110, gap: 16 },
  heroCard: {
    height: 240,
    borderRadius: Radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  counterBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  counterBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  gallery: { gap: 10, paddingVertical: 4 },
  thumbWrap: {
    width: 80,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
  },
  thumb: { width: '100%', height: '100%' },
  titleSection: { gap: 4 },
  carTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  carSubtitle: { fontSize: 14, fontWeight: '500' },
  specGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  specCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  specValue: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  specLabel: { fontSize: 11, fontWeight: '600' },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceTag: { fontSize: 26, fontWeight: '900' },
  perDaySub: { fontSize: 14, fontWeight: '500' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingScore: { fontSize: 14, fontWeight: '800' },
  ratingCount: { fontSize: 13, fontWeight: '500' },
  descriptionSection: { gap: 8 },
  sectionHeading: { fontSize: 18, fontWeight: '800' },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  guaranteeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guaranteeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  guaranteeText: { fontSize: 12, fontWeight: '700' },
  sectionCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, fontWeight: '500' },
  retry: {
    minHeight: 46,
    borderRadius: Radius.pill,
    paddingHorizontal: 24,
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  rentNowBtn: {
    height: 56,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  rentNowText: { fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.82 },
  title: { ...Typography.display },
  copy: { ...Typography.body, marginTop: 8 },
});
