import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import DriverHomeContent from '../../components/DriverHomeContent';
import { useAuthStore } from '../../src/store/auth';
import { LocationService } from '../../src/services/LocationService';
import api from '../../src/lib/api';
import RideRequestModal from '../../components/RideRequestModal';
import { setupPusher } from '../../src/services/NotificationService';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { cmsText, fetchCms, type CmsPayload } from '../../src/lib/cms';
import { canUseDriverServices } from '../../src/lib/driver-access';

export default function DriverDashboard() {
  const router = useRouter();
  const { user, token, setOnlineStatus, setDriver } = useAuthStore();
  const servicesAvailable = canUseDriverServices(user);
  const [isOnline, setIsOnline] = useState(user?.is_online || false);
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<any | null>(null);
  const [vehicleReadiness, setVehicleReadiness] = useState<any | null>(null);
  const [documentVerification, setDocumentVerification] = useState<any | null>(null);
  const [tourAssignments, setTourAssignments] = useState<any[]>([]);
  const [rentalAssignments, setRentalAssignments] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any | null>(null);
  const [locationError, setLocationError] = useState('');
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [cms, setCms] = useState<CmsPayload>({});
  const locationRecoveryAttempted = useRef(false);
  const dashboardRefreshPending = useRef(false);
  const availabilityUpdatePending = useRef(false);
  const declinedRideIds = useRef<Set<number>>(new Set());

  const fetchDashboardData = useCallback(async () => {
    if (dashboardRefreshPending.current) return;
    dashboardRefreshPending.current = true;

    try {
      const response = await api.get('/dashboard');
      if (response.data.success) {
        const serverIsOnline = canUseDriverServices(response.data.driver) && response.data.availability?.status === 'online';
        setDriver(response.data.driver);
        if (!canUseDriverServices(response.data.driver)) {
          setModalVisible(false);
          setActiveRequest(null);
        }
        setStats(response.data.stats);
        setWallet(response.data.wallet || null);
        if (!availabilityUpdatePending.current) {
          setIsOnline(serverIsOnline);
          setOnlineStatus(serverIsOnline);
        }
        setVehicle(response.data.vehicle || null);
        setVehicleReadiness(response.data.vehicle_readiness || null);
        setDocumentVerification(response.data.document_verification || null);
        setTourAssignments(response.data.tour_assignments || []);
        setRentalAssignments(response.data.rental_assignments || []);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    } finally {
      dashboardRefreshPending.current = false;
      setLoading(false);
    }
  }, [setOnlineStatus, setDriver]);

  useEffect(() => {
    fetchCms('driver-app').then(setCms).catch(() => setCms({}));
  }, []);

  useEffect(() => {
    if (servicesAvailable) return;
    locationRecoveryAttempted.current = false;
    void LocationService.stopTracking().catch(() => undefined);
  }, [servicesAvailable]);

  useFocusEffect(useCallback(() => {
    void fetchDashboardData();
    const refreshTimer = setInterval(() => void fetchDashboardData(), 10_000);

    return () => clearInterval(refreshTimer);
  }, [fetchDashboardData]));

  useEffect(() => {
    if (!servicesAvailable || loading || updatingAvailability || !isOnline || !token || locationRecoveryAttempted.current) return;

    let cancelled = false;
    locationRecoveryAttempted.current = true;

    void (async () => {
      try {
        const hasPermission = await LocationService.requestPermissions();
        if (!hasPermission) throw new Error('Location permission is required while you are online.');
        await LocationService.startTracking();
        setLocationError('');
      } catch (error: any) {
        if (cancelled) return;
        await api.put('/availability', { is_online: false, is_available: false }).catch(() => undefined);
        setIsOnline(false);
        setOnlineStatus(false);
        setLocationError(error?.message || 'Your GPS location could not be published. Enable location access and try again.');
      }
    })();

    return () => { cancelled = true; };
  }, [servicesAvailable, isOnline, loading, setOnlineStatus, token, updatingAvailability]);

  useEffect(() => {
    if (servicesAvailable && user?.id && token) {
      const pusher = setupPusher(user.id, token, (ride) => {
        if (ride?.id && declinedRideIds.current.has(Number(ride.id))) return;
        setActiveRequest(ride);
        setModalVisible(true);
      });

      return () => {
        pusher?.disconnect();
      };
    }
  }, [servicesAvailable, token, user?.id]);

  useEffect(() => {
    if (!servicesAvailable || !isOnline || modalVisible) return;

    let mounted = true;
    const fetchPendingRide = async () => {
      try {
        const response = await api.get('/pending-rides');
        const rides = response.data?.rides || [];
        const availableRide = rides.find((r: any) => !declinedRideIds.current.has(Number(r.id)));
        if (mounted && availableRide) {
          setActiveRequest(availableRide);
          setModalVisible(true);
        }
      } catch (error) {
        console.error('Failed to refresh pending rides', error);
      }
    };

    void fetchPendingRide();
    const poller = setInterval(fetchPendingRide, 5000);
    return () => {
      mounted = false;
      clearInterval(poller);
    };
  }, [servicesAvailable, isOnline, modalVisible]);

  const handleAcceptRide = async (id: number) => {
    if (!servicesAvailable) return;
    try {
      const response = await api.post(`/rides/${id}/accept`);
      setModalVisible(false);
      setActiveRequest(null);
      if (response.data.success) {
        router.push({
          pathname: '/active-ride',
          params: { id: response.data.ride.id }
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to accept ride.');
    }
  };

  const handleDeclineRide = async (id: number) => {
    if (id) declinedRideIds.current.add(Number(id));
    setModalVisible(false);
    setActiveRequest(null);
    try {
      await api.post(`/rides/${id}/decline`, { reason: 'Driver declined from request screen' });
    } catch (error) {
      console.error('Failed to decline ride', error);
    }
  };

  const toggleOnline = async (value: boolean) => {
    if (value && !servicesAvailable) return;
    let currentReadiness = vehicleReadiness;
    if (value) {
      try {
        const response = await api.get('/vehicle', { params: { fresh: Date.now() } });
        setVehicle(response.data?.vehicle || null);
        currentReadiness = response.data?.vehicle_readiness || null;
        setVehicleReadiness(currentReadiness);
      } catch {
        // The availability request below still returns the authoritative readiness error.
      }
    }

    if (value && !currentReadiness?.can_go_online) {
      const needsDocuments = currentReadiness?.action === 'documents' || currentReadiness?.status === 'documents_required';
      Alert.alert(currentReadiness?.status === 'documents_pending' ? 'Documents in review' : needsDocuments ? 'Documents required' : 'Approval required', currentReadiness?.message || 'Complete verification before going online.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: needsDocuments ? 'Open documents' : 'Open My car',
          onPress: () => router.push((needsDocuments ? '/documents' : '/my-car') as Href),
        },
      ]);
      return;
    }

    if (value && wallet && Number(wallet.balance_minor ?? 0) < 10000) {
      Alert.alert(
        'Wallet Balance Low',
        'Your wallet balance is below ₹100. Minimum ₹500 top-up is required to go online and accept rides.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up Now', onPress: () => router.push('/(tabs)/wallet' as Href) }
        ]
      );
      return;
    }

    const previousValue = isOnline;
    availabilityUpdatePending.current = true;
    setUpdatingAvailability(true);
    setLocationError('');
    setIsOnline(value);
    setOnlineStatus(value);

    try {
      if (value) {
        const hasPermission = await LocationService.requestPermissions();
        if (!hasPermission) {
          throw new Error('Location access is required to go online. Allow it in your browser or device settings, then try again.');
        }
        await LocationService.startTracking();
        locationRecoveryAttempted.current = true;
      } else {
        await LocationService.stopTracking();
        locationRecoveryAttempted.current = false;
      }

      await api.put('/availability', { is_online: value, is_available: value });
    } catch (e: any) {
      if (value) await LocationService.stopTracking();
      setIsOnline(previousValue);
      setOnlineStatus(previousValue);
      setLocationError(e.response?.data?.message || e.message || 'Failed to update availability status.');
    } finally {
      availabilityUpdatePending.current = false;
      setUpdatingAvailability(false);
    }
  };

  return <>
    <DriverHomeContent name={user?.name} online={isOnline} busy={updatingAvailability} loading={loading}
      servicesAvailable={servicesAvailable} stats={stats} wallet={wallet} vehicle={vehicle}
      readiness={vehicleReadiness} documents={documentVerification} rating={(user as any)?.rating || stats?.rating}
      assignments={tourAssignments.length + rentalAssignments.length} locationError={locationError}
      onlineTitle={cmsText(cms, 'dashboard', 'availability', 'online_title', 'You’re online')}
      offlineTitle={cmsText(cms, 'dashboard', 'availability', 'offline_title', 'You’re offline')}
      onOnline={toggleOnline} onRefresh={() => { setLoading(true); void fetchDashboardData(); }} onNavigate={(path) => router.push(path as Href)} />
    <RideRequestModal visible={servicesAvailable && modalVisible} ride={activeRequest} onAccept={handleAcceptRide} onDecline={handleDeclineRide} />
  </>;
}
