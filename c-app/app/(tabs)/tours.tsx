import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ArrowLeft,
  Calendar,
  Clock3,
  Compass,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimeField from '../../components/DateTimeField';
import { localDateValue } from '../../src/lib/dates';
import api, { apiErrorMessage } from '../../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../../src/constants/theme';

interface Tour {
  id: number;
  title: string;
  overview?: string;
  description?: string;
  short_description?: string;
  price_per_person: string | number;
  duration_days: number;
  cover_image?: string;
  start_location?: string;
  end_location?: string;
  region?: string;
  rating?: number | null;
  next_departure_at?: string;
  available_seats?: number | null;
  schedules?: any[];
}

interface Destination {
  id: number;
  name: string;
  city?: string;
  state?: string;
  cover_image?: string;
  rating?: number | null;
}

type PriceFilter = 'all' | 'under_5k' | '5k_to_15k' | 'above_15k';
type DurationFilter = 'all' | 'day_trip' | '2_3_days' | '4_plus_days';
type SortOption = 'departure' | 'availability' | 'price_asc' | 'price_desc' | 'duration';

const CACHE_KEY_FILTERS = 'cached_tour_filters';

export default function ToursScreen({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    destination?: string;
    destination_id?: string;
    destinationId?: string;
  }>();
  const { colors, isDark } = useTheme();

  const [tours, setTours] = useState<Tour[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const initialDestId = routeParams.destination_id
    ? Number(routeParams.destination_id)
    : routeParams.destinationId
    ? Number(routeParams.destinationId)
    : null;

  // Search and destination filter state
  const [searchQuery, setSearchQuery] = useState(initialDestId ? '' : (routeParams.destination || ''));
  const [debouncedQuery, setDebouncedQuery] = useState(initialDestId ? '' : (routeParams.destination || ''));
  const [selectedDestinationId, setSelectedDestinationId] = useState<number | null>(
    initialDestId && !Number.isNaN(initialDestId) ? initialDestId : null
  );
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [resultPage, setResultPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [minRating, setMinRating] = useState<number | null>(null);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('departure');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filtersBottom, setFiltersBottom] = useState(0);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  // Sync route params when navigated with ?destination_id=... or ?destination=...
  useEffect(() => {
    if (routeParams.destination_id || routeParams.destinationId) {
      const parsedId = Number(routeParams.destination_id || routeParams.destinationId);
      if (!Number.isNaN(parsedId)) {
        setSelectedDestinationId(parsedId);
      }
    }
    if (routeParams.destination && !routeParams.destination_id && !routeParams.destinationId) {
      setSearchQuery(routeParams.destination);
      setDebouncedQuery(routeParams.destination);
    }
  }, [routeParams.destination, routeParams.destination_id, routeParams.destinationId]);

  // Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Restore filter state from AsyncStorage on initial load
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY_FILTERS).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.priceFilter) setPriceFilter(parsed.priceFilter);
          if (parsed.minRating !== undefined) setMinRating(parsed.minRating);
          if (parsed.durationFilter) setDurationFilter(parsed.durationFilter);
          if (['departure', 'availability', 'price_asc', 'price_desc', 'duration'].includes(parsed.sortBy)) setSortBy(parsed.sortBy);
        } catch {}
      }
    });
  }, []);

  // Save filter state to AsyncStorage whenever changed
  useEffect(() => {
    const payload = {
      priceFilter,
      minRating,
      durationFilter,
      sortBy,
    };
    AsyncStorage.setItem(CACHE_KEY_FILTERS, JSON.stringify(payload)).catch(() => {});
  }, [priceFilter, minRating, durationFilter, sortBy]);

  const requestVersion = useRef(0);
  const pendingPage = useRef(false);
  const invalidateRequests = useCallback(() => {
    requestVersion.current++;
    pendingPage.current = false;
  }, []);

  useEffect(() => {
    api.get('/public/destinations').then(response => setDestinations(response.data?.data || [])).catch(() => {});
  }, []);

  // Every filter is applied by the database before pagination.
  const fetchTours = useCallback(async (refresh = false, page = 1) => {
    if (page > 1 && pendingPage.current) return;
    const version = ++requestVersion.current;
    pendingPage.current = true;
    setMessage(null);
    if (page === 1) {
      setTours([]); setHasMore(false); setTotalCount(0); setResultPage(1);
      setLoading(!refresh); setRefreshing(refresh); setLoadingMore(false);
    } else setLoadingMore(true);
    try {
      const response = await api.get('/public/tours', { params: {
        q: debouncedQuery.trim() || undefined,
        destination_id: selectedDestinationId || undefined,
        date: departureDate ? localDateValue(departureDate) : undefined,
        price_range: priceFilter,
        duration: durationFilter,
        min_rating: minRating ?? undefined,
        sort: sortBy,
        page, per_page: 10,
      } });
      if (version !== requestVersion.current) return;
      const items: Tour[] = response.data.data;
      const pagination = response.data.pagination;
      setTours(previous => page === 1 ? items : [...previous, ...items.filter(item => !previous.some(existing => existing.id === item.id))]);
      setResultPage(pagination.current_page);
      setHasMore(pagination.current_page < pagination.last_page);
      setTotalCount(pagination.total);
    } catch (requestError) {
      if (version === requestVersion.current) setMessage(apiErrorMessage(requestError, 'Could not load tours. Please retry.'));
    } finally {
      if (version === requestVersion.current) {
        pendingPage.current = false;
        setLoading(false); setRefreshing(false); setLoadingMore(false);
      }
    }
  }, [debouncedQuery, selectedDestinationId, departureDate, priceFilter, durationFilter, minRating, sortBy]);

  useEffect(() => {
    void fetchTours();
    return invalidateRequests;
  }, [fetchTours, invalidateRequests]);

  // Handle clicking a destination from the rail (relational DB filter toggle)
  const onSelectDestination = (destination: Destination) => {
    if (selectedDestinationId === destination.id) {
      // Toggle off if already active
      setSelectedDestinationId(null);
    } else {
      setSelectedDestinationId(destination.id);
    }
  };

  // Reset all filters
  const resetAllFilters = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setDepartureDate(null);
    setSelectedDestinationId(null);
    setPriceFilter('all');
    setMinRating(null);
    setDurationFilter('all');
    setSortBy('departure');
  };

  // Calculate active filter count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedDestinationId !== null) count++;
    if (departureDate) count++;
    if (priceFilter !== 'all') count++;
    if (minRating !== null) count++;
    if (durationFilter !== 'all') count++;
    if (sortBy !== 'departure') count++;
    return count;
  }, [selectedDestinationId, departureDate, priceFilter, minRating, durationFilter, sortBy]);

  const openTour = (tour: Tour) =>
    router.push({ pathname: '/tour-details', params: { id: tour.id } });

  if (loading && tours.length === 0 && destinations.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Finding memorable journeys…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => setShowStickyHeader(filtersBottom > 0 && nativeEvent.contentOffset.y >= filtersBottom)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchTours(true)} tintColor={colors.brand} colors={[colors.brand]} />}
      >
      {/* Travel Blue Curved Hero Banner inspired by Image 2 */}
      <View
        style={[
          styles.travelHeroBanner,
          { backgroundColor: isDark ? '#1E3A8A' : '#2563EB' },
        ]}
        onLayout={({ nativeEvent }) => setFiltersBottom(nativeEvent.layout.y + nativeEvent.layout.height)}
      >
        <View style={styles.travelHeroTopRow}>
          {!embedded && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
              style={styles.travelBackBtn}
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.travelHeroTitle}>Enjoy your journey without limits</Text>
            <Text style={styles.travelHeroSub}>Find destinations and exciting experiences</Text>
          </View>
        </View>

        {/* Search Input Bar (White Pill with Filter button) */}
        <View style={styles.travelSearchBar}>
          <Search size={18} color="#64748B" strokeWidth={2.2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search destinations, tours, places…"
            placeholderTextColor="#94A3B8"
            style={styles.travelSearchInput}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery('')}
              style={styles.clearBtn}
            >
              <X size={16} color="#64748B" />
            </Pressable>
          )}
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            style={styles.searchFilterIconBtn}
          >
            <SlidersHorizontal size={14} color="#2563EB" strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Quick Travel Categories Grid from Image 2 */}
        <View style={styles.travelCategoryGrid}>
          <Pressable
            onPress={() => setSearchQuery('Adventure')}
            style={[styles.travelCategoryCard, { backgroundColor: colors.surface }]}
          >
            <Compass size={18} color={isDark ? '#60A5FA' : '#2563EB'} />
            <Text style={[styles.travelCategoryLabel, { color: colors.text }]}>To Do</Text>
          </Pressable>
          <Pressable
            onPress={() => setSearchQuery('Hill Station')}
            style={[styles.travelCategoryCard, { backgroundColor: colors.surface }]}
          >
            <MapPin size={18} color={isDark ? '#F59E0B' : '#D97706'} />
            <Text style={[styles.travelCategoryLabel, { color: colors.text }]}>Destinations</Text>
          </Pressable>
          <Pressable
            onPress={() => setSearchQuery('Heritage')}
            style={[styles.travelCategoryCard, { backgroundColor: colors.surface }]}
          >
            <Clock3 size={18} color={isDark ? '#34D399' : '#059669'} />
            <Text style={[styles.travelCategoryLabel, { color: colors.text }]}>Curated</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/tour-invitations')}
            style={[styles.travelCategoryCard, { backgroundColor: colors.surface }]}
          >
            <Check size={18} color={isDark ? '#A78BFA' : '#7C3AED'} />
            <Text style={[styles.travelCategoryLabel, { color: colors.text }]}>Invites</Text>
          </Pressable>
        </View>
      </View>

        {/* Quick Filter & Sort Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRail}
        >
          {/* Main Filter Trigger */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setFilterModalVisible(true)}
            style={[
              styles.filterTriggerChip,
              {
                backgroundColor: activeFiltersCount > 0 ? colors.brandSoft : colors.surface,
                borderColor: activeFiltersCount > 0 ? colors.brand : colors.border,
              },
            ]}
          >
            <SlidersHorizontal
              size={14}
              color={activeFiltersCount > 0 ? colors.brand : colors.text}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: activeFiltersCount > 0 ? colors.brand : colors.text, fontWeight: '800' },
              ]}
            >
              Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
            </Text>
          </Pressable>

          {/* Quick Price: Under 5k */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setPriceFilter(priceFilter === 'under_5k' ? 'all' : 'under_5k')}
            style={[
              styles.chipPill,
              {
                backgroundColor: priceFilter === 'under_5k' ? colors.brandSoft : colors.surface,
                borderColor: priceFilter === 'under_5k' ? colors.brand : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: priceFilter === 'under_5k' ? colors.brand : colors.textSecondary },
              ]}
            >
              Under ₹5k
            </Text>
          </Pressable>

          {/* Quick Rating: 4.5+ */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setMinRating(minRating === 4.5 ? null : 4.5)}
            style={[
              styles.chipPill,
              {
                backgroundColor: minRating === 4.5 ? colors.brandSoft : colors.surface,
                borderColor: minRating === 4.5 ? colors.brand : colors.border,
              },
            ]}
          >
            <Star
              size={12}
              color={minRating === 4.5 ? '#f59e0b' : colors.textMuted}
              fill={minRating === 4.5 ? '#f59e0b' : 'transparent'}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: minRating === 4.5 ? colors.brand : colors.textSecondary },
              ]}
            >
              4.5+ ★
            </Text>
          </Pressable>

          {/* Quick Duration: 2-3 Days */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setDurationFilter(durationFilter === '2_3_days' ? 'all' : '2_3_days')}
            style={[
              styles.chipPill,
              {
                backgroundColor: durationFilter === '2_3_days' ? colors.brandSoft : colors.surface,
                borderColor: durationFilter === '2_3_days' ? colors.brand : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: durationFilter === '2_3_days' ? colors.brand : colors.textSecondary },
              ]}
            >
              2–3 Days
            </Text>
          </Pressable>

          {/* Quick Duration: 4+ Days */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setDurationFilter(durationFilter === '4_plus_days' ? 'all' : '4_plus_days')}
            style={[
              styles.chipPill,
              {
                backgroundColor: durationFilter === '4_plus_days' ? colors.brandSoft : colors.surface,
                borderColor: durationFilter === '4_plus_days' ? colors.brand : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: durationFilter === '4_plus_days' ? colors.brand : colors.textSecondary },
              ]}
            >
              4+ Days
            </Text>
          </Pressable>

          {/* Quick Clear All */}
          {(activeFiltersCount > 0 || searchQuery.length > 0) && (
            <Pressable
              accessibilityRole="button"
              onPress={resetAllFilters}
              style={[styles.resetChip, { backgroundColor: colors.accentSoft }]}
            >
              <X size={13} color={colors.error} />
              <Text style={[styles.resetChipText, { color: colors.error }]}>Reset All</Text>
            </Pressable>
          )}
        </ScrollView>

      <View style={styles.content}>
        {loading && <ActivityIndicator color={colors.brand} accessibilityLabel="Loading tours" />}
        {message && (
          <View style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
            <RefreshCw size={16} color={colors.warning} />
            <Text style={[styles.noticeText, { color: colors.warning }]}>{message}</Text>
          </View>
        )}

        {/* Destination Rail */}
        {destinations.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore by Destination</Text>
              {(selectedDestinationId !== null || searchQuery.trim().length > 0) ? (
                <Pressable onPress={() => { setSelectedDestinationId(null); setSearchQuery(''); }}>
                  <Text style={[styles.clearFilterLink, { color: colors.brand }]}>Show all</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.destinationRail}
            >
              {destinations.map((destination) => {
                const isSelected = selectedDestinationId === destination.id;

                return (
                  <Pressable
                    key={destination.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${destination.name}`}
                    onPress={() => onSelectDestination(destination)}
                    style={({ pressed }) => [
                      styles.destinationCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isSelected ? colors.brand : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                      isSelected && { shadowColor: colors.brand, elevation: 4 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.destinationVisual, { backgroundColor: colors.brandSoft }]}>
                      {destination.cover_image ? (
                        <Image
                          source={{ uri: destination.cover_image }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <MapPin size={25} color={colors.brand} />
                      )}
                      {isSelected && (
                        <View style={[styles.selectedBadge, { backgroundColor: colors.brand }]}>
                          <Check size={11} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.destinationName,
                        { color: isSelected ? colors.brand : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {destination.name}
                    </Text>
                    <Text
                      style={[styles.destinationMeta, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {[destination.city, destination.state].filter(Boolean).join(', ') ||
                        'Explore destination'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <DateTimeField label="Departure date" value={departureDate} onChange={setDepartureDate} minimumDate={new Date()} placeholder="Any departure date" clearable />

        {/* Tour List Header & Results Count */}
        <View style={styles.resultsHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Available Tours ({totalCount || tours.length})
          </Text>
          {debouncedQuery ? (
            <Text style={[styles.queryTag, { color: colors.textSecondary }]}>
              for “{debouncedQuery}”
            </Text>
          ) : null}
        </View>

        {/* Tours Grid */}
        {tours.length > 0 ? (
          <View style={styles.tourGrid}>
            {tours.map((tour) => {
              const rating = tour.rating ? Number(tour.rating).toFixed(1) : 'New';
              const locationLabel =
                tour.region ||
                [tour.start_location, tour.end_location].filter(Boolean).join(' → ') ||
                'Curated Itinerary';

              const nextSchedule = Array.isArray(tour.schedules) && tour.schedules.length > 0 ? tour.schedules[0] : null;
              const departureDateText = nextSchedule?.departure_date || (nextSchedule?.departure_at ? nextSchedule.departure_at.split('T')[0] : null);
              const availableSeats = tour.available_seats !== undefined && tour.available_seats !== null
                ? tour.available_seats
                : (nextSchedule?.available_seats ?? null);

              return (
                <Pressable
                  key={tour.id}
                  accessibilityRole="button"
                  accessibilityHint="Opens tour details and itinerary"
                  onPress={() => openTour(tour)}
                  style={({ pressed }) => [
                    styles.tourCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    CardShadow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.tourVisual, { backgroundColor: colors.brandSoft }]}>
                    {tour.cover_image ? (
                      <Image
                        source={{ uri: tour.cover_image }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Compass size={34} color={colors.brand} strokeWidth={1.6} />
                    )}

                    {/* Star Rating Badge */}
                    <View style={styles.cardRatingBadge}>
                      <Star size={11} color="#f59e0b" fill="#f59e0b" />
                      <Text style={styles.cardRatingText}>{rating}</Text>
                    </View>

                    {/* Seats Availability Pill */}
                    {availableSeats !== null && (
                      <View
                        style={[
                          styles.cardAvailabilityBadge,
                          { backgroundColor: availableSeats > 3 ? '#059669' : '#DC2626' },
                        ]}
                      >
                        <Text style={styles.cardAvailabilityText}>
                          {availableSeats > 0 ? `${availableSeats} seats left` : 'Sold out'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.tourBody}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                      {tour.title}
                    </Text>

                    {/* Location Badge */}
                    <View style={styles.tourLocationRow}>
                      <MapPin size={12} color={colors.brand} />
                      <Text
                        style={[styles.tourLocationText, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {locationLabel}
                      </Text>
                    </View>

                    {/* Duration & Upcoming Departure Date */}
                    <View style={styles.tourMeta}>
                      <Clock3 size={13} color={colors.textSecondary} />
                      <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                        {tour.duration_days} days
                      </Text>
                      {departureDateText ? (
                        <>
                          <Text style={{ color: colors.textMuted, marginHorizontal: 4 }}>•</Text>
                          <Calendar size={12} color={colors.textSecondary} />
                          <Text style={[styles.cardDescription, { color: colors.textSecondary, marginLeft: 2 }]}>
                            {departureDateText}
                          </Text>
                        </>
                      ) : null}
                    </View>

                    {/* Price */}
                    <Text style={[styles.cardMeta, { color: colors.brand }]}>
                      ₹{Number(tour.price_per_person).toLocaleString('en-IN')}{' '}
                      <Text style={[styles.perPersonUnit, { color: colors.textSecondary }]}>
                        / person
                      </Text>
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyFilterBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Compass size={40} color={colors.textMuted} />
            <Text style={[styles.emptyFilterTitle, { color: colors.text }]}>
              No tours match your criteria
            </Text>
            <Text style={[styles.emptyFilterCopy, { color: colors.textSecondary }]}>
              Try adjusting your search query, or clear your filters to view all available tours.
            </Text>
            <Pressable
              onPress={resetAllFilters}
              style={[styles.resetButton, { backgroundColor: colors.brand }]}
            >
              <Text style={styles.resetButtonText}>Reset All Filters</Text>
            </Pressable>
          </View>
        )}

        {/* Backend Pagination Footer */}
        {tours.length > 0 && (
          <View style={styles.paginationFooter}>
            {loadingMore ? (
              <View style={styles.loadingMoreRow}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
                  Loading more experiences…
                </Text>
              </View>
            ) : hasMore ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Load more tours"
                onPress={() => void fetchTours(false, resultPage + 1)}
                style={({ pressed }) => [
                  styles.loadMoreButton,
                  { backgroundColor: colors.surface, borderColor: colors.brand },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.loadMoreButtonText, { color: colors.brand }]}>
                  Load More Experiences
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.endOfResultsText, { color: colors.textMuted }]}>
                You’ve explored all {totalCount || tours.length} curated tours
              </Text>
            )}
          </View>
        )}
      </View>
      </ScrollView>

      {showStickyHeader && <View style={[styles.stickyHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {!embedded && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.headerAction}><ArrowLeft size={22} color={colors.text} /></Pressable>}
        <Text numberOfLines={1} style={[styles.stickyTitle, { color: colors.text }]}>Tours & Experiences</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Filters, ${activeFiltersCount} active`} onPress={() => setFilterModalVisible(true)} style={styles.headerAction}><SlidersHorizontal size={22} color={activeFiltersCount ? colors.brand : colors.text} /></Pressable>
      </View>}

      {/* Comprehensive Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Filter & Sort Tours</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilterModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Sort By Section */}
              <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Sort By</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { id: 'departure', label: 'Next departure' },
                  { id: 'availability', label: 'Most seats available' },
                  { id: 'price_asc', label: 'Price: Low to High' },
                  { id: 'price_desc', label: 'Price: High to Low' },
                  { id: 'duration', label: 'Duration: Shortest' },
                ].map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setSortBy(opt.id as SortOption)}
                    style={[
                      styles.modalOptionPill,
                      {
                        backgroundColor: sortBy === opt.id ? colors.brandSoft : colors.background,
                        borderColor: sortBy === opt.id ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: sortBy === opt.id ? colors.brand : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Price Range Section */}
              <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Price Range</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { id: 'all', label: 'All Prices' },
                  { id: 'under_5k', label: 'Under ₹5,000' },
                  { id: '5k_to_15k', label: '₹5,000 – ₹15,000' },
                  { id: 'above_15k', label: 'Above ₹15,000' },
                ].map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setPriceFilter(opt.id as PriceFilter)}
                    style={[
                      styles.modalOptionPill,
                      {
                        backgroundColor: priceFilter === opt.id ? colors.brandSoft : colors.background,
                        borderColor: priceFilter === opt.id ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: priceFilter === opt.id ? colors.brand : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Ratings Section */}
              <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Minimum Rating</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { id: null, label: 'All Ratings' },
                  { id: 4.0, label: '4.0+ Stars' },
                  { id: 4.5, label: '4.5+ Stars' },
                ].map((opt, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setMinRating(opt.id)}
                    style={[
                      styles.modalOptionPill,
                      {
                        backgroundColor: minRating === opt.id ? colors.brandSoft : colors.background,
                        borderColor: minRating === opt.id ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: minRating === opt.id ? colors.brand : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Duration Section */}
              <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Tour Duration</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { id: 'all', label: 'All Durations' },
                  { id: 'day_trip', label: 'Day Tour (≤ 1 day)' },
                  { id: '2_3_days', label: '2–3 Days' },
                  { id: '4_plus_days', label: '4+ Days (Multi-day)' },
                ].map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setDurationFilter(opt.id as DurationFilter)}
                    style={[
                      styles.modalOptionPill,
                      {
                        backgroundColor: durationFilter === opt.id ? colors.brandSoft : colors.background,
                        borderColor: durationFilter === opt.id ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        { color: durationFilter === opt.id ? colors.brand : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ color: colors.textSecondary }}>Only upcoming departures with available seats are shown.</Text>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={resetAllFilters}
                style={[styles.modalResetBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalResetText, { color: colors.textSecondary }]}>
                  Reset All
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterModalVisible(false)}
                style={[styles.modalApplyBtn, { backgroundColor: colors.brand }]}
              >
                <Text style={styles.modalApplyText}>
                  Show {totalCount || tours.length} Tours
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, borderBottomWidth: 1, minHeight: 56 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stickyTitle: { flex: 1, ...Typography.title, fontSize: 19, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...Typography.body },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  eyebrow: { ...Typography.label, letterSpacing: 1 },
  title: { ...Typography.display, fontSize: 24, lineHeight: 28, marginTop: 2 },
  subtitle: { ...Typography.body, fontSize: 13, lineHeight: 18, maxWidth: 360 },
  searchBar: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipsRail: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  filterTriggerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: Radius.pill,
  },
  resetChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
    gap: 12,
  },
  notice: {
    minHeight: 44,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: '700' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitle: { ...Typography.heading, fontSize: 16 },
  clearFilterLink: { fontSize: 12, fontWeight: '800' },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  queryTag: { fontSize: 13, fontStyle: 'italic' },
  destinationRail: { gap: 10, paddingBottom: 4 },
  destinationCard: {
    width: 144,
    borderRadius: Radius.md,
    padding: 8,
    position: 'relative',
  },
  destinationVisual: {
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationName: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  destinationMeta: { fontSize: 10, marginTop: 2, marginBottom: 2 },
  tourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  tourCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  tourVisual: {
    width: '100%',
    aspectRatio: 1.28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cardRatingBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardRatingText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tourBody: { padding: 11, minHeight: 114 },
  cardTitle: { fontSize: 13, fontWeight: '800', lineHeight: 17 },
  tourLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tourLocationText: { fontSize: 10, fontWeight: '600', flex: 1 },
  tourMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  cardDescription: { fontSize: 11 },
  cardMeta: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  perPersonUnit: { fontSize: 10, fontWeight: '500' },
  emptyFilterBox: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  emptyFilterTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  emptyFilterCopy: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  resetButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalBody: { paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  filterGroupTitle: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  filterOptionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalOptionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  modalOptionText: { fontSize: 13, fontWeight: '700' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: { fontSize: 13, fontWeight: '600' },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  modalResetBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetText: { fontSize: 14, fontWeight: '800' },
  modalApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.75 },
  travelHeroBanner: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    gap: 14,
  },
  travelHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  travelBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelHeroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  travelHeroSub: {
    fontSize: 12,
    color: '#DBEAFE',
    marginTop: 2,
    fontWeight: '500',
  },
  travelSearchBar: {
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  travelSearchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  searchFilterIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelCategoryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  travelCategoryCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  travelCategoryLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardAvailabilityBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardAvailabilityText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  paginationFooter: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadMoreButton: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  endOfResultsText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
