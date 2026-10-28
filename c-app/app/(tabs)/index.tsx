import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '@/components/MapView';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import {
  Search, Navigation, Car, Clock, Zap
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/constants/theme';
import { GOOGLE_MAP_ID } from '../../src/constants/maps';
import { cmsText, fetchCms, type CmsPayload } from '../../src/lib/cms';
import RentalsScreen from './rentals';
import ToursScreen from './tours';
import { useAuthStore } from '../../src/store/auth';

type TabType = 'Ride' | 'Rent' | 'Tour';

export default function HomeDashboard() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('Ride');
  const [cms, setCms] = useState<CmsPayload>({});
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const mapRef = useRef<any>(null);
  const [region, setRegion] = useState({
    latitude: 22.5726,
    longitude: 88.3639,
    latitudeDelta: 0.015,
    longitudeDelta: 0.0121,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      if (!active) return;
      setLocation(loc);
      const userCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.0121,
      };
      setRegion(userCoords);
      mapRef.current?.animateToRegion(userCoords, 800);
    })().catch(() => {
      // Keep the default map usable when GPS is unavailable.
      if (__DEV__ && active) console.info('[Maps] Current location unavailable; using the default region.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetchCms('customer-mobile').then(setCms).catch(() => setCms({}));
  }, []);

  const styles = createStyles(colors, isDark);

  const renderServiceTabs = () => (
    <View style={styles.topTabs}>
      {(['Ride', 'Rent', 'Tour'] as TabType[]).map((tab) => {
        const isTabActive = activeTab === tab;
        return (
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: isTabActive }}
            key={tab}
            style={[styles.tabBtn, isTabActive && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, isTabActive && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const firstName = user?.name ? user.name.split(' ')[0] : 'Explorer';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const renderRidePanel = () => (
    <View style={styles.panel}>
      {/* Top greeting and notification row */}
      <View style={styles.greetingRow}>
        <View style={styles.userSection}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.avatarCircle, { backgroundColor: isDark ? '#27272A' : '#E2E8F0', overflow: 'hidden' }]}
          >
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={[styles.avatarInitial, { color: colors.text }]}>{firstName[0].toUpperCase()}</Text>
            )}
          </TouchableOpacity>
          <View>
            <Text style={[styles.greetingSubtitle, { color: colors.textMuted }]}>{greeting},</Text>
            <Text style={[styles.greetingName, { color: colors.text }]}>{firstName} 👑</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <View style={styles.bellDot} />
          <Text style={{ fontSize: 16 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Special Offer Banner inspired by DriveLux */}
      <TouchableOpacity
        style={[styles.promoCard, { backgroundColor: isDark ? '#18181B' : '#09090B' }]}
        activeOpacity={0.9}
        onPress={() => router.push('/ride-booking')}
      >
        <View style={styles.promoContent}>
          <Text style={styles.promoTag}>SPECIAL OFFER</Text>
          <Text style={styles.promoTitle}>Get 20% Off</Text>
          <Text style={styles.promoSub}>On your next city ride or rental</Text>
          <View style={styles.promoBtn}>
            <Text style={styles.promoBtnText}>Book Now →</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Search Bar */}
      <TouchableOpacity 
        style={[styles.bookingBar, { backgroundColor: colors.surface, borderColor: colors.border }]} 
        activeOpacity={0.9}
        onPress={() => router.push('/ride-booking')}
      >
        <Search size={18} color={isDark ? '#F59E0B' : '#09090B'} strokeWidth={2.4} />
        <Text style={[styles.bookingText, { color: colors.textSecondary }]}>
          {cmsText(cms, 'home', 'rides', 'search_placeholder', 'Where to? Search location...')}
        </Text>
        <View style={[styles.filterIconBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Zap size={14} color={colors.text} />
        </View>
      </TouchableOpacity>

      {/* Quick service shortcuts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutRow} contentContainerStyle={styles.shortcutContent}>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/ride-booking')} accessibilityRole="button">
          <View style={[styles.iconBox, { backgroundColor: isDark ? '#1C1917' : '#FEF3C7', borderColor: isDark ? '#292524' : '#FDE68A' }]}>
            <Car size={22} color={colors.taxiYellow || '#F59E0B'} strokeWidth={2.2} />
          </View>
          <Text style={[styles.shortcutLabel, { color: colors.text }]}>Daily Ride</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/ride-booking')} accessibilityRole="button">
          <View style={[styles.iconBox, { backgroundColor: isDark ? '#0F172A' : '#EFF6FF', borderColor: isDark ? '#1E293B' : '#DBEAFE' }]}>
            <Zap size={22} color={colors.travelBlue || '#2563EB'} strokeWidth={2.2} />
          </View>
          <Text style={[styles.shortcutLabel, { color: colors.text }]}>Intercity</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/ride-booking')} accessibilityRole="button">
          <View style={[styles.iconBox, { backgroundColor: isDark ? '#172554' : '#F1F5F9', borderColor: colors.border }]}>
            <Clock size={22} color={colors.text} strokeWidth={2.2} />
          </View>
          <Text style={[styles.shortcutLabel, { color: colors.text }]}>Schedule</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (activeTab !== 'Ride') {
    return (
      <View style={styles.container}>
        <View style={styles.browseHeader}>{renderServiceTabs()}</View>
        <View style={styles.browseContent}>
          {activeTab === 'Rent' ? <RentalsScreen /> : <ToursScreen embedded />}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MAP / BACKGROUND AREA */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          googleMapId={GOOGLE_MAP_ID}
          style={styles.map}
          initialRegion={region}
          onMapReady={() => mapRef.current?.animateToRegion(region, 300)}
          onRegionChangeComplete={setRegion}
          showsUserLocation
          showsMyLocationButton={false}
          customMapStyle={GOOGLE_MAP_ID ? undefined : isDark ? darkMapStyle : []}
        >
          {location && (
            <Marker coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}>
              <View style={styles.userMarkerDot}>
                <Navigation size={12} color="#fff" />
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      {/* TOP TABS */}
      <View style={styles.safeHeader}>
        {renderServiceTabs()}
      </View>

      {/* CONTENT PANEL */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        {renderRidePanel()}
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: { flex: 1 },
  map: { width: '100%', height: '100%' },
  userMarkerDot: {
    backgroundColor: '#09090B',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
  },

  safeHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  browseHeader: {
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 8,
    zIndex: 2,
  },
  browseContent: { flex: 1 },
  topTabs: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 25,
  },
  tabBtnActive: {
    backgroundColor: isDark ? '#FFFFFF' : '#09090B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: isDark ? '#09090B' : '#FFFFFF',
  },

  bottomSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 90 : 80,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 10,
  },

  panel: { gap: 12 },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  greetingSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 17,
    fontWeight: '800',
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  bellDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    position: 'absolute',
    top: 9,
    right: 10,
    zIndex: 2,
  },

  promoCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  promoContent: {
    gap: 4,
  },
  promoTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  promoSub: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 8,
  },
  promoBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  promoBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },

  bookingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    gap: 12,
  },
  bookingText: { flex: 1, fontSize: 14, fontWeight: '500' },
  filterIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shortcutRow: { marginTop: 4 },
  shortcutContent: { gap: 14 },
  shortcutCard: {
    alignItems: 'center',
    gap: 6,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  shortcutLabel: { fontSize: 12, fontWeight: '700' },
});

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#2f3948" }] },
  { "featureType": "transit.station", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];
