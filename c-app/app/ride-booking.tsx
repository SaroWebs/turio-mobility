import DateTimeField from '../components/DateTimeField';
import { postBooking } from '../src/lib/booking-attempt';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, ScrollView, Switch,
  Alert, Linking, Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, MapPin, Navigation,
  Car, CreditCard, X, CheckCircle2,
  Phone, ShieldCheck, ChevronRight, Zap, Truck
} from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from '@/components/MapView';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { apiErrorMessage } from '../src/lib/api';
import { initEcho, type RealtimeClient } from '../src/lib/echo';
import { GOOGLE_MAP_ID } from '../src/constants/maps';
import { CarpoolTrips } from '../components/CarpoolTrips';
import { LiveSharedRides } from '../components/LiveSharedRides';
import { RideSharingControl } from '../components/RideSharingControl';
import { usePreferences } from '../src/store/preferences';

type Step = 'search' | 'trips' | 'estimate' | 'confirm' | 'tracking';
type VehicleClass = 'mini' | 'comfort' | 'xl';
const rideStatusRank: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  driver_assigned: 2,
  driver_arriving: 3,
  pickup: 4,
  in_transit: 5,
  completed: 6,
  cancelled: 6,
  rejected: 6,
};

const vehicleChoices: {
  key: VehicleClass;
  label: string;
  description: string;
  capacity: string;
}[] = [
  { key: 'mini', label: 'Mini', description: 'Easy city pickup', capacity: 'Up to 3 riders' },
  { key: 'comfort', label: 'Comfort', description: 'More room for the trip', capacity: 'Up to 4 riders' },
  { key: 'xl', label: 'XL', description: 'Extra seats and luggage', capacity: 'Up to 6 riders' },
];

const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

interface LocationData {
  id?: string | number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
}

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export default function RideBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('search');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'pickup' | 'dropoff'>('dropoff');
  const [searchResults, setSearchResults] = useState<LocationData[]>([]);

  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [searchClock, setSearchClock] = useState(() => Date.now());
  const searchDeadline = booking?.request_expires_at ? Date.parse(booking.request_expires_at) : null;
  const searchClosed = ['cancelled', 'rejected'].includes(booking?.status);
  const searchSeconds = searchDeadline ? Math.max(0, Math.ceil((searchDeadline - searchClock) / 1000)) : null;
  useEffect(() => {
    if (step !== 'confirm' || !searchDeadline || searchClosed) return;
    const timer = setInterval(() => setSearchClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, searchDeadline, searchClosed]);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleClass>('comfort');
  const [sharingRequested, setSharingRequested] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'upi'>(() => usePreferences.getState().payment);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [scheduledPickup, setScheduledPickup] = useState<Date | null>(null);

  const mapRef = useRef<any>(null);
  const estimateRequest = useRef(0);

  useEffect(() => {
    if (!pickup || !dropoff || step !== 'confirm' || searchClosed) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refreshCars = async () => {
      try {
        const result = await api.post('/public/rides/estimate', { pickup_lat: pickup.lat, pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, service_type: 'point_to_point', vehicle_class: selectedVehicle });
        if (active) setEstimate((previous: any) => ({ ...previous, nearby_driver_locations: result.data?.nearby_driver_locations ?? [] }));
      } catch {
        if (active) setEstimate((previous: any) => ({ ...previous, nearby_driver_locations: [] }));
      } finally {
        if (active) timer = setTimeout(refreshCars, 15000);
      }
    };
    void refreshCars();
    return () => { active = false; clearTimeout(timer); };
  }, [pickup, dropoff, step, searchClosed, selectedVehicle]);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setRouteCoordinates([]);
      return;
    }

    let active = true;
    const fallback = [
      { latitude: pickup.lat, longitude: pickup.lng },
      { latitude: dropoff.lat, longitude: dropoff.lng },
    ];
    setRouteCoordinates(fallback);

    void api.post('/public/directions', {
      origin_lat: pickup.lat,
      origin_lng: pickup.lng,
      destination_lat: dropoff.lat,
      destination_lng: dropoff.lng,
    }).then((response) => {
      const coordinates = response.data?.coordinates;
      if (!active || !Array.isArray(coordinates) || coordinates.length < 2) return;

      setRouteCoordinates(coordinates);
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }, 100);
    }).catch(() => {
      // Keep the direct-line fallback if every routing provider is unavailable.
    });

    return () => {
      active = false;
    };
  }, [dropoff, pickup]);

  // Initialize pickup with current location
  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      if (!active) return;
      const currentLoc = {
        name: 'Current Location',
        address: 'Your current position',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      // A slow GPS response must not overwrite a manually selected pickup.
      setPickup((current) => current ?? currentLoc);
    })().catch(() => {
      if (active) Alert.alert('Location unavailable', 'Please search for your pickup location manually.');
    });
    return () => { active = false; };
  }, []);

  // Search logic
  useEffect(() => {
    if (step !== 'search') return;
    const controller = new AbortController();
    let active = true;
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        try {
          const response = await api.get('/public/locations/search', { params: { query }, signal: controller.signal });
          if (active) setSearchResults(response.data.results ?? []);
        } catch {
          if (active) setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => { active = false; clearTimeout(delayDebounceFn); controller.abort(); };
  }, [query, step]);

  const handleSelectLocation = async (loc: LocationData) => {
    let finalLoc = { ...loc };

    // If coordinates are missing (common for Google Autocomplete results), fetch details
    if (finalLoc.lat == null || finalLoc.lng == null) {
      if (loc.type !== 'google_place') {
        Alert.alert('Location unavailable', 'This location has no map coordinates. Please choose another search result.');
        return;
      }
      setLoading(true);
      try {
        const response = await api.get('/public/locations/place-details', {
          params: { place_id: loc.id }
        });
        if (response.data) {
          finalLoc = {
            ...finalLoc,
            lat: response.data.lat,
            lng: response.data.lng,
            address: response.data.address || finalLoc.address
          };
        }
      } catch (error) {
        Alert.alert('Location unavailable', apiErrorMessage(error, 'Could not load this location. Please try again.'));
        return;
      } finally {
        setLoading(false);
      }
    }

    const lat = Number(finalLoc.lat);
    const lng = Number(finalLoc.lng);
    if (finalLoc.lat == null || finalLoc.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      Alert.alert('Location unavailable', 'This location has no valid map coordinates. Please choose another search result.');
      return;
    }
    finalLoc = { ...finalLoc, lat, lng };

    if (searchTarget === 'pickup') {
      setPickup(finalLoc);
      if (!dropoff) {
        setSearchTarget('dropoff');
        setQuery('');
      } else {
        setQuery(finalLoc.name);
        setSearchTarget('pickup'); // Keep it here but updated
      }
    } else {
      setDropoff(finalLoc);
      if (!pickup) {
        setSearchTarget('pickup');
        setQuery('');
      } else {
        setQuery(finalLoc.name);
        setSearchTarget('dropoff'); // Keep it here but updated
      }
    }

    setSearchResults([]);

  };

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get('/wallet');
      setWalletBalance(parseFloat(response.data.data.balance));
    } catch (error) {
      console.error('Wallet fetch error', error);
    }
  };

  const getEstimate = useCallback(async (p: LocationData, d: LocationData, vehicleClass: VehicleClass = selectedVehicle, sharing = sharingRequested) => {
    const request = ++estimateRequest.current;
    setEstimate(null);
    if (scheduledPickup && scheduledPickup.getTime() <= Date.now()) {
      Alert.alert('Choose a future pickup', 'The selected pickup time has passed. Choose another date and time.');
      return;
    }
    setLoading(true);
    setStep('estimate');
    try {
      const scheduledAt = (scheduledPickup || new Date(Date.now() + 5 * 60000)).toISOString();
      const response = await api.post('/public/rides/estimate', {
        pickup_lat: p.lat,
        pickup_lng: p.lng,
        dropoff_lat: d.lat,
        dropoff_lng: d.lng,
        service_type: 'point_to_point',
        scheduled_at: scheduledAt,
        vehicle_class: vehicleClass,
        sharing_requested: sharing,
        reserved_seats: 1,
      });
      if (request !== estimateRequest.current) return;
      setEstimate(response.data);

      // Fit map to markers
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([
          { latitude: p.lat, longitude: p.lng },
          { latitude: d.lat, longitude: d.lng }
        ], {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }, 500);
    } catch (error) {
      if (request !== estimateRequest.current) return;
      Alert.alert('Estimate unavailable', apiErrorMessage(error, 'Unable to calculate the fare right now.'));
      setStep('search');
    } finally {
      if (request === estimateRequest.current) setLoading(false);
    }
  }, [scheduledPickup, selectedVehicle, sharingRequested]);

  const [driverLoc, setDriverLoc] = useState<any>(null);

  // Real-time tracking with Echo
  useEffect(() => {
    let active = true;
    let client: RealtimeClient | null = null;
    if (booking?.id && (step === 'confirm' || step === 'tracking')) {
      (async () => {
        const echo = await initEcho();
        if (!active) {
          echo.disconnect();
          return;
        }
        client = echo;

        echo.private(`ride.${booking.id}`)
          .listen('.ride.status.updated', (e: any) => {
            if (!active) return;
            console.log('Status updated', e);
            setBooking((prev: any) => {
              if (rideStatusRank[String(prev?.status)] > rideStatusRank[String(e.status)]) return prev;
              return { ...prev, status: e.status };
            });
            if (e.status === 'driver_assigned') {
              setStep('tracking');
            } else if (e.status === 'completed') {
              router.replace({ pathname: '/ride-details', params: { id: booking.id } });
            }
          })
          .listen('.ride.location.updated', (e: any) => {
            if (!active) return;
            console.log('Location updated', e);
            setDriverLoc({
              latitude: parseFloat(e.latitude),
              longitude: parseFloat(e.longitude),
            });
          });
      })();
    }

    return () => {
      active = false;
      if (client) {
        client.leave(`ride.${booking.id}`);
        client.disconnect();
      }
    };
  }, [booking?.id, router, step]);

  // Pusher is the fast path; polling keeps assignment visible when Expo Go
  // suspends sockets or the realtime connection is temporarily unavailable.
  useEffect(() => {
    if (!booking?.id || !['confirm', 'tracking'].includes(step)) return;

    let active = true;
    const refreshBooking = async () => {
      try {
        const response = await api.get(`/rides/${booking.id}`);
        const freshBooking = response.data?.data;
        if (!active || !freshBooking) return;

        setBooking((current: any) => {
          if (rideStatusRank[String(current?.status)] > rideStatusRank[String(freshBooking.status)]) return current;
          return { ...current, ...freshBooking };
        });
        if (freshBooking.current_lat && freshBooking.current_lng) {
          setDriverLoc({
            latitude: Number(freshBooking.current_lat),
            longitude: Number(freshBooking.current_lng),
          });
        }
        if (freshBooking.driver_id || freshBooking.driver) setStep('tracking');
        if (freshBooking.status === 'completed') router.replace({ pathname: '/ride-details', params: { id: booking.id } });
      } catch {
        // Retain the last known state and retry on the next polling interval.
      }
    };

    void refreshBooking();
    const interval = setInterval(refreshBooking, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [booking?.id, router, step]);

  const confirmBooking = async () => {
    if (!pickup || !dropoff || !estimate) return;
    if (scheduledPickup && scheduledPickup.getTime() <= Date.now()) {
      Alert.alert('Choose a future pickup', 'The selected pickup time has passed. Go back and choose another date and time.');
      return;
    }

    if (paymentMethod === 'wallet' && walletBalance < parseFloat(estimate.pricing.subtotal)) {
      Alert.alert('Insufficient Balance', 'Please top up your wallet or choose a different payment method.');
      return;
    }

    setLoading(true);
    try {
      const scheduledAt = (scheduledPickup || new Date(Date.now() + 5 * 60000)).toISOString();
      const response = await postBooking('/rides', {
        sharing_requested: sharingRequested,
        reserved_seats: 1,
        service_type: 'point_to_point',
        pickup_location: pickup.name,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_location: dropoff.name,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        scheduled_at: scheduledAt,
        payment_method: paymentMethod,
        request_mode: scheduledPickup ? 'scheduled' : 'immediate',
        vehicle_class: selectedVehicle,
      });
      setBooking({ ...response.data.data, dispatch: response.data.dispatch });
      setSearchClock(Date.now());
      setStep('confirm');
    } catch (error: any) {
      if (error.response?.status === 409 && error.response?.data?.active_ride_id) {
        router.replace({ pathname: '/ride-details', params: { id: error.response.data.active_ride_id } });
        return;
      }
      Alert.alert('Booking Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const selectVehicle = (vehicleClass: VehicleClass) => {
    setSelectedVehicle(vehicleClass);
    if (pickup && dropoff) {
      void getEstimate(pickup, dropoff, vehicleClass);
    }
  };

  const cancelDriverSearch = async () => {
    if (!booking?.id) {
      setStep('estimate');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/rides/${booking.id}/cancel`);
      setBooking(null);
      setDriverLoc(null);
      setStep('estimate');
    } catch (error) {
      Alert.alert('Unable to cancel', apiErrorMessage(error, 'The request may already have been accepted. Check the latest ride status.'));
    } finally {
      setLoading(false);
    }
  };

  const renderSearch = () => (
    <View style={[styles.searchContainer, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
      <View style={styles.searchHeader}>
        <TouchableOpacity accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={21} color="#172321" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>POINT RIDE</Text>
          <Text style={styles.headerTitle}>Where are you headed?</Text>
        </View>
      </View>

      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={[styles.dot, styles.pickupDot]} />
          <TextInput
            style={styles.input}
            placeholder="Pickup location"
            placeholderTextColor="#8A9793"
            value={searchTarget === 'pickup' ? query : pickup?.name || ''}
            onFocus={() => {
              setSearchTarget('pickup');
              setQuery(pickup?.name === 'Current Location' ? '' : pickup?.name || '');
            }}
            onChangeText={(value) => { setQuery(value); setSearchResults([]); setPickup(null); }}
          />
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.inputRow}>
          <View style={[styles.dot, styles.dropoffDot]} />
          <TextInput
            style={styles.input}
            placeholder="Where to?"
            placeholderTextColor="#8A9793"
            value={searchTarget === 'dropoff' ? query : dropoff?.name || ''}
            onFocus={() => {
              setSearchTarget('dropoff');
              setQuery(dropoff?.name || '');
            }}
            onChangeText={(value) => { setQuery(value); setSearchResults([]); setDropoff(null); }}
            autoFocus
          />
        </View>
      </View>

      <DateTimeField label="Pickup date and time" mode="datetime" value={scheduledPickup}
        onChange={setScheduledPickup} placeholder="Pickup now"
        minimumLeadMinutes={5} clearable clearLabel="Pickup now" />
      <View style={styles.searchMeta}>
        <ShieldCheck size={15} color="#0F766E" />
        <Text style={styles.searchMetaText}>Verified drivers</Text>
      </View>

      {searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => handleSelectLocation(item)}
            >
              <View style={styles.resultIcon}><MapPin size={17} color="#0F766E" /></View>
              <View style={styles.resultText}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
              </View>
              <ChevronRight size={18} color="#8A9793" />
            </TouchableOpacity>
          )}
        />
      )}
      {pickup && dropoff && <TouchableOpacity
        accessibilityRole="button"
        style={styles.confirmBtn}
        disabled={loading}
        onPress={() => { Keyboard.dismiss(); void fetchWalletBalance(); void getEstimate(pickup, dropoff); }}
      ><Text style={styles.confirmBtnText}>Continue to choose a ride</Text></TouchableOpacity>}
    </View>
  );

  const renderEstimate = () => {
    const selectedVehicleChoice = vehicleChoices.find((v) => v.key === selectedVehicle) || vehicleChoices[1];
    const totalFare = money(estimate?.pricing?.total ?? estimate?.pricing?.subtotal);
    const distanceKm = estimate?.estimated_distance_km ? `${Number(estimate.estimated_distance_km).toFixed(1)} km` : 'Calculating distance';
    const durationMin = estimate?.estimated_duration || 'Calculating time';

    return (
      <ScrollView style={[styles.bottomSheet, { maxHeight: '62%' }]} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }} keyboardShouldPersistTaps="handled">
        <View style={styles.handle} />
        {pickup && dropoff && <LiveSharedRides origin={pickup} destination={dropoff} scheduledAt={scheduledPickup}
          onJoined={(ride) => { setBooking(ride); setStep('tracking'); }} rideSelection={<>
        <View style={styles.sharingCard}>
          <View style={styles.sharingRow}><View style={{ flex: 1 }}><Text style={styles.sharingTitle}>Allow ride sharing</Text><Text style={styles.sharingHelp}>{sharingRequested ? '1 passenger seat · Sharing enabled' : 'Private ride · Only your party'}</Text></View>
          <Switch accessibilityLabel="Allow ride sharing" value={sharingRequested} disabled={loading} trackColor={{ true: '#0F766E' }} onValueChange={(sharing) => {
          setSharingRequested(sharing);
          if (pickup && dropoff) void getEstimate(pickup, dropoff, selectedVehicle, sharing);
        }} /></View>
          <Text style={styles.sharingHelp}>You can change this after booking until another passenger joins. {sharingRequested ? 'Matching is subject to route, timing and available seats.' : ''}</Text>
        </View>

        {/* Horizontal Vehicle Silhouettes Selector from Image 3 */}
        <View style={styles.taxiVehicleRow}>
          {vehicleChoices.map((vehicle) => {
            const selected = selectedVehicle === vehicle.key;
            const VehicleIcon = vehicle.key === 'mini' ? Car : vehicle.key === 'comfort' ? Zap : Truck;
            return (
              <TouchableOpacity
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={vehicle.key}
                disabled={loading}
                onPress={() => selectVehicle(vehicle.key)}
                style={[styles.taxiVehiclePill, selected && styles.taxiVehiclePillActive]}
              >
                <VehicleIcon size={26} color={selected ? '#F59E0B' : '#64748B'} strokeWidth={2.2} />
                <Text style={[styles.taxiVehiclePillText, selected && styles.taxiVehiclePillTextActive]}>
                  {vehicle.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Highlighted Fare & Metric Banner from Image 3 */}
        <View style={styles.taxiFareHighlightCard}>
          <Text style={styles.taxiFareTitle}>
            {loading ? 'Calculating your fare…' : `${selectedVehicleChoice.label} Taxi: ${totalFare} / ${distanceKm} / ${durationMin}`}
          </Text>
          <Text style={styles.taxiFareDisclaimer}>
            NOTE: This is an approximate cost. Actual cost will vary according to traffic and wait times.
          </Text>
        </View>

        {/* Payment Method Selector Pills from Image 3 */}
        <View style={styles.taxiPaymentPillsRow}>
          {(['cash', 'wallet', 'card'] as const).map((method) => {
            const isSelected = paymentMethod === (method === 'card' ? 'cash' : method);
            return (
              <TouchableOpacity
                key={method}
                style={[
                  styles.taxiPaymentPill,
                  isSelected && styles.taxiPaymentPillActive,
                ]}
                onPress={() => {
                  if (method !== 'card') setPaymentMethod(method);
                }}
              >
                <CreditCard size={14} color={isSelected ? '#FFFFFF' : '#64748B'} />
                <Text style={[styles.taxiPaymentPillText, isSelected && styles.taxiPaymentPillTextActive]}>
                  {method === 'cash' ? 'Cash' : method === 'wallet' ? 'Wallet' : 'Promo'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* High-Visibility Yellow Book Now CTA from Image 3 */}
        <TouchableOpacity
          style={styles.taxiBookNowBtn}
          onPress={confirmBooking}
          disabled={loading || !estimate}
        >
          {loading ? (
            <ActivityIndicator color="#09090B" />
          ) : (
            <Text style={styles.taxiBookNowText}>Book Now</Text>
          )}
        </TouchableOpacity>
        </>} />}
        <TouchableOpacity accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }} onPress={() => setStep('trips')}><Text style={styles.sharingHelp}>Browse scheduled intercity carpools</Text></TouchableOpacity>
      </ScrollView>
    );
  };

  const renderConfirming = () => (
    <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
      <View style={styles.handle} />
      <RideSharingControl booking={booking} onUpdated={(ride) => setBooking((current: any) => ({ ...current, ...ride }))} />
      <View style={styles.loadingContainer}>
        <View style={styles.searchPulse}>
          <View style={styles.searchPulseOuter} />
          <View style={styles.searchPulseInner}><Car size={27} color="#FFFFFF" /></View>
        </View>
        <Text style={styles.loadingEyebrow}>DISPATCHING NEARBY TAXI</Text>
        <Text style={styles.loadingTitle}>{searchClosed ? 'Search closed' : searchSeconds === 0 ? 'Checking final search status' : 'Finding the nearest driver'}</Text>
        <Text style={styles.loadingSub}>
          {searchClosed ? 'This request is closed. Search again to find an available driver.' : searchSeconds === 0 ? 'The search window has ended. Reconnecting to confirm driver acceptance.' : 'Nearby verified drivers are reviewing your route.'}
        </Text>
        {searchSeconds !== null && !searchClosed && (
          <Text accessibilityLiveRegion="polite" style={styles.bookingReference}>
            {Math.floor(searchSeconds / 60)}:{String(searchSeconds % 60).padStart(2, '0')} remaining
          </Text>
        )}
        <View accessibilityLabel="Driver search in progress" style={styles.searchProgress}>
          <View style={[styles.searchProgressBar, styles.searchProgressBarActive]} />
          <View style={styles.searchProgressBar} />
          <View style={styles.searchProgressBar} />
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        disabled={loading}
        style={styles.cancelBtn}
        onPress={searchClosed ? () => { setBooking(null); setDriverLoc(null); setStep('estimate'); } : cancelDriverSearch}
      >
        {loading ? <ActivityIndicator color="#C2413B" /> : <><X size={18} color="#C2413B" /><Text style={styles.cancelText}>{searchClosed ? 'Search again' : 'Cancel booking'}</Text></>}
      </TouchableOpacity>
    </View>
  );

  const renderTracking = () => (
    <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
      <View style={styles.handle} />
      <RideSharingControl booking={booking} onUpdated={(ride) => setBooking((current: any) => ({ ...current, ...ride }))} />

      {/* Driver info & Dispatch Card from Image 3 Screen 3 */}
      <View style={styles.taxiDriverCard}>
        <View style={styles.driverAvatarWrap}>
          <Text style={styles.driverAvatarText}>
            {booking?.driver?.name?.slice(0, 2)?.toUpperCase() || 'AJ'}
          </Text>
        </View>

        <View style={styles.driverMetaCol}>
          <Text style={styles.driverFullName}>{booking?.driver?.name || 'ANTHONY JOHN'}</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Text key={s} style={{ color: '#F59E0B', fontSize: 11 }}>★</Text>
            ))}
          </View>
          <Text style={styles.vehiclePlateText}>
            {[booking?.driver?.vehicle_model || 'Verna Taxi', booking?.driver?.vehicle_number || 'HR02 NB 256'].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.driverEtaPrompt}>
            {booking?.driver_eta_minutes ? `Driver will pick you up in 0${booking.driver_eta_minutes}:00` : 'Driver will Pickup you in 05:00'}
          </Text>
        </View>

        {/* Chat and Call Icon Buttons */}
        <View style={styles.driverActionButtonsRow}>
          <TouchableOpacity
            style={styles.chatActionBtn}
            onPress={() => router.push('/notifications')}
            accessibilityLabel="Message driver"
          >
            <Zap size={16} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.phoneActionBtn}
            disabled={!booking?.driver?.phone}
            onPress={() => booking?.driver?.phone && Linking.openURL(`tel:${booking.driver.phone}`)}
            accessibilityLabel="Call driver"
          >
            <Phone size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons: Solid Yellow Share Location + Outlined Cancel Booking */}
      <View style={styles.taxiTrackingActions}>
        <TouchableOpacity
          style={styles.taxiShareLocationBtn}
          onPress={() => {
            if (pickup) {
              Linking.openURL(`https://maps.google.com/?q=${pickup.lat},${pickup.lng}`).catch(() => {});
            }
          }}
        >
          <Text style={styles.taxiShareLocationText}>Share Your Location</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.taxiCancelBookingBtn}
          onPress={() => {
            Alert.alert(
              'Cancel Booking',
              'Are you sure you want to cancel this booking?',
              [
                { text: 'Keep Ride', style: 'cancel' },
                { text: 'Cancel Ride', style: 'destructive', onPress: cancelDriverSearch },
              ]
            );
          }}
        >
          <Text style={styles.taxiCancelBookingText}>Cancel Booking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          googleMapId={GOOGLE_MAP_ID}
          style={styles.map}
          initialRegion={{
            latitude: pickup?.lat || 22.5726,
            longitude: pickup?.lng || 88.3639,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
        >
          {pickup && (
            <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Pickup">
              <View style={[styles.markerContainer, { backgroundColor: '#0F766E' }]}>
                <Navigation size={12} color="#fff" />
              </View>
            </Marker>
          )}
          {dropoff && (
            <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} title="Dropoff">
              <View style={[styles.markerContainer, { backgroundColor: '#ef4444' }]}>
                <MapPin size={12} color="#fff" />
              </View>
            </Marker>
          )}
          {!driverLoc && !searchClosed && (step === 'estimate' || step === 'confirm') && (estimate?.nearby_driver_locations ?? []).map((driver: { lat: number; lng: number }, index: number) => (
            <Marker key={`available-${index}`} coordinate={{ latitude: driver.lat, longitude: driver.lng }} title="Available car">
              <Car size={24} color="#16865A" />
            </Marker>
          ))}
          {driverLoc && (
            <Marker coordinate={driverLoc} title="Driver">
              <View style={[styles.markerContainer, { backgroundColor: '#16a34a' }]}>
                <Car size={12} color="#fff" />
              </View>
            </Marker>
          )}
          {routeCoordinates.length >= 2 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={4}
              strokeColor="#0F766E"
            />
          )}
        </MapView>

        {step === 'search' && renderSearch()}
        {step !== 'search' && step !== 'trips' && (
          <TouchableOpacity
            accessibilityLabel="Edit pickup and destination"
            accessibilityRole="button"
            style={[styles.floatBack, { top: Math.max(insets.top, 20) + 8 }]}
            onPress={() => setStep('search')}
          >
            <ArrowLeft size={20} color="#172321" />
          </TouchableOpacity>
        )}
      </View>

      {step === 'trips' && pickup && dropoff && <CarpoolTrips
        key={`${pickup.lat},${pickup.lng}:${dropoff.lat},${dropoff.lng}`}
        origin={pickup}
        destination={dropoff}
        onJoined={(ride) => { setBooking(ride); setStep('tracking'); }}
        onEditRoute={() => setStep('search')}
        onSearchCar={() => {
          void fetchWalletBalance();
          void getEstimate(pickup, dropoff);
        }}
      />}
      {step === 'estimate' && renderEstimate()}
      {step === 'confirm' && renderConfirming()}
      {step === 'tracking' && renderTracking()}
    </View>
  );
}

const styles = StyleSheet.create({
  sharingCard: { padding: 14, borderRadius: 16, backgroundColor: '#F0FAF6', gap: 8 },
  sharingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sharingTitle: { fontSize: 16, fontWeight: '700', color: '#173B32' },
  sharingHelp: { fontSize: 13, lineHeight: 20, color: '#40534B' },
  container: { flex: 1, backgroundColor: '#F6F7F2' },
  mapContainer: { flex: 1 },
  map: { width: '100%', height: '100%' },

  floatBack: {
    position: 'absolute',
    left: 20,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  searchContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 10,
    shadowColor: '#102A27',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F4EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  headerCopy: { flex: 1 },
  headerEyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.4, color: '#0F766E' },
  headerTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: '#172321', marginTop: 2 },

  inputCard: {
    backgroundColor: '#F7F8F4',
    marginHorizontal: 20,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#DDE4DF',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 3, borderColor: '#FFFFFF' },
  pickupDot: { backgroundColor: '#0F766E' },
  dropoffDot: { backgroundColor: '#E76F51', borderRadius: 3 },
  input: { flex: 1, minHeight: 48, fontSize: 15, fontWeight: '700', color: '#172321' },
  routeConnector: {
    height: 1,
    backgroundColor: '#DDE4DF',
    marginLeft: 23,
  },
  searchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 22,
    marginTop: 13,
    gap: 7,
  },
  searchMetaText: { fontSize: 11, fontWeight: '700', color: '#5F6F6B' },
  metaDivider: { width: 1, height: 14, backgroundColor: '#DDE4DF', marginHorizontal: 5 },
  schedulePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
  },
  scheduleOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F4EF',
    borderWidth: 1,
    borderColor: '#DDE4DF',
  },
  scheduleOptionActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  scheduleOptionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#45534F',
  },
  scheduleOptionTextActive: {
    color: '#FFFFFF',
  },

  resultsList: {
    maxHeight: 310,
    marginTop: 12,
    marginHorizontal: 20,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDE4DF',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1EB',
    gap: 11,
  },
  resultIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DDF4EF', alignItems: 'center', justifyContent: 'center' },
  resultText: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '800', color: '#172321' },
  resultAddress: { fontSize: 12, color: '#5F6F6B', marginTop: 3 },

  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    elevation: 20,
    shadowColor: '#102A27',
    shadowOpacity: 0.17,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  handle: {
    width: 44, height: 5,
    backgroundColor: '#DDE4DF',
    borderRadius: 3,
    alignSelf: 'center', marginTop: 11, marginBottom: 15,
  },
  sheetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetEyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.3, color: '#0F766E' },
  panelTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#172321', marginTop: 2 },
  routeBadge: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, backgroundColor: '#DDF4EF', justifyContent: 'center' },
  routeBadgeText: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  compactRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#F6F7F2',
    borderWidth: 1,
    borderColor: '#E3E8E4',
    padding: 13,
    marginBottom: 12,
  },
  compactRouteStops: { width: 18, alignItems: 'center', marginRight: 9 },
  compactRouteLine: { width: 1, height: 17, backgroundColor: '#B8C4BF' },
  compactRouteCopy: { flex: 1, gap: 11 },
  compactRouteText: { fontSize: 12, fontWeight: '700', color: '#45534F' },
  tripMetric: { alignItems: 'flex-end', marginLeft: 10 },
  tripMetricValue: { fontSize: 13, fontWeight: '900', color: '#172321' },
  tripMetricLabel: { fontSize: 9, fontWeight: '700', color: '#8A9793', marginTop: 2 },

  vehicleOptions: { gap: 7, marginBottom: 12 },
  vehicleCard: {
    minHeight: 66,
    padding: 9,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E3E8E4',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vehicleCardActive: { borderColor: '#0F766E', backgroundColor: '#F0FAF7' },
  vehicleIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#EEF1EB', alignItems: 'center', justifyContent: 'center' },
  vehicleIconActive: { backgroundColor: '#0F766E' },
  vehicleCopy: { flex: 1 },
  vehicleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  vehicleName: { fontSize: 14, fontWeight: '900', color: '#172321' },
  recommendedBadge: { fontSize: 8, lineHeight: 13, fontWeight: '900', letterSpacing: 0.5, color: '#9A5C00', backgroundColor: '#FFF4D6', borderRadius: 7, paddingHorizontal: 6 },
  vehicleDescription: { fontSize: 10.5, lineHeight: 15, color: '#5F6F6B', marginTop: 3 },
  vehicleFare: { alignItems: 'flex-end', gap: 4 },
  vehiclePrice: { fontSize: 12, fontWeight: '900', color: '#172321' },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 58,
    padding: 10,
    backgroundColor: '#F6F7F2',
    borderRadius: 16,
    marginBottom: 12,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#DDF4EF', alignItems: 'center', justifyContent: 'center' },
  paymentLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#8A9793' },
  paymentText: { fontSize: 13, fontWeight: '800', color: '#172321', marginTop: 2 },
  changeButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  changeText: { fontSize: 12, fontWeight: '800', color: '#0F766E' },

  confirmBtn: {
    minHeight: 56,
    backgroundColor: '#F26742',
    paddingHorizontal: 18,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D04A29',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  fareNote: { fontSize: 10, lineHeight: 15, color: '#6F7C77', textAlign: 'center', marginTop: 8, paddingHorizontal: 10 },

  paymentPicker: {
    backgroundColor: '#F1F4EF',
    borderRadius: 14,
    padding: 8,
    gap: 6,
    marginBottom: 12,
  },
  paymentOption: {
    padding: 12,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE4DF',
    justifyContent: 'center',
  },
  paymentOptionActive: { borderColor: '#0F766E', backgroundColor: '#F0FAF7' },
  paymentOptionText: { fontSize: 13, fontWeight: '700', color: '#45534F' },
  paymentOptionTextActive: { color: '#0F766E' },

  loadingContainer: { alignItems: 'center', paddingTop: 8, paddingBottom: 22 },
  searchPulse: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  searchPulseOuter: { position: 'absolute', width: 98, height: 98, borderRadius: 49, backgroundColor: '#DDF4EF', borderWidth: 1, borderColor: '#B8E4D9' },
  searchPulseInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F766E', shadowOpacity: 0.24, shadowRadius: 14, elevation: 5 },
  loadingEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, color: '#0F766E' },
  loadingTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#172321', marginTop: 5 },
  loadingSub: { maxWidth: 315, fontSize: 13, lineHeight: 19, color: '#5F6F6B', marginTop: 7, textAlign: 'center' },
  searchProgress: { flexDirection: 'row', width: '100%', gap: 6, marginTop: 20 },
  searchProgressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#DDE4DF' },
  searchProgressBarActive: { backgroundColor: '#0F766E' },
  bookingReference: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: '#7A8883', textAlign: 'center', marginTop: 12 },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#F4CDCA',
    borderRadius: 15,
  },
  cancelText: { color: '#C2413B', fontSize: 14, fontWeight: '800' },

  trackingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  trackingTitle: { fontSize: 21, lineHeight: 27, fontWeight: '900', color: '#172321', marginTop: 3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, minHeight: 30, borderRadius: 15, backgroundColor: '#EAF7F1' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16865A' },
  liveText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#16865A' },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 18,
    backgroundColor: '#F6F7F2',
    borderWidth: 1,
    borderColor: '#E3E8E4',
    marginBottom: 13,
  },
  driverInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, marginRight: 10 },
  driverCopy: { flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#172321', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  driverName: { fontSize: 15, fontWeight: '900', color: '#172321' },
  carDetail: { fontSize: 11, color: '#5F6F6B', marginTop: 3 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 10, fontWeight: '800', color: '#16865A' },
  callBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0F766E', justifyContent: 'center', alignItems: 'center' },

  tripDetails: { gap: 4, padding: 13, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8E4', marginBottom: 12 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripLoc: { flex: 1, fontSize: 12, color: '#45534F', fontWeight: '700' },
  tripLine: { width: 1, height: 15, backgroundColor: '#C6D0CB', marginLeft: 5 },
  trackingMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, marginBottom: 14 },
  trackingMetaLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#8A9793' },
  trackingMetaValue: { fontSize: 12, fontWeight: '900', color: '#172321', marginTop: 3 },

  mainActionBtn: {
    minHeight: 54,
    backgroundColor: '#172321',
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainActionText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  markerContainer: {
    padding: 7,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#102A27',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  /* Taxi Inspiration Design Elements */
  taxiVehicleRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  taxiVehiclePill: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  taxiVehiclePillActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  taxiVehiclePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  taxiVehiclePillTextActive: {
    color: '#B45309',
  },

  taxiFareHighlightCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    gap: 4,
  },
  taxiFareTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  taxiFarePrice: {
    fontSize: 17,
    fontWeight: '900',
    color: '#D97706',
  },
  taxiFareDisclaimer: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
  },

  taxiPaymentPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  taxiPaymentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  taxiPaymentPillActive: {
    backgroundColor: '#F43F5E',
    borderColor: '#F43F5E',
  },
  taxiPaymentPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  taxiPaymentPillTextActive: {
    color: '#FFFFFF',
  },

  taxiBookNowBtn: {
    height: 54,
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  taxiBookNowText: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '900',
  },

  taxiDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  driverAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  driverMetaCol: {
    flex: 1,
    gap: 2,
  },
  driverFullName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#09090B',
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  vehiclePlateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  driverEtaPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E11D48',
    marginTop: 2,
  },

  driverActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  taxiTrackingActions: {
    gap: 8,
    marginTop: 8,
  },
  taxiShareLocationBtn: {
    height: 50,
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxiShareLocationText: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '900',
  },
  taxiCancelBookingBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxiCancelBookingText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
});
