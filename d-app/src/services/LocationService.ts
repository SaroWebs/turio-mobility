import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import api from '../lib/api';

const LOCATION_TASK_NAME = 'background-location-task';
let foregroundSubscription: Location.LocationSubscription | null = null;
let trackingGeneration = 0;
const supportsBackgroundTracking = () => Platform.OS !== 'web' && !isRunningInExpoGo();

async function watchForeground(generation: number) {
    const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
    }, (location) => {
        if (generation !== trackingGeneration) return;
        void postLocation(location).catch(() => console.warn('Failed to publish foreground location'));
    });
    if (generation !== trackingGeneration) subscription.remove();
    else foregroundSubscription = subscription;
}

async function postLocation(location: Location.LocationObject) {
    await api.post('/tracking/location', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading !== null && location.coords.heading >= 0 ? location.coords.heading : null,
        speed: location.coords.speed !== null && location.coords.speed >= 0 ? location.coords.speed : null,
        accuracy: location.coords.accuracy,
        recorded_at: new Date(location.timestamp || Date.now()).toISOString(),
    });
}

function developmentLocation(): Location.LocationObject | null {
    if (!__DEV__) return null;

    const latitude = Number(process.env.EXPO_PUBLIC_DRIVER_TEST_LAT);
    const longitude = Number(process.env.EXPO_PUBLIC_DRIVER_TEST_LNG);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
        coords: {
            latitude,
            longitude,
            altitude: null,
            accuracy: 10,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
        },
        timestamp: Date.now(),
    };
}

export const LocationService = {
    async requestPermissions() {
        if (developmentLocation()) return true;

        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        if (foregroundStatus !== 'granted') return false;

        if (supportsBackgroundTracking()) {
            // Foreground GPS is enough to publish the initial dispatch position.
            // A native development build can additionally enable background updates.
            try {
                await Location.requestBackgroundPermissionsAsync();
            } catch {
                // Background permission is optional for becoming dispatchable.
            }
        }

        return true;
    },

    async startTracking() {
        const generation = ++trackingGeneration;
        foregroundSubscription?.remove();
        foregroundSubscription = null;
        const currentLocation = developmentLocation() ?? await Location.getCurrentPositionAsync({
            accuracy: Platform.OS === 'web' ? Location.Accuracy.Balanced : Location.Accuracy.High,
        });
        if (generation !== trackingGeneration) return;
        await postLocation(currentLocation);

        if (generation !== trackingGeneration || developmentLocation()) return;

        if (!supportsBackgroundTracking()) {
            await watchForeground(generation);
            return;
        }

        const backgroundPermission = await Location.getBackgroundPermissionsAsync();
        if (generation !== trackingGeneration) return;
        if (backgroundPermission.status !== 'granted') {
            await watchForeground(generation);
            return;
        }

        const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (started) return;

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000, // 10 seconds
            distanceInterval: 10, // 10 meters
            deferredUpdatesInterval: 10000,
            foregroundService: {
                notificationTitle: 'Turiya Mobility Driver',
                notificationBody: 'You are online and tracking is active',
                notificationColor: '#0ea5e9',
            },
        });
        if (generation !== trackingGeneration) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
    },

    async stopTracking() {
        ++trackingGeneration;
        foregroundSubscription?.remove();
        foregroundSubscription = null;
        if (!supportsBackgroundTracking()) return;

        const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (started) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
    }
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
        console.error('Location task error:', error);
        return;
    }
    if (data) {
        const { locations } = data;
        const location = locations[0];
        if (location) {
            try {
                await postLocation(location);
            } catch {
                console.warn('Failed to ping location to server');
            }
        }
    }
});
