import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BedDouble, CalendarDays, Check, ChevronRight, Clock3, FileDown, MapPin, Star, Utensils, X } from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { Radius, Spacing, Typography, useTheme } from '../src/constants/theme';
import SavePlaceButton from '../components/SavePlaceButton';

export default function TourDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'places'>('overview');

  const load = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const response = await api.get(`/public/tours/${id}`);
      setTour(response.data?.data);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Tour details are unavailable.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.brand} /><Text style={{ color: colors.textSecondary }}>Loading tour details…</Text></View>;
  if (!tour) return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text style={[styles.errorTitle, { color: colors.text }]}>Couldn’t open this tour</Text><Text style={[styles.errorCopy, { color: colors.textSecondary }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.retry, { backgroundColor: colors.brand }]}><Text style={styles.buttonText}>Try again</Text></Pressable></View>;

  const book = () => router.push({ pathname: '/tour-checkout', params: { tourId: tour.id, tourTitle: tour.title, price: tour.price_per_person } });

  const openBrochure = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open brochure', 'Please try again or check your connection.');
    }
  };

  const confirmDownloadBrochure = () => {
    const brochureUrl =
      tour?.brochure_url ||
      tour?.generated_brochure_url ||
      (tour?.id ? `${api.defaults.baseURL || ''}/public/tours/${tour.id}/brochure` : null);

    if (!brochureUrl) {
      Alert.alert(
        'Brochure Unavailable',
        'A PDF brochure is not currently available for this tour package.'
      );
      return;
    }

    Alert.alert(
      'Download Brochure',
      `Would you like to download the official PDF brochure and itinerary for "${tour.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Download PDF',
          style: 'default',
          onPress: () => void openBrochure(brochureUrl),
        },
      ]
    );
  };
  const places = Array.isArray(tour.related_places) ? tour.related_places : [];
  const itineraries = Array.isArray(tour.itineraries) ? tour.itineraries : [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Experience Details</Text>
        <SavePlaceButton id={String(tour.id)} kind="tour" />
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} />} contentContainerStyle={styles.content}>
        {/* Full Edge Hero Photo from Image 2 */}
        <View style={[styles.hero, { backgroundColor: isDark ? '#1E293B' : '#DBEAFE' }]}>
          {tour.cover_image ? (
            <Image source={{ uri: tour.cover_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <MapPin size={48} color={colors.brand} />
          )}
          <View style={styles.heroOverlayBadge}>
            <Text style={styles.heroOverlayCategory}>{tour.category?.name || 'EXPLORE'}</Text>
          </View>
        </View>

        {/* Title, Location & Social Proof Card */}
        <View style={styles.titleCard}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text, flex: 1 }]}>{tour.title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Download Brochure"
              accessibilityHint="Confirms before downloading the tour brochure PDF"
              onPress={confirmDownloadBrochure}
              style={({ pressed }) => [
                styles.pdfBrochureBtn,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
                },
                pressed && styles.pressed,
              ]}
            >
              <FileDown size={14} color="#EF4444" strokeWidth={2.4} />
              <Text style={styles.pdfBrochureText}>Brochure</Text>
            </Pressable>
          </View>
          <View style={styles.destinationRow}>
            <MapPin size={15} color={colors.brand} />
            <Text style={[styles.destinationText, { color: colors.textSecondary }]}>
              {tour.region || [tour.start_location, tour.end_location].filter(Boolean).join(' → ') || 'Curated Route'}
            </Text>
          </View>

          {/* Social Proof & Rating Row */}
          <View style={styles.socialProofRow}>
            <View style={styles.avatarGroup}>
              <View style={[styles.travelerAvatar, { backgroundColor: '#3B82F6', zIndex: 3 }]}>
                <Text style={styles.travelerAvatarText}>A</Text>
              </View>
              <View style={[styles.travelerAvatar, { backgroundColor: '#10B981', zIndex: 2, marginLeft: -8 }]}>
                <Text style={styles.travelerAvatarText}>S</Text>
              </View>
              <View style={[styles.travelerAvatar, { backgroundColor: '#F59E0B', zIndex: 1, marginLeft: -8 }]}>
                <Text style={styles.travelerAvatarText}>R</Text>
              </View>
              <Text style={[styles.travelerCountText, { color: colors.textSecondary }]}>11+ Travelled</Text>
            </View>

            <View style={[styles.tourRatingBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Star size={13} color="#f59e0b" fill="#f59e0b" />
              <Text style={[styles.tourRatingText, { color: colors.text }]}>
                {tour.rating ? Number(tour.rating).toFixed(1) : '4.8'}
              </Text>
            </View>
          </View>
        </View>

        {/* Segmented Tabs from Image 2: Overview / Itinerary / Places */}
        <View style={[styles.tabBarContainer, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setActiveTab('overview')}
            style={[styles.segmentTab, activeTab === 'overview' && styles.segmentTabActive]}
          >
            <Text style={[styles.segmentTabText, activeTab === 'overview' ? { color: colors.brand } : { color: colors.textMuted }]}>
              Overview
            </Text>
            {activeTab === 'overview' && <View style={[styles.activeIndicator, { backgroundColor: colors.brand }]} />}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('itinerary')}
            style={[styles.segmentTab, activeTab === 'itinerary' && styles.segmentTabActive]}
          >
            <Text style={[styles.segmentTabText, activeTab === 'itinerary' ? { color: colors.brand } : { color: colors.textMuted }]}>
              Itinerary
            </Text>
            {activeTab === 'itinerary' && <View style={[styles.activeIndicator, { backgroundColor: colors.brand }]} />}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('places')}
            style={[styles.segmentTab, activeTab === 'places' && styles.segmentTabActive]}
          >
            <Text style={[styles.segmentTabText, activeTab === 'places' ? { color: colors.brand } : { color: colors.textMuted }]}>
              Places ({places.length})
            </Text>
            {activeTab === 'places' && <View style={[styles.activeIndicator, { backgroundColor: colors.brand }]} />}
          </Pressable>
        </View>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentBlock}>
            {/* Quick Metrics */}
            <View style={styles.metrics}>
              <Metric icon={CalendarDays} label="Duration" value={`${tour.duration_days || 1} days`} />
              <Metric icon={MapPin} label="Route" value={[tour.start_location, tour.end_location].filter(Boolean).join(' → ') || 'Curated'} />
              <Metric icon={Clock3} label="From" value={`₹${Number(tour.price_per_person || 0).toLocaleString('en-IN')}`} />
            </View>

            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {tour.description || tour.short_description || 'A curated journey with transport and local support.'}
            </Text>

            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Cancellation policy</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {tour.cancellation_policy || 'Contact support for cancellation terms before booking.'}
              </Text>
            </View>



            {(tour.highlights?.length > 0 || tour.inclusions?.length > 0) && (
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What’s included</Text>
                {[...(tour.highlights || []), ...(tour.inclusions || [])].slice(0, 8).map((item: string, index: number) => (
                  <View key={`${item}-${index}`} style={styles.listRow}>
                    <Check size={16} color={colors.success} />
                    <Text style={[styles.listText, { color: colors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
                {(tour.exclusions || []).slice(0, 4).map((item: string, index: number) => (
                  <View key={`${item}-${index}`} style={styles.listRow}>
                    <X size={16} color={colors.error} />
                    <Text style={[styles.listText, { color: colors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 2: ITINERARY */}
        {activeTab === 'itinerary' && (
          <View style={styles.tabContentBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Daily Itinerary</Text>
            {itineraries.length === 0 ? (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Detailed schedule is being finalized for upcoming departures.</Text>
            ) : (
              itineraries.map((stop: any, index: number) => (
                <View key={stop.id || index} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.dayDot, { backgroundColor: colors.brand }]}>
                      <Text style={styles.dayText}>{stop.day_number || index + 1}</Text>
                    </View>
                    {index < itineraries.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={[styles.itineraryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.itineraryTitle, { color: colors.text }]}>{stop.title || stop.place?.name || `Day ${index + 1}`}</Text>
                    {stop.time && <Text style={[styles.itineraryMeta, { color: colors.brand }]}>{stop.time}</Text>}
                    <Text style={[styles.itineraryCopy, { color: colors.textSecondary }]}>{stop.description || stop.details || 'Activities and travel as scheduled.'}</Text>
                    {(stop.accommodation || stop.meals_included?.length > 0) && (
                      <View style={styles.stopMeta}>
                        {stop.accommodation && (
                          <View style={styles.metaPill}>
                            <BedDouble size={14} color={colors.textSecondary} />
                            <Text style={[styles.metaPillText, { color: colors.textSecondary }]}>{stop.accommodation}</Text>
                          </View>
                        )}
                        {stop.meals_included?.length > 0 && (
                          <View style={styles.metaPill}>
                            <Utensils size={14} color={colors.textSecondary} />
                            <Text style={[styles.metaPillText, { color: colors.textSecondary }]}>{stop.meals_included.join(', ')}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: PLACES */}
        {activeTab === 'places' && (
          <View style={styles.tabContentBlock}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Featured Places & Views</Text>
            <Text style={[styles.sectionSubcopy, { color: colors.textSecondary }]}>
              Key destinations visited on this tour. Tap any destination for stories and more departures.
            </Text>
            {places.length === 0 ? (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Place highlights will be loaded shortly.</Text>
            ) : (
              places.map((place: any) => (
                <PlaceCardItem key={place.id} place={place} colors={colors} />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>FROM / PERSON</Text>
          <Text style={[styles.price, { color: colors.text }]}>₹{Number(tour.price_per_person || 0).toLocaleString('en-IN')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={book}
          style={({ pressed }) => [
            styles.bookButton,
            { backgroundColor: isDark ? '#FFFFFF' : '#09090B' },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: isDark ? '#09090B' : '#FFFFFF' }]}>Book Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PlaceCardItem({ place, colors }: { place: any; colors: any }) {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);

  const mediaList = Array.isArray(place.media) ? place.media : [];
  const images = useMemo(() => {
    const list: string[] = [];
    if (place.cover_image) list.push(place.cover_image);
    mediaList.forEach((m: any) => {
      const url = m.url || m.path;
      if (url && !list.includes(url)) list.push(url);
    });
    return list;
  }, [place, mediaList]);

  const openPlace = () => {
    router.push({ pathname: '/place-details', params: { id: place.id } });
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={openPlace}
      style={({ pressed }) => [
        styles.placeCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      {images.length <= 1 ? (
        <View style={[styles.placeHero, { backgroundColor: colors.brandSoft }]}>
          {images[0] ? (
            <Image
              source={{ uri: images[0] }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <MapPin size={32} color={colors.brand} />
          )}
        </View>
      ) : (
        <View style={styles.placeGalleryContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onMomentumScrollEnd={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              const width = e.nativeEvent.layoutMeasurement.width;
              if (width > 0) {
                setActiveIdx(Math.round(offset / width));
              }
            }}
          >
            {images.map((img: string, idx: number) => (
              <View key={idx} style={styles.placeSlide}>
                <Image
                  source={{ uri: img }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.placeGalleryIndicator}>
            <Text style={styles.galleryBadgeText}>
              {activeIdx + 1} / {images.length}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.placeCardContent}>
        <View style={styles.placeTitleRow}>
          <Text style={[styles.placeTitle, { color: colors.text }]} numberOfLines={1}>
            {place.name}
          </Text>
          <ChevronRight size={18} color={colors.brand} />
        </View>
        <Text style={[styles.placeMeta, { color: colors.textSecondary }]}>
          {[place.city, place.state].filter(Boolean).join(', ')}
          {place.rating ? ` · ★ ${place.rating}` : ''}
        </Text>
        {place.short_description ? (
          <Text style={[styles.placeDescSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
            {place.short_description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  const { colors } = useTheme();
  return <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}><Icon size={18} color={colors.brand} /><Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={2}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errorTitle: { ...Typography.title, textAlign: 'center' }, errorCopy: { ...Typography.body, textAlign: 'center' },
  retry: { minHeight: 48, borderRadius: Radius.md, paddingHorizontal: 22, justifyContent: 'center', marginTop: 10 },
  header: { minHeight: 64, paddingHorizontal: Spacing.md, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 112 }, hero: { height: 230, borderRadius: Radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  eyebrowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  eyebrow: { ...Typography.label, letterSpacing: 1 },
  tourRatingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
  tourRatingText: { fontSize: 12, fontWeight: '800' },
  title: { ...Typography.display, marginTop: 6 },
  destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  destinationText: { fontSize: 13, fontWeight: '600' },
  description: { ...Typography.body, marginTop: 10 },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 18 }, metric: { flex: 1, minHeight: 108, borderWidth: 1, borderRadius: Radius.md, padding: 10 },
  metricLabel: { fontSize: 9, fontWeight: '800', marginTop: 8 }, metricValue: { fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 3 },
  section: { borderWidth: 1, borderRadius: Radius.lg, padding: 16, marginTop: 18 }, sectionTitle: { ...Typography.heading, marginBottom: 10 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginVertical: 5 }, listText: { flex: 1, fontSize: 13, lineHeight: 19 },
  sectionHeading: { ...Typography.title, marginTop: 25, marginBottom: 4 },
  sectionSubcopy: { fontSize: 13, marginBottom: 14 },
  timelineRow: { flexDirection: 'row', gap: 11 }, timelineRail: { width: 34, alignItems: 'center' }, dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, dayText: { color: '#fff', fontSize: 12, fontWeight: '900' }, timelineLine: { flex: 1, width: 2, minHeight: 70 },
  itineraryCard: { flex: 1, borderWidth: 1, borderRadius: Radius.md, padding: 14, marginBottom: 12 }, itineraryTitle: { fontSize: 15, fontWeight: '900' }, itineraryMeta: { fontSize: 10, fontWeight: '800', marginTop: 4 }, itineraryCopy: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  stopMeta: { marginTop: 10, gap: 5 }, metaPill: { flexDirection: 'row', gap: 6, alignItems: 'center' }, metaPillText: { fontSize: 10, flex: 1 },
  placeCard: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 14 },
  placeHero: { height: 160, width: '100%', alignItems: 'center', justifyContent: 'center' },
  placeGalleryContainer: { height: 170, width: '100%', position: 'relative' },
  placeSlide: { width: Dimensions.get('window').width - Spacing.md * 2 - 2, height: 170 },
  placeGalleryIndicator: { position: 'absolute', bottom: 10, right: 12, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  galleryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  placeCardContent: { padding: 12 },
  placeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  placeMeta: { fontSize: 12, marginTop: 3 },
  placeDescSnippet: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 82, borderTopWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontSize: 9, fontWeight: '800' }, price: { fontSize: 18, fontWeight: '900', marginTop: 2 }, bookButton: { minWidth: 150, minHeight: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '900' }, pressed: { opacity: 0.75 },
  heroOverlayBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  heroOverlayCategory: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleCard: {
    paddingVertical: 4,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  pdfBrochureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: 4,
  },
  pdfBrochureText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  socialProofRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  travelerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  travelerAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  travelerCountText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabBarContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  segmentTabActive: {},
  segmentTabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
  },
  tabContentBlock: {
    gap: 14,
    paddingTop: 8,
  },
});
