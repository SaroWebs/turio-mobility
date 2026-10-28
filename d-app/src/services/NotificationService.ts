import * as PusherModule from 'pusher-js';
import { API_URL } from '../lib/api';

const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_APP_KEY || 'fe07bce48a458c6002ed';
const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER || 'ap2';
const PUSHER_HOST = process.env.EXPO_PUBLIC_PUSHER_HOST;
const PUSHER_PORT = Number(process.env.EXPO_PUBLIC_PUSHER_PORT || 443);
const PUSHER_SCHEME = process.env.EXPO_PUBLIC_PUSHER_SCHEME || 'https';

interface RealtimeChannel {
    bind: (event: string, callback: (payload: any) => void) => void;
}

export interface RealtimeClient {
    disconnect: () => void;
    subscribe: (channel: string) => RealtimeChannel;
}

type PusherConstructor = new (key: string, options: Record<string, unknown>) => RealtimeClient;

function resolvePusherConstructor(): PusherConstructor | null {
    const moduleValue = PusherModule as unknown as {
        Pusher?: PusherConstructor;
        default?: PusherConstructor | { Pusher?: PusherConstructor };
    };
    const defaultExport = moduleValue.default;
    const constructor = moduleValue.Pusher
        ?? (typeof defaultExport === 'object' ? defaultExport?.Pusher : defaultExport);

    return typeof constructor === 'function' ? constructor : null;
}

export const setupPusher = (
    driverId: number,
    token: string,
    onRideRequest: (ride: any) => void,
): RealtimeClient | null => {
    // Until a realtime provider is configured, the dashboard polling fallback
    // continues to deliver pending ride requests without crashing Expo Go.
    if (!PUSHER_KEY) {
        if (__DEV__) console.info('Realtime notifications are disabled: no Pusher key configured.');
        return null;
    }

    const PusherConstructor = resolvePusherConstructor();
    if (!PusherConstructor) {
        console.warn('Realtime notifications are unavailable: Pusher could not be initialized.');
        return null;
    }

    const apiOrigin = API_URL.replace(/\/api\/driver-app\/?$/, '');

    try {
        const pusher = new PusherConstructor(PUSHER_KEY, {
            cluster: PUSHER_CLUSTER,
            forceTLS: PUSHER_SCHEME === 'https',
            ...(PUSHER_HOST ? {
                wsHost: PUSHER_HOST,
                wsPort: PUSHER_PORT,
                wssPort: PUSHER_PORT,
                enabledTransports: ['ws', 'wss'],
            } : {}),
            channelAuthorization: {
                endpoint: `${apiOrigin}/broadcasting/auth`,
                transport: 'ajax',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            },
        });

        const handleRequest = (request: any) => onRideRequest({
            ...request,
            id: request.id ?? request.ride_id,
            distance_km: request.distance_km ?? request.estimated_distance_km,
        });
        const channels = [
            pusher.subscribe(`private-driver.${driverId}`),
            pusher.subscribe('private-drivers.available'),
        ];
        channels.forEach((channel) => channel.bind('ride.new_request', handleRequest));

        return pusher;
    } catch (error) {
        console.warn('Realtime notifications failed to start; polling will remain active.', error);
        return null;
    }
};
