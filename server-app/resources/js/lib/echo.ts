import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Necessary for Laravel Echo to find the Pusher client
(window as any).Pusher = Pusher;

/**
 * Laravel Echo configuration
 * 
 * This client provides real-time event broadcasting and private channel 
 * synchronization using Sanctum Bearer tokens for authorization.
 */
const echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY || 'local',
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
    wsHost: import.meta.env.VITE_PUSHER_HOST || window.location.hostname,
    wsPort: Number(import.meta.env.VITE_PUSHER_PORT) || 6001,
    wssPort: Number(import.meta.env.VITE_PUSHER_PORT) || 6001,
    forceTLS: import.meta.env.VITE_PUSHER_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    // Use an authorization endpoint that handles Sanctum tokens
    authorizer: (channel: any, options: any) => {
        return {
            authorize: (socketId: string, callback: (error: Error | null, response: any) => void) => {
                const token = localStorage.getItem('auth_token');
                
                if (!token) {
                    callback(new Error('No authentication token found'), null);
                    return;
                }

                // Determine if we should use the broad API or session-based broadcast auth
                const authEndpoint = '/api/broadcasting/auth';
                
                fetch(authEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({
                        socket_id: socketId,
                        channel_name: channel.name
                    })
                })
                .then(response => {
                    if (!response.ok) throw new Error('Broadcast auth failed');
                    return response.json();
                })
                .then(data => {
                    callback(null, data);
                })
                .catch(error => {
                    callback(error instanceof Error ? error : new Error(String(error)), null);
                });
            }
        };
    },
});

export default echo;
