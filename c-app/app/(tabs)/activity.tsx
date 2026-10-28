import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Car, ChevronRight, Compass, KeyRound, ReceiptText, RotateCcw } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import api, { apiErrorMessage } from '../../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../../src/constants/theme';

type ActivityItem = {
  id: number;
  type: 'Ride' | 'Rental' | 'Tour';
  title: string;
  timestamp: number;
  date: string;
  price: string;
  status: string;
  isActive: boolean;
};

const iconFor = { Ride: Car, Rental: KeyRound, Tour: Compass };
const filters = ['All', 'Rides', 'Tours', 'Rentals'] as const;
type ActivityFilter = typeof filters[number];

export default function ActivityScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const loadedOnce = useRef(false);
  const requestPending = useRef(false);

  const fetchActivity = useCallback(async (refresh = false) => {
    if (requestPending.current) return;
    requestPending.current = true;
    if (refresh) setRefreshing(true);
    else if (!loadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [ridesRes, rentalsRes, toursRes] = await Promise.all([
        api.get('/rides'),
        api.get('/car-rentals'),
        api.get('/tour-bookings'),
      ]);
      const makeItem = (item: any, type: ActivityItem['type'], title: string, amount: unknown): ActivityItem => {
        const timestamp = new Date(item.created_at).getTime();
        return {
          id: item.id,
          type,
          title,
          timestamp,
          date: Number.isNaN(timestamp) ? 'Date unavailable' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp),
          price: `₹${Number(amount || 0).toLocaleString('en-IN')}`,
          status: String(item.status || 'pending'),
          isActive: !['completed', 'cancelled', 'rejected', 'refunded'].includes(String(item.status || 'pending').toLowerCase()),
        };
      };
      const rides = (ridesRes.data?.data?.data || []).map((item: any) => makeItem(item, 'Ride', item.dropoff_location || 'Local ride', item.total_fare));
      const rentals = (rentalsRes.data?.data?.data || []).map((item: any) => makeItem(item, 'Rental', item.car_category?.name || 'Car rental', item.total_price));
      const tours = (toursRes.data?.data?.data || []).map((item: any) => makeItem(item, 'Tour', item.tour?.title || 'Tour booking', item.total_price));
      setActivities([...rides, ...rentals, ...tours].sort((a, b) => b.timestamp - a.timestamp));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'We could not load your activity.'));
    } finally {
      loadedOnce.current = true;
      requestPending.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void fetchActivity();
    const interval = setInterval(() => void fetchActivity(), 15000);
    return () => clearInterval(interval);
  }, [fetchActivity]));

  const visibleActivities = activities.filter((item) => {
    if (filter === 'Rides') return item.type === 'Ride';
    if (filter === 'Tours') return item.type === 'Tour';
    if (filter === 'Rentals') return item.type === 'Rental';
    return true;
  });

  const openActivity = (item: ActivityItem) => {
    if (item.type === 'Ride') {
      router.push({ pathname: '/ride-details', params: { id: item.id } });
      return;
    }

    router.push({
      pathname: '/service-activity',
      params: {
        id: item.id,
        kind: item.type === 'Tour' ? 'tour' : 'rental',
        title: item.title,
        price: item.price,
      },
    });
  };

  const getTypeTheme = (type: ActivityItem['type']) => {
    switch (type) {
      case 'Ride':
        return {
          color: '#F59E0B',
          bg: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
          tag: 'TAXI RIDE',
        };
      case 'Rental':
        return {
          color: isDark ? '#E4E4E7' : '#18181B',
          bg: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F4F4F5',
          tag: 'DRIVELUX',
        };
      case 'Tour':
        return {
          color: '#2563EB',
          bg: isDark ? 'rgba(37, 99, 235, 0.18)' : '#EFF6FF',
          tag: 'TRAVEL TOUR',
        };
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.brand }]}>YOUR JOURNEYS</Text>
        <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Bookings, payments, and travel history.</Text>
      </View>

      <View style={[styles.filters, { backgroundColor: isDark ? colors.surface : '#F1F5F9', borderColor: colors.border }]}>
        {filters.map((option) => {
          const selected = filter === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option)}
              style={({ pressed }) => [
                styles.filter,
                { backgroundColor: selected ? (isDark ? '#27272A' : '#0F172A') : 'transparent' },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterText, { color: selected ? '#fff' : colors.textSecondary }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.brand} /><Text style={[styles.stateCopy, { color: colors.textSecondary }]}>Loading your journeys…</Text></View>
      ) : error ? (
        <StateCard icon={RotateCcw} title="Couldn’t load activity" copy={error} action="Try again" onPress={() => void fetchActivity()} />
      ) : visibleActivities.length === 0 ? (
        <StateCard icon={ReceiptText} title={`No ${filter.toLowerCase()} yet`} copy={filter === 'All' ? 'Your rides, rentals, and tours will appear here after you book.' : `Your ${filter.toLowerCase()} will appear here.`} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchActivity(true)} tintColor={colors.brand} colors={[colors.brand]} />}
        >
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>All Bookings ({visibleActivities.length})</Text>
          {visibleActivities.map((item) => {
            const Icon = iconFor[item.type];
            const theme = getTypeTheme(item.type);
            const isNegative = ['cancelled', 'rejected'].includes(item.status.toLowerCase());
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityHint={`Opens this ${item.type.toLowerCase()} and its current status`}
                key={`${item.type}-${item.id}`}
                onPress={() => openActivity(item)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: item.isActive ? theme.color : colors.border,
                    borderLeftWidth: 4,
                    borderLeftColor: theme.color,
                  },
                  CardShadow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: theme.bg }]}>
                  <Icon size={20} color={theme.color} strokeWidth={2.4} />
                </View>
                <View style={styles.content}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                    {item.isActive && (
                      <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#EF4444' }}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: theme.bg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: theme.color }}>{theme.tag}</Text>
                    </View>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{item.date}</Text>
                  </View>
                  <Text style={[styles.status, { color: isNegative ? colors.error : item.isActive ? colors.brand : colors.success }]}>
                    {item.isActive && item.type === 'Ride' ? 'Tap to track · ' : ''}{item.status.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[styles.price, { color: colors.text }]}>{item.price}</Text>
                  <ChevronRight size={17} color={colors.textMuted} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function StateCard({ icon: Icon, title, copy, action, onPress }: { icon: typeof ReceiptText; title: string; copy: string; action?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.stateIcon, { backgroundColor: colors.brandSoft }]}><Icon size={25} color={colors.brand} /></View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateCopy, { color: colors.textSecondary }]}>{copy}</Text>
      {action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.retry, { backgroundColor: colors.brand }, pressed && styles.pressed]}><Text style={styles.retryText}>{action}</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  eyebrow: { ...Typography.label, letterSpacing: 1 },
  title: { ...Typography.display, marginTop: 4 },
  subtitle: { ...Typography.body, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 110, gap: 10 },
  filters: { minHeight: 48, marginHorizontal: Spacing.md, marginBottom: Spacing.md, padding: 4, borderRadius: Radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'stretch' },
  filter: { flex: 1, minHeight: 40, paddingHorizontal: 4, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 12, fontWeight: '800' },
  sectionLabel: { ...Typography.label, marginLeft: 4, marginBottom: 4 },
  card: { minHeight: 90, borderRadius: Radius.lg, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.72 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardMeta: { fontSize: 11 },
  status: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
  right: { alignItems: 'flex-end', gap: 8 },
  price: { fontSize: 15, fontWeight: '900' },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 70 },
  stateIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { ...Typography.heading, marginTop: 16 },
  stateCopy: { ...Typography.body, textAlign: 'center', marginTop: 7 },
  retry: { minHeight: 48, paddingHorizontal: 22, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
