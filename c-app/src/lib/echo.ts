import EchoModule from 'laravel-echo';
import * as PusherModule from 'pusher-js';
import SecureStore from './secure-store';
import { API_URL } from './api';

function resolvePusherConstructor(): any {
    const mod = PusherModule as any;
    return [mod.default?.default, mod.default?.Pusher, mod.Pusher, mod.default, mod]
        .find((candidate) => typeof candidate === 'function') ?? null;
}

function resolveEchoConstructor(): any {
    const mod = EchoModule as any;
    return [mod.default?.default, mod.default?.Echo, mod.Echo, mod.default, mod]
        .find((candidate) => typeof candidate === 'function') ?? null;
}

const PusherClass = resolvePusherConstructor();
const EchoClass = resolveEchoConstructor();

if (PusherClass) {
    (globalThis as any).Pusher = PusherClass;
    if (typeof window !== 'undefined') {
        (window as any).Pusher = PusherClass;
    }
}

export interface RealtimeChannel {
    listen(event: string, callback: (payload: any) => void): RealtimeChannel;
    stopListening(event: string): RealtimeChannel;
}

export interface RealtimeClient {
    private(channel: string): RealtimeChannel;
    channel(channel: string): RealtimeChannel;
    leave(channel: string): void;
    disconnect(): void;
}

// Polling remains active when sockets are unavailable. Match both the fluent
// subscription API and its cleanup API so leaving a screen is always safe.
export const createEchoStub = (): RealtimeClient => {
    const channel: RealtimeChannel = {
        listen: () => channel,
        stopListening: () => channel,
    };
    return {
        private: () => channel,
        channel: () => channel,
        leave: () => {},
        disconnect: () => {},
    };
};

export const initEcho = async (): Promise<RealtimeClient> => {
    try {
        const token = await SecureStore.getItemAsync('auth_token');
        const apiOrigin = API_URL.replace(/\/api\/customer-app\/?$/, '');
        const key = process.env.EXPO_PUBLIC_PUSHER_APP_KEY || 'fe07bce48a458c6002ed';
        const cluster = process.env.EXPO_PUBLIC_PUSHER_APP_CLUSTER || 'ap2';
        const host = process.env.EXPO_PUBLIC_PUSHER_HOST;
        const port = Number(process.env.EXPO_PUBLIC_PUSHER_PORT || 443);
        const scheme = process.env.EXPO_PUBLIC_PUSHER_SCHEME || 'https';

        if (!PusherClass || !EchoClass || !key) {
            console.warn('Pusher/Echo client not available, returning safe fallback.');
            return createEchoStub();
        }

        const pusherClient = new PusherClass(key, {
            cluster,
            forceTLS: scheme === 'https',
            ...(host ? {
                wsHost: host,
                wsPort: port,
                wssPort: port,
                enabledTransports: ['ws', 'wss'],
            } : {}),
            channelAuthorization: {
                endpoint: `${apiOrigin}/broadcasting/auth`,
                transport: 'ajax',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            },
            authEndpoint: `${apiOrigin}/broadcasting/auth`,
            auth: {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            },
        });

        return new EchoClass({
            broadcaster: 'pusher',
            client: pusherClient,
            Pusher: PusherClass,
            key,
            cluster,
            forceTLS: scheme === 'https',
            authEndpoint: `${apiOrigin}/broadcasting/auth`,
            auth: {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            },
        });
    } catch (error) {
        console.warn('Failed to initialize Laravel Echo, falling back to polling.', error);
        return createEchoStub();
    }
};
