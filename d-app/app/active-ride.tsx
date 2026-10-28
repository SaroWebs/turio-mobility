import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  AppState,
  Linking,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  TextInput
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Phone, Navigation, CheckCircle, ShieldCheck, MessageCircle, Compass, Car, MapPin, Banknote, Wallet } from 'lucide-react-native';
import api from '../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/Map';
import * as Location from 'expo-location';
import { GOOGLE_MAP_ID } from '../src/constants/maps';

type RideStatus = 'driver_assigned' | 'on_the_way' | 'driver_arriving' | 'pickup' | 'in_transit' | 'completed' | 'cancelled';

interface Ride {
  sharing_requested?: boolean;
  shared_trip?: { id: number; accepting: boolean; allow_extension: boolean; geometry: RouteCoordinate[]; stops: { booking_id: number; type: string; label: string; seats: number }[] } | null;
  id: number;
  booking_number: string;
  status: RideStatus;
  pickup_location: string;
  pickup_lat: number | string | null;
  pickup_lng: number | string | null;
  dropoff_location: string;
  dropoff_lat: number | string | null;
  dropoff_lng: number | string | null;
  customer_name: string;
  customer_phone: string;
  total_fare: number;
  payment_method?: string;
  payment_status?: string;
  commission_amount?: number;
  driver_share?: number;
  service_type: string;
}

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

function toMapCoordinate(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): RouteCoordinate | null {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (
    latitude === null || latitude === undefined || latitude === '' ||
    longitude === null || longitude === undefined || longitude === '' ||
    !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) ||
    parsedLatitude < -90 || parsedLatitude > 90 ||
    parsedLongitude < -180 || parsedLongitude > 180
  ) {
    return null;
  }

  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

export default function ActiveRideScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [rideError, setRideError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [issue, setIssue] = useState('');
  const [showIssue, setShowIssue] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const [driverLocation, setDriverLocation] = useState<Location.LocationObject | null>(null);
  const [routeResult, setRouteResult] = useState<{ key: string; coordinates: RouteCoordinate[] } | null>(null);
  const displayedRideId = useRef<number | null>(null);
  const routeCoordinates = useMemo(() => {
    if (ride?.shared_trip?.geometry?.length) return ride.shared_trip.geometry;
    if (!ride) return [];
    const pickup = toMapCoordinate(ride.pickup_lat, ride.pickup_lng);
    const dropoff = toMapCoordinate(ride.dropoff_lat, ride.dropoff_lng);
    if (!pickup || !dropoff) return [];
    const key = JSON.stringify([ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng]);
    return routeResult?.key === key ? routeResult.coordinates : [pickup, dropoff];
  }, [ride, routeResult]);
  const mapRef = useRef<any>(null);

  const fetchRideDetails = useCallback(async () => {
    try {
      const endpoint = id ? `/active-ride?id=${id}` : '/active-ride';
      const response = await api.get(endpoint);
      setRideError('');
      if (response.data.success && response.data.ride && !['completed', 'cancelled'].includes(response.data.ride.status)) {
        if (displayedRideId.current !== response.data.ride.id) {
          displayedRideId.current = response.data.ride.id;
          setPin(''); setShowPinInput(false); setShowCompletionConfirm(false); setShowCancel(false);
        }
        setRide(response.data.ride);
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setRideError('Trip updates are unavailable. Showing the last known state; reconnect or retry.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const initialFetch = setTimeout(() => void fetchRideDetails(), 0);
    const refresh = setInterval(() => { if (AppState.currentState === 'active' || Platform.OS === 'web') void fetchRideDetails(); }, 10000);

    let cancelled = false;
    let nativeSubscription: Location.LocationSubscription | null = null;
    let webWatchId: number | null = null;

    const startLocationTracking = async () => {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;

        webWatchId = navigator.geolocation.watchPosition(
          ({ coords, timestamp }) => {
            if (cancelled) return;

            setDriverLocation({
              coords: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                altitude: coords.altitude,
                accuracy: coords.accuracy,
                altitudeAccuracy: coords.altitudeAccuracy,
                heading: coords.heading,
                speed: coords.speed,
              },
              timestamp,
            } as Location.LocationObject);
          },
          () => undefined,
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000,
          },
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (location) => {
          if (!cancelled) setDriverLocation(location);
        },
      );

      if (cancelled) {
        subscription.remove();
        return;
      }

      nativeSubscription = subscription;
    };

    void startLocationTracking();

    return () => {
      cancelled = true;
      clearTimeout(initialFetch);
      clearInterval(refresh);

      if (
        webWatchId !== null &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(webWatchId);
      }

      nativeSubscription?.remove();
    };
  }, [fetchRideDetails]);

  useEffect(() => {
    if (!ride) {
      return;
    }

    const pickupCoordinate = toMapCoordinate(ride.pickup_lat, ride.pickup_lng);
    const dropoffCoordinate = toMapCoordinate(ride.dropoff_lat, ride.dropoff_lng);
    if (!pickupCoordinate || !dropoffCoordinate) {
      return;
    }

    let active = true;
    const key = JSON.stringify([ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng]);

    void api.post('/directions', {
      origin_lat: ride.pickup_lat,
      origin_lng: ride.pickup_lng,
      destination_lat: ride.dropoff_lat,
      destination_lng: ride.dropoff_lng,
    }).then((response) => {
      const coordinates = response.data?.coordinates;
      if (!active || !Array.isArray(coordinates) || coordinates.length < 2) return;

      setRouteResult({ key, coordinates });
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
          animated: true,
        });
      }, 100);
    }).catch(() => {
      // Preserve the direct-line fallback if routing providers are unavailable.
    });

    return () => {
      active = false;
    };
  }, [ride]);

  const updateStatus = async (status: string, extraData: any = {}) => {
    if (!ride) return;
    setActionLoading(true);
    try {
      const response = await api.post(`/tracking/ride/${ride.id}/status`, {
        status,
        ...extraData
      });
      if (response.data.success) {
        await fetchRideDetails();
      }
    } catch (e: any) {
      Alert.alert('Action Failed', e.response?.data?.message || 'Could not update status.');
    } finally {
      setActionLoading(false);
      setShowPinInput(false);
      setShowCompletionConfirm(false);
    }
  };

  const handleCall = () => {
    if (ride?.customer_phone) {
      Linking.openURL(`tel:${ride.customer_phone}`);
    }
  };

  const cancelRide = async () => {
    if (!ride || !cancelReason.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await api.post(`/rides/${ride.id}/cancel`, { reason: cancelReason.trim() });
      await fetchRideDetails();
    } catch (error: any) {
      Alert.alert('Cancellation failed', error.response?.data?.message || 'Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const reportIssue = async () => {
    if (!ride || !issue.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await api.post(`/rides/${ride.id}/issues`, { description: issue.trim() });
      setShowIssue(false);
      setIssue('');
      Alert.alert('Issue recorded', 'Operations can review this report. If anyone is in immediate danger, call emergency services.');
    } catch (error: any) {
      Alert.alert('Report failed', error.response?.data?.message || 'Please try again.');
    } finally { setActionLoading(false); }
  };

  const handleMessage = () => {
    if (ride?.customer_phone) {
      Linking.openURL(`sms:${ride.customer_phone}`);
    }
  };

  const handleNavigate = () => {
    if (!ride) return;
    const destination = ride.status === 'in_transit'
      ? toMapCoordinate(ride.dropoff_lat, ride.dropoff_lng)
      : toMapCoordinate(ride.pickup_lat, ride.pickup_lng);
    if (!destination) {
      Alert.alert(
        'Navigation unavailable',
        'This trip does not have GPS coordinates yet. Please use the written address or ask dispatch to update the booking.',
      );
      return;
    }

    const { latitude: lat, longitude: lng } = destination;
    const label = ride.status === 'in_transit' ? 'Dropoff' : 'Pickup';
    
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`
    });
    
    if (url) Linking.openURL(url);
  };

  const getActionButton = () => {
    if (!ride) return null;

    switch (ride.status) {
      case 'driver_assigned':
        return (
          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: '#3b82f6' }]} 
            onPress={() => updateStatus('on_the_way')}
            disabled={actionLoading}
          >
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.mainButtonText}>Head to Pickup</Text>
                <Navigation color="#fff" size={20} />
              </>
            )}
          </TouchableOpacity>
        );
      case 'on_the_way':
        return (
          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: '#3b82f6' }]} 
            onPress={() => updateStatus('driver_arriving')}
            disabled={actionLoading}
          >
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.mainButtonText}>I Have Arrived</Text>
                <CheckCircle color="#fff" size={20} />
              </>
            )}
          </TouchableOpacity>
        );
      case 'driver_arriving':
        return (
          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: '#8b5cf6' }]} 
            onPress={() => updateStatus('arrived')}
            disabled={actionLoading}
          >
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.mainButtonText}>I have Arrived</Text>
                <CheckCircle color="#fff" size={20} />
              </>
            )}
          </TouchableOpacity>
        );
      case 'pickup':
        return (
          <>
            {showPinInput ? (
              <View style={styles.pinContainer}>
                <Text style={styles.pinTitle}>Verify passenger OTP</Text>
                <Text style={styles.pinHelp}>Ask the passenger for their 4-digit trip code before starting.</Text>
                <TextInput
                  accessibilityLabel="Passenger 4-digit OTP"
                  style={styles.pinInput}
                  placeholder="4-digit OTP"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={pin}
                  onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
                  editable={!actionLoading}
                  autoFocus
                />
                <TouchableOpacity 
                  accessibilityRole="button"
                  style={[styles.mainButton, styles.pinSubmit, (pin.length !== 4 || actionLoading) && styles.pinSubmitDisabled]}
                  onPress={() => updateStatus('started', { start_pin: pin })}
                  disabled={pin.length < 4 || actionLoading}
                >
                   {actionLoading ? <ActivityIndicator color="#fff" /> : <><ShieldCheck color="#fff" size={20} /><Text style={styles.mainButtonText}>Verify OTP & start trip</Text></>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.mainButton, { backgroundColor: '#10b981' }]} 
                accessibilityRole="button"
                onPress={() => setShowPinInput(true)}
              >
                <>
                  <Text style={styles.mainButtonText}>Start Trip (Enter PIN)</Text>
                  <ShieldCheck color="#fff" size={20} />
                </>
              </TouchableOpacity>
            )}
          </>
        );
      case 'in_transit':
        if (showCompletionConfirm) {
          const isCash = ride.payment_method === 'cash';
          const totalFare = Number(ride.total_fare || 0);
          const commissionAmount = Number(
            ride.commission_amount ?? (totalFare * 0.025)
          );
          const driverIncome = Number(
            ride.driver_share ?? Math.max(0, totalFare - commissionAmount)
          );

          return (
            <View style={styles.completionConfirmCard}>
              <View style={styles.cashConfirmHeader}>
                {isCash ? (
                  <Banknote color="#16a34a" size={24} />
                ) : (
                  <CheckCircle color="#0284c7" size={24} />
                )}
                <Text style={styles.cashConfirmTitle}>
                  {isCash ? 'Collect Cash from Customer' : 'Drop-off Confirmation'}
                </Text>
              </View>

              {isCash ? (
                <View style={styles.cashAmountBox}>
                  <Text style={styles.cashAmountSub}>FINAL AMOUNT CUSTOMER MUST PAY</Text>
                  <Text style={styles.cashAmountValue}>₹{totalFare.toFixed(2)}</Text>
                  <Text style={styles.cashAcceptNotice}>
                    Accept full cash payment of ₹{totalFare.toFixed(2)} from customer
                  </Text>
                </View>
              ) : (
                <View style={[styles.cashAmountBox, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
                  <Text style={[styles.cashAmountSub, { color: '#0369a1' }]}>PAID ONLINE (IN-APP)</Text>
                  <Text style={[styles.cashAmountValue, { color: '#0284c7' }]}>₹{totalFare.toFixed(2)}</Text>
                  <Text style={[styles.cashAcceptNotice, { color: '#075985' }]}>
                    Customer has already paid online
                  </Text>
                </View>
              )}

              <View style={styles.fareBreakdownBox}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Total Fare</Text>
                  <Text style={styles.breakdownVal}>₹{totalFare.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    System Charge (~2.5%)
                    {isCash ? ' (Wallet Deduction)' : ''}
                  </Text>
                  <Text style={[styles.breakdownVal, { color: '#dc2626' }]}>
                    -₹{commissionAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                  <Text style={styles.breakdownTotalLabel}>Your Net Income</Text>
                  <Text style={styles.breakdownTotalVal}>₹{driverIncome.toFixed(2)}</Text>
                </View>
              </View>

              {isCash ? (
                <View style={styles.walletDeductNotice}>
                  <Wallet size={16} color="#d97706" />
                  <Text style={styles.walletDeductText}>
                    ₹{commissionAmount.toFixed(2)} system charge will be deducted from your wallet.
                  </Text>
                </View>
              ) : (
                <View style={[styles.walletDeductNotice, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Wallet size={16} color="#059669" />
                  <Text style={[styles.walletDeductText, { color: '#065f46' }]}>
                    ₹{driverIncome.toFixed(2)} net income will be added to your wallet.
                  </Text>
                </View>
              )}

              <View style={styles.completionActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.cancelCompletionButton}
                  onPress={() => setShowCompletionConfirm(false)}
                  disabled={actionLoading}
                >
                  <Text style={styles.cancelCompletionText}>Not yet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.confirmCompletionButton, { backgroundColor: isCash ? '#16a34a' : '#0284c7' }]}
                  onPress={() => updateStatus('completed', { cash_received: isCash })}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.mainButtonText}>
                        {isCash ? 'Accept Cash & Finish' : 'Complete Ride'}
                      </Text>
                      <CheckCircle color="#fff" size={18} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: '#ef4444' }]} 
            onPress={() => setShowCompletionConfirm(true)}
            disabled={actionLoading}
          >
            {actionLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.mainButtonText}>Drop Off</Text>
                <CheckCircle color="#fff" size={20} />
              </>
            )}
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.backButton}
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }}
      >
        <ArrowLeft color="#0f172a" size={24} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.headerDetails}>
        <Text style={styles.bookingNum}>{ride ? `#${ride.booking_number}` : 'Active ride'}</Text>
        {ride && <Text style={styles.statusBadge}>{String(ride.status || 'driver_assigned').replaceAll('_', ' ').toUpperCase()}</Text>}
      </View>
      {ride && <View style={styles.moreBtn}><Compass color="#64748b" size={20} /></View>}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Connecting to system...</Text>
        </View>
      </View>
    );
  }

  if (!ride) return <View style={styles.container}>{header}<View style={styles.centered}><Text>{rideError || 'No active ride.'}</Text><TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} onPress={() => void fetchRideDetails()}><Text>Retry</Text></TouchableOpacity></View></View>;

  const pickupCoordinate = toMapCoordinate(ride.pickup_lat, ride.pickup_lng);
  const dropoffCoordinate = toMapCoordinate(ride.dropoff_lat, ride.dropoff_lng);
  const hasTripCoordinates = Boolean(pickupCoordinate && dropoffCoordinate);
  const customerName = ride.customer_name?.trim() || 'Customer';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {header}

      <ScrollView style={styles.content}>
        {!!rideError && <Text accessibilityRole="alert" style={{ color: '#b91c1c', padding: 16 }}>{rideError}</Text>}
        {pickupCoordinate && dropoffCoordinate ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            googleMapId={GOOGLE_MAP_ID}
            style={styles.map}
            initialRegion={{
              ...pickupCoordinate,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {driverLocation && (
              <Marker
                coordinate={{
                  latitude: driverLocation.coords.latitude,
                  longitude: driverLocation.coords.longitude,
                }}
                title="Your Location"
              >
                <View style={styles.driverMarker}>
                  <Car color="#fff" size={16} />
                </View>
              </Marker>
            )}

            <Marker coordinate={pickupCoordinate} title="Pickup" pinColor="#10b981" />
            <Marker coordinate={dropoffCoordinate} title="Dropoff" pinColor="#ef4444" />

            {routeCoordinates.length >= 2 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3b82f6"
                strokeWidth={5}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapUnavailable}>
            <View style={styles.mapUnavailableIcon}>
              <MapPin color="#0f766e" size={28} />
            </View>
            <Text style={styles.mapUnavailableTitle}>Map coordinates unavailable</Text>
            <Text style={styles.mapUnavailableText}>
              Follow the written pickup and drop-off addresses below. Dispatch can add GPS coordinates to this booking.
            </Text>
          </View>
        )}

        {ride.sharing_requested && <View style={styles.card}>
          <Text style={styles.customerName}>Shared journey</Text>
          <Text>{ride.shared_trip?.accepting ? (ride.shared_trip.allow_extension ? 'Accepting passengers and extensions' : 'Accepting along-route passengers') : 'Not accepting new passengers'}</Text>
          {ride.shared_trip?.stops.map((stop, index) => <Text key={`${stop.booking_id}-${stop.type}`} style={{ marginTop: 10 }}>
            {index + 1}. {stop.type === 'pickup' ? 'Pick up' : 'Drop off'} · {stop.label} · {stop.seats} seat(s)
          </Text>)}
          {<View style={{ gap: 12, marginTop: 16 }}>
            <Text>Open this shared ride to customers ahead of you. Existing passenger arrival limits still apply.</Text>
            {[
              { label: 'Accept along-route passengers', accepting: true, extension: false },
              { label: 'Accept passengers and route extensions', accepting: true, extension: true },
              ...(ride.shared_trip?.accepting ? [{ label: 'Stop accepting new passengers', accepting: false, extension: false }] : []),
            ].map((option) => <TouchableOpacity key={option.label} accessibilityRole="button" disabled={actionLoading} style={styles.cancelCompletionButton} onPress={async () => {
              setActionLoading(true);
              try {
                await api.post(`/rides/${ride.id}/pooling`, { accepting: option.accepting, allow_extension: option.extension });
                await fetchRideDetails();
              } catch (e: any) { Alert.alert('Shared ride', e.response?.data?.message || 'Could not update sharing.'); }
              finally { setActionLoading(false); }
            }}><Text>{option.label}</Text></TouchableOpacity>)}
          </View>}
        </View>}
        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
               <Text style={styles.avatarText}>{customerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.customerInfo}>
               <Text style={styles.customerName}>{customerName}</Text>
               <View style={styles.badgeRow}>
                  <Text style={styles.serviceBadge}>{ride.service_type}</Text>
                  <Text style={styles.fareText}>₹{ride.total_fare}</Text>
               </View>
            </View>
            <View style={styles.actionIcons}>
               <TouchableOpacity onPress={handleCall} style={styles.iconBtn} accessibilityLabel="Call customer">
                  <Phone color="#10b981" size={20} />
               </TouchableOpacity>
               <TouchableOpacity onPress={handleMessage} style={styles.iconBtn} accessibilityLabel="Send message to customer">
                  <MessageCircle color="#3b82f6" size={20} />
               </TouchableOpacity>
            </View>
          </View>

          <View style={styles.locationSection}>
            <View style={styles.locItem}>
               <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
               <View style={styles.locTextContainer}>
                  <Text style={styles.locLabel}>Pickup</Text>
                  <Text style={styles.locValue} numberOfLines={2}>{ride.pickup_location}</Text>
               </View>
            </View>
            <View style={styles.locLine} />
            <View style={styles.locItem}>
               <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
               <View style={styles.locTextContainer}>
                  <Text style={styles.locLabel}>Dropoff</Text>
                  <Text style={styles.locValue} numberOfLines={2}>{ride.dropoff_location}</Text>
               </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.footerActions}>
          <TouchableOpacity
            style={[styles.navBtn, !hasTripCoordinates && styles.navBtnDisabled]}
            onPress={handleNavigate}
          >
            <Navigation color="#fff" size={20} />
            <Text style={styles.navBtnText}>Navigate</Text>
          </TouchableOpacity>
          {getActionButton()}
          {ride.status === 'in_transit' && <View style={{ gap: 12, marginTop: 16 }}>
            {showIssue ? <>
              <Text>Describe the issue (required)</Text>
              <TextInput accessibilityLabel="Ride issue" value={issue} onChangeText={setIssue} maxLength={2000} multiline style={{ borderWidth: 1, borderColor: '#64748b', borderRadius: 8, padding: 12, minHeight: 48 }} />
              <TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} disabled={actionLoading || !issue.trim()} onPress={() => void reportIssue()}><Text>Submit issue</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} onPress={() => setShowIssue(false)}><Text>Back to trip</Text></TouchableOpacity>
            </> : <TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} onPress={() => setShowIssue(true)}><Text>Report issue</Text></TouchableOpacity>}
          </View>}
          {['driver_assigned', 'on_the_way', 'driver_arriving', 'pickup'].includes(ride.status) && (
            <View style={{ gap: 12, marginTop: 16 }}>
              {showCancel ? <>
                <Text style={styles.completionConfirmText}>Cancel this ride? The customer will be notified.</Text>
                <Text>Cancellation reason (required)</Text>
                <TextInput accessibilityLabel="Cancellation reason" value={cancelReason} onChangeText={setCancelReason} maxLength={1000} multiline style={{ borderWidth: 1, borderColor: '#64748b', borderRadius: 8, padding: 12, minHeight: 48 }} />
                <TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} disabled={actionLoading || !cancelReason.trim()} onPress={() => void cancelRide()}><Text style={styles.cancelCompletionText}>{actionLoading ? 'Cancelling…' : 'Confirm cancellation'}</Text></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} disabled={actionLoading} onPress={() => setShowCancel(false)}><Text>Keep ride</Text></TouchableOpacity>
              </> : <TouchableOpacity accessibilityRole="button" style={styles.cancelCompletionButton} disabled={actionLoading} onPress={() => setShowCancel(true)}><Text style={styles.cancelCompletionText}>Cancel ride</Text></TouchableOpacity>}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  bookingNum: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  backButton: { minHeight: 48, minWidth: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
  backText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  headerDetails: { flex: 1, marginHorizontal: 8 },
  statusBadge: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: '#0ea5e9', 
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start'
  },
  moreBtn: { padding: 4 },
  content: { flex: 1 },
  map: {
    height: 350,
    width: '100%',
  },
  mapUnavailable: {
    height: 250,
    paddingHorizontal: 32,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapUnavailableIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapUnavailableTitle: { marginTop: 14, fontSize: 17, fontWeight: '800', color: '#134e4a' },
  mapUnavailableText: { marginTop: 7, fontSize: 13, lineHeight: 19, textAlign: 'center', color: '#0f766e' },
  driverMarker: {
    backgroundColor: '#0ea5e9',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5
  },
  card: {
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#475569' },
  customerInfo: { flex: 1, marginLeft: 12 },
  customerName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  serviceBadge: { fontSize: 12, color: '#64748b', backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  fareText: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  actionIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#f8fafc', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  locationSection: { marginTop: 24 },
  locItem: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  locTextContainer: { marginLeft: 12, flex: 1 },
  locLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  locValue: { fontSize: 14, color: '#334155', marginTop: 2, lineHeight: 20 },
  locLine: { width: 2, height: 20, backgroundColor: '#f1f5f9', marginLeft: 4, marginVertical: 4 },
  footer: {
    maxHeight: '60%',
    flexShrink: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  footerActions: { gap: 12 },
  navBtn: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 54,
    borderRadius: 16,
    gap: 8
  },
  navBtnText: { color: '#fff', fontWeight: '600' },
  navBtnDisabled: { backgroundColor: '#64748b' },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    padding: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  pinContainer: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4' },
  pinTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  pinHelp: { fontSize: 14, lineHeight: 21, color: '#475569' },
  pinSubmit: { backgroundColor: '#0f766e', flex: 0, width: '100%' },
  pinSubmitDisabled: { backgroundColor: '#64748b', elevation: 0 },
  pinInput: {
    width: '100%',
    minHeight: 60,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  completionConfirm: { flex: 1, gap: 8 },
  completionConfirmText: { color: '#334155', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  completionConfirmCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cashConfirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  cashConfirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  cashAmountBox: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  cashAmountSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854d0e',
    letterSpacing: 1,
  },
  cashAmountValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#15803d',
    marginVertical: 4,
  },
  cashAcceptNotice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4d7c0f',
    textAlign: 'center',
  },
  fareBreakdownBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  breakdownVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  breakdownTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16a34a',
  },
  walletDeductNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
  },
  walletDeductText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  completionActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelCompletionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCompletionText: { color: '#475569', fontWeight: '700' },
  confirmCompletionButton: {
    flex: 1.6,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
