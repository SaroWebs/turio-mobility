import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

export type CustomerRealtimeEvent =
  | 'booking.created'
  | 'booking.accepted'
  | 'booking.cancelled'
  | 'booking.completed'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.updated'
  | 'tracking.location.updated'
  | 'tracking.stale'
  | 'support.updated'

export type CustomerRealtimePayload = {
  bookingId?: string
  serviceType?: 'ride' | 'tour' | 'rental'
  status?: string
  message: string
  updatedAt: string
}

export type CustomerRealtimeHandler = (payload: CustomerRealtimePayload) => void

export type CustomerRealtimeClient = {
  subscribe: (event: CustomerRealtimeEvent, handler: CustomerRealtimeHandler) => () => void
  publishDemo: (event: CustomerRealtimeEvent, payload: CustomerRealtimePayload) => void
  subscribeToCustomerChannel: (customerId: number | string, token: string) => () => void
  subscribeToBookingChannel: (type: 'ride' | 'tour' | 'rental', bookingId: number | string, token: string) => () => void
  disconnect: () => void
}

// In-memory local pub/sub for handlers registered by components
const handlers = new Map<CustomerRealtimeEvent, Set<CustomerRealtimeHandler>>()

function dispatch(event: CustomerRealtimeEvent, payload: CustomerRealtimePayload) {
  handlers.get(event)?.forEach((handler) => handler(payload))
}

// Shared Echo instance — created once when a token is available
let echoInstance: Echo<'pusher'> | null = null
let pollFallbackInterval: ReturnType<typeof setInterval> | null = null

function getOrCreateEcho(token: string): Echo<'pusher'> | null {
  const appKey = import.meta.env.VITE_PUSHER_APP_KEY
  const wsHost = import.meta.env.VITE_PUSHER_HOST || window.location.hostname
  const wsPort = Number(import.meta.env.VITE_PUSHER_PORT || 6001)
  const wsScheme = import.meta.env.VITE_PUSHER_SCHEME || 'ws'
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'ap2'

  if (!appKey) {
    // Pusher key not configured — polling fallback only
    return null
  }

  if (echoInstance) return echoInstance

  window.Pusher = Pusher

  const forceTLS = wsScheme === 'https' || wsScheme === 'wss'

  echoInstance = new Echo({
    broadcaster: 'pusher',
    key: appKey,
    cluster,
    wsHost,
    wsPort: forceTLS ? 443 : wsPort,
    wssPort: 443,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${import.meta.env.VITE_API_URL?.trim() || '/api/customer-app'}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  })

  // Surface connection errors without crashing
  echoInstance.connector.pusher.connection.bind('error', (err: unknown) => {
    console.warn('[realtime] Pusher connection error — polling fallback active', err)
  })

  return echoInstance
}

export function createCustomerRealtimeClient(): CustomerRealtimeClient {
  return {
    subscribe(event, handler) {
      const eventHandlers = handlers.get(event) ?? new Set<CustomerRealtimeHandler>()
      eventHandlers.add(handler)
      handlers.set(event, eventHandlers)
      return () => {
        eventHandlers.delete(handler)
      }
    },

    publishDemo(event, payload) {
      dispatch(event, payload)
    },

    /**
     * Subscribe to the private customer channel for notifications and booking events.
     * Returns an unsubscribe function.
     * Falls back gracefully if Echo is unavailable.
     */
    subscribeToCustomerChannel(customerId, token) {
      const echo = getOrCreateEcho(token)
      if (!echo) return () => {}

      const channelName = `customer.${customerId}`

      const channel = echo.private(channelName)

      const eventMap: [string, CustomerRealtimeEvent][] = [
        ['BookingCreated', 'booking.created'],
        ['BookingAccepted', 'booking.accepted'],
        ['BookingCancelled', 'booking.cancelled'],
        ['BookingCompleted', 'booking.completed'],
        ['PaymentSucceeded', 'payment.succeeded'],
        ['PaymentFailed', 'payment.failed'],
        ['RefundUpdated', 'refund.updated'],
        ['SupportUpdated', 'support.updated'],
      ]

      for (const [pusherEvent, realtimeEvent] of eventMap) {
        channel.listen(`.${pusherEvent}`, (data: CustomerRealtimePayload) => {
          dispatch(realtimeEvent, data)
        })
      }

      return () => {
        echo.leave(channelName)
      }
    },

    /**
     * Subscribe to a specific booking's private channel for live tracking.
     * Returns an unsubscribe function.
     */
    subscribeToBookingChannel(type, bookingId, token) {
      const echo = getOrCreateEcho(token)
      if (!echo) return () => {}

      const channelName = `${type}.${bookingId}`

      const channel = echo.private(channelName)

      channel.listen('.TrackingLocationUpdated', (data: CustomerRealtimePayload) => {
        dispatch('tracking.location.updated', data)
      })

      channel.listen('.TrackingStale', (data: CustomerRealtimePayload) => {
        dispatch('tracking.stale', data)
      })

      return () => {
        echo.leave(channelName)
      }
    },

    disconnect() {
      if (pollFallbackInterval) {
        clearInterval(pollFallbackInterval)
        pollFallbackInterval = null
      }
      if (echoInstance) {
        echoInstance.disconnect()
        echoInstance = null
      }
      handlers.clear()
    },
  }
}

export const customerRealtime = createCustomerRealtimeClient()

export const realtimeContractNotes = [
  'Use private customer channels scoped by authenticated customer id.',
  'Keep polling fallbacks active when Echo/Pusher disconnects.',
  'Include bookingId, serviceType, status, message, and updatedAt in every customer event.',
  'Treat stale tracking and no-driver-yet as explicit states, not missing data.',
]
