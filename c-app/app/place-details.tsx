import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  Heart,
  MapPin,
  Sparkles,
  Star,
} from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlaceMedia {
  id: number;
  url?: string;
  path?: string;
  caption?: string;
  type?: string;
}

interface RelatedTour {
  id: number;
  title: string;
  duration_days: number;
  price_per_person: number | string;
  cover_image?: string;
  start_location?: string;
  end_location?: string;
}

interface PlaceData {
  id: number;
  name: string;
  description?: string;
  short_description?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  rating?: number;
  review_count?: number;
  cover_image?: string;
  tags?: string[];
}

export default function PlaceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [place, setPlace] = useState<PlaceData | null>(null);
  const [media, setMedia] = useState<PlaceMedia[]>([]);
  const [activeTours, setActiveTours] = useState<RelatedTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);

  // Load place details from API
  const loadPlace = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    setError('');

    try {
      let response;
      try {
        response = await api.get(`/public/destinations/${id}`);
      } catch {
        response = await api.get(`/public/places/${id}`);
      }

      const resData = response.data?.data;
      if (resData) {
        const placeObj = resData.place || resData;
        setPlace(placeObj);
        setMedia(Array.isArray(resData.media) ? resData.media : []);
        setActiveTours(Array.isArray(resData.active_tours) ? resData.active_tours.slice(0, 5) : []);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Place details are currently unavailable.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setWishlistReady(false);
    api.post('/wishlists/toggle', { service_type: 'destination', service_id: String(id), action: 'check' })
      .then(response => { if (active) { setIsWishlisted(response.data.data.inWishlist); setWishlistReady(true); } })
      .catch(err => { if (active) setError(apiErrorMessage(err, 'Could not load saved status.')); });
    return () => { active = false; };
  }, [id]));

  const toggleWishlist = async () => {
    if (!id || savingWishlist) return;
    setSavingWishlist(true);
    try {
      const response = await api.post('/wishlists/toggle', {
        service_type: 'destination', service_id: String(id), action: wishlistReady ? (isWishlisted ? 'remove' : 'add') : 'check',
      });
      setIsWishlisted(response.data.data.inWishlist);
      setWishlistReady(true);
      setError('');
    } catch (err) { setError(apiErrorMessage(err, 'Could not save this place.')); }
    finally { setSavingWishlist(false); }
  };

  useEffect(() => {
    void loadPlace();
  }, [loadPlace]);

  // Aggregate images for the carousel
  const images = useMemo(() => {
    const list: string[] = [];
    if (place?.cover_image) list.push(place.cover_image);
    media.forEach((item) => {
      const uri = item.url || item.path;
      if (uri && !list.includes(uri)) list.push(uri);
    });
    return list;
  }, [place, media]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setActiveImageIndex(index);
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Discovering place details…
        </Text>
      </View>
    );
  }

  if (!place) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Compass size={48} color={colors.textMuted} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Could not load place</Text>
        <Text style={[styles.errorCopy, { color: colors.textSecondary }]}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadPlace()}
          style={[styles.retryBtn, { backgroundColor: colors.brand }]}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const locationText = [place.city, place.state, place.country].filter(Boolean).join(', ');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Floating Bar */}
      <View style={styles.floatingHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)' }]}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wishlist"
            onPress={toggleWishlist}
          disabled={savingWishlist}
            style={[styles.iconButton, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)' }]}
          >
            <Heart
              size={20}
              color={isWishlisted ? colors.error : colors.text}
              fill={isWishlisted ? colors.error : 'transparent'}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPlace(true)}
            tintColor={colors.brand}
          />
        }
      >
        {/* Hero Carousel */}
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, padding: 16 }}>{error}</Text>}
        <View style={styles.carouselContainer}>
          {images.length > 0 ? (
            <>
              <FlatList
                data={images}
                keyExtractor={(_, index) => `hero-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={styles.heroImage}
                    contentFit="cover"
                    transition={250}
                  />
                )}
              />
              {images.length > 1 && (
                <View style={styles.indicatorBadge}>
                  <Text style={styles.indicatorText}>
                    {activeImageIndex + 1} / {images.length}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: colors.brandSoft }]}>
              <MapPin size={48} color={colors.brand} />
            </View>
          )}
        </View>

        {/* Place Information */}
        <View style={styles.infoCard}>
          <Text style={[styles.placeName, { color: colors.text }]}>{place.name}</Text>

          {locationText ? (
            <View style={styles.locationRow}>
              <MapPin size={15} color={colors.brand} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                {locationText}
              </Text>
            </View>
          ) : null}

          {/* Key Metrics Row */}
          <View style={styles.metricsRow}>
            {place.rating ? (
              <View style={[styles.metricChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text style={[styles.metricText, { color: colors.text }]}>
                  {place.rating.toFixed(1)}
                  {place.review_count ? ` (${place.review_count} reviews)` : ''}
                </Text>
              </View>
            ) : null}
            <View style={[styles.metricChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Clock size={14} color={colors.brand} />
              <Text style={[styles.metricText, { color: colors.text }]}>
                2–4 hours visit
              </Text>
            </View>
            <View style={[styles.metricChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Sparkles size={14} color={colors.brand} />
              <Text style={[styles.metricText, { color: colors.text }]}>
                Top Landmark
              </Text>
            </View>
          </View>

          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {place.tags.map((tag, idx) => (
                <View
                  key={idx}
                  style={[styles.tagPill, { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={[styles.tagText, { color: colors.brand }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description Section */}
          <View style={styles.sectionDivider} />
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Overview & Story</Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {place.description || place.short_description || 'Immerse yourself in the rich history and culture of this destination.'}
          </Text>

          {/* Related Tours Section */}
          <View style={styles.sectionDivider} />
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Tours Including This Destination
          </Text>
          <Text style={[styles.sectionSubheading, { color: colors.textSecondary }]}>
            Book a complete guided trip featuring {place.name} with vetted local guides.
          </Text>

          {activeTours.length > 0 ? (
            <View style={styles.relatedToursList}>
              {activeTours.map((tour) => (
                <Pressable
                  key={tour.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/tour-details', params: { id: tour.id } })}
                  style={({ pressed }) => [
                    styles.relatedTourCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    CardShadow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.tourThumb, { backgroundColor: colors.brandSoft }]}>
                    {tour.cover_image ? (
                      <Image
                        source={{ uri: tour.cover_image }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Compass size={24} color={colors.brand} />
                    )}
                  </View>
                  <View style={styles.tourInfo}>
                    <Text style={[styles.relatedTourTitle, { color: colors.text }]} numberOfLines={2}>
                      {tour.title}
                    </Text>
                    <View style={styles.tourMetaRow}>
                      <Clock size={12} color={colors.textSecondary} />
                      <Text style={[styles.tourDurationText, { color: colors.textSecondary }]}>
                        {tour.duration_days} days
                      </Text>
                    </View>
                    <Text style={[styles.tourPrice, { color: colors.brand }]}>
                      ₹{Number(tour.price_per_person).toLocaleString('en-IN')}
                      <Text style={[styles.perPersonText, { color: colors.textSecondary }]}> / person</Text>
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyToursBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Calendar size={28} color={colors.textMuted} />
              <Text style={[styles.emptyToursTitle, { color: colors.text }]}>No tours scheduled yet</Text>
              <Text style={[styles.emptyToursCopy, { color: colors.textSecondary }]}>
                Check back soon or explore our tours catalog for other exciting journeys.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={toggleWishlist}
          disabled={savingWishlist}
          style={[styles.wishlistBottomBtn, { borderColor: colors.border }]}
        >
          <Heart
            size={20}
            color={isWishlisted ? colors.error : colors.text}
            fill={isWishlisted ? colors.error : 'transparent'}
          />
          <Text style={[styles.wishlistBottomText, { color: colors.text }]}>
            {isWishlisted ? 'Saved' : 'Wishlist'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (activeTours.length > 0) {
              router.push({ pathname: '/tour-details', params: { id: activeTours[0].id } });
            } else {
              router.push({
                pathname: '/(tabs)/tours',
                params: place ? { destination_id: String(place.id), destination: place.name } : undefined,
              });
            }
          }}
          style={({ pressed }) => [
            styles.bookCtaBtn,
            { backgroundColor: colors.brand },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.bookCtaText}>
            {activeTours.length > 0 ? 'View Featured Tour' : 'Explore Tours'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { ...Typography.body, marginTop: 8 },
  errorTitle: { ...Typography.title, marginTop: 12, textAlign: 'center' },
  errorCopy: { ...Typography.body, marginTop: 4, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, minHeight: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  floatingHeader: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollContent: { paddingBottom: 110 },
  carouselContainer: { width: SCREEN_WIDTH, height: 290, position: 'relative' },
  heroImage: { width: SCREEN_WIDTH, height: 290 },
  heroPlaceholder: { width: SCREEN_WIDTH, height: 290, alignItems: 'center', justifyContent: 'center' },
  indicatorBadge: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  indicatorText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  infoCard: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  placeName: { fontSize: 24, fontWeight: '900', lineHeight: 30 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  locationText: { fontSize: 14, fontWeight: '500' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  metricText: { fontSize: 12, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tagPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  tagText: { fontSize: 11, fontWeight: '800' },
  sectionDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 18 },
  sectionHeading: { ...Typography.heading, fontSize: 18, marginBottom: 4 },
  sectionSubheading: { fontSize: 13, marginBottom: 14 },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  relatedToursList: { gap: 10, marginTop: 6 },
  relatedTourCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  tourThumb: { width: 84, height: 74, borderRadius: Radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tourInfo: { flex: 1, justifyContent: 'center' },
  relatedTourTitle: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  tourMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tourDurationText: { fontSize: 11, fontWeight: '600' },
  tourPrice: { fontSize: 14, fontWeight: '900', marginTop: 4 },
  perPersonText: { fontSize: 11, fontWeight: '500' },
  emptyToursBox: { borderWidth: 1, borderRadius: Radius.md, padding: 20, alignItems: 'center', gap: 8 },
  emptyToursTitle: { fontSize: 14, fontWeight: '800' },
  emptyToursCopy: { fontSize: 12, textAlign: 'center' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 76,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wishlistBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  wishlistBottomText: { fontSize: 13, fontWeight: '700' },
  bookCtaBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCtaText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.75 },
});
