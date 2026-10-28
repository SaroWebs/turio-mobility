import { useEffect, useRef, useCallback, useState } from 'react';
import axios from './axios';

// Types for WebSocket events
export interface RideLocationEvent {
  booking_id: number;
  booking_number: string;
  latitude: number;
  longitude: number;
  status: string;
  eta?: number;
  timestamp: string;
}

export interface RideStatusEvent {
  booking_id: number;
  booking_number: string;
  status: string;
  message?: string;
  timestamp: string;
}

export interface DriverLocationEvent {
  driver_id: number;
  driver_name: string;
  latitude: number;
  longitude: number;
  is_available: boolean;
  timestamp: string;
}

type EventCallback<T> = (data: T) => void;

interface WebSocketHookOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * Custom hook for WebSocket connections with Laravel Echo
 */
export function useWebSocket(options: WebSocketHookOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const echoRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Laravel Echo if available
    if (typeof window !== 'undefined' && (window as any).Echo) {
      echoRef.current = (window as any).Echo;
      
      // Check connection status
      if (echoRef.current?.connector?.pusher) {
        setIsConnected(true);
        options.onConnect?.();
      }
    }

    return () => {
      // Do not force-disconnect the global Echo client from a leaf hook.
    };
  }, []);

  return {
    isConnected,
    echo: echoRef.current,
  };
}

/**
 * Hook to subscribe to ride location updates
 */
export function useRideTracking(
  bookingId: number | null,
  onLocationUpdate?: EventCallback<RideLocationEvent>,
  onStatusUpdate?: EventCallback<RideStatusEvent>
) {
  const [location, setLocation] = useState<RideLocationEvent | null>(null);
  const [status, setStatus] = useState<RideStatusEvent | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!bookingId || typeof window === 'undefined' || !(window as any).Echo) {
      return;
    }

    const Echo = (window as any).Echo;

    // Subscribe to private ride channel
    channelRef.current = Echo.private(`ride.${bookingId}`);

    // Listen for location updates
    channelRef.current.listen('.location.updated', (data: RideLocationEvent) => {
      setLocation(data);
      onLocationUpdate?.(data);
    });

    // Listen for status updates
    channelRef.current.listen('.status.updated', (data: RideStatusEvent) => {
      setStatus(data);
      onStatusUpdate?.(data);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.stopListening('.location.updated');
        channelRef.current.stopListening('.status.updated');
        channelRef.current.unsubscribe();
      }
    };
  }, [bookingId, onLocationUpdate, onStatusUpdate]);

  return { location, status };
}

/**
 * Hook to subscribe to driver location updates
 */
export function useDriverTracking(
  driverId: number | null,
  onLocationUpdate?: EventCallback<DriverLocationEvent>
) {
  const [location, setLocation] = useState<DriverLocationEvent | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!driverId || typeof window === 'undefined' || !(window as any).Echo) {
      return;
    }

    const Echo = (window as any).Echo;

    // Subscribe to private driver channel
    channelRef.current = Echo.private(`driver.${driverId}.location`);

    // Listen for location updates
    channelRef.current.listen('.driver.location', (data: DriverLocationEvent) => {
      setLocation(data);
      onLocationUpdate?.(data);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.stopListening('.driver.location');
        channelRef.current.unsubscribe();
      }
    };
  }, [driverId, onLocationUpdate]);

  return { location };
}

/**
 * Hook to subscribe to user's rides channel
 */
export function useUserRidesChannel(
  userId: number | null,
  onLocationUpdate?: EventCallback<RideLocationEvent>,
  onStatusUpdate?: EventCallback<RideStatusEvent>
) {
  const [latestEvent, setLatestEvent] = useState<RideLocationEvent | RideStatusEvent | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!userId || typeof window === 'undefined' || !(window as any).Echo) {
      return;
    }

    const Echo = (window as any).Echo;

    // Subscribe to user's rides channel
    channelRef.current = Echo.private(`user.${userId}.rides`);

    // Listen for location updates
    channelRef.current.listen('.location.updated', (data: RideLocationEvent) => {
      setLatestEvent(data);
      onLocationUpdate?.(data);
    });

    // Listen for status updates
    channelRef.current.listen('.status.updated', (data: RideStatusEvent) => {
      setLatestEvent(data);
      onStatusUpdate?.(data);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.stopListening('.location.updated');
        channelRef.current.stopListening('.status.updated');
        channelRef.current.unsubscribe();
      }
    };
  }, [userId, onLocationUpdate, onStatusUpdate]);

  return { latestEvent };
}

/**
 * Hook for driver to subscribe to their rides channel
 */
export function useDriverRidesChannel(
  driverId: number | null,
  onStatusUpdate?: EventCallback<RideStatusEvent>
) {
  const [latestStatus, setLatestStatus] = useState<RideStatusEvent | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!driverId || typeof window === 'undefined' || !(window as any).Echo) {
      return;
    }

    const Echo = (window as any).Echo;

    // Subscribe to driver's rides channel
    channelRef.current = Echo.private(`driver.${driverId}.rides`);

    // Listen for status updates
    channelRef.current.listen('.status.updated', (data: RideStatusEvent) => {
      setLatestStatus(data);
      onStatusUpdate?.(data);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.stopListening('.status.updated');
        channelRef.current.unsubscribe();
      }
    };
  }, [driverId, onStatusUpdate]);

  return { latestStatus };
}

/**
 * API functions for tracking
 */
export const trackingApi = {
  /**
   * Update driver location
   */
  async updateDriverLocation(latitude: number, longitude: number, isAvailable: boolean = true) {
    const response = await axios.post('/tracking/driver-location', {
      latitude,
      longitude,
      is_available: isAvailable,
    });
    return response.data;
  },

  /**
   * Update ride location
   */
  async updateRideLocation(bookingId: number, latitude: number, longitude: number, eta?: number) {
    const response = await axios.post(`/tracking/ride/${bookingId}/location`, {
      latitude,
      longitude,
      eta,
    });
    return response.data;
  },

  /**
   * Update ride status
   */
  async updateRideStatus(bookingId: number, status: string, message?: string, startPin?: string) {
    const response = await axios.post(`/tracking/ride/${bookingId}/status`, {
      status,
      message,
      start_pin: startPin,
    });
    return response.data;
  },

  /**
   * Get tracking info for a ride
   */
  async getTrackingInfo(bookingId: number) {
    const response = await axios.get(`/tracking/ride/${bookingId}`);
    return response.data;
  },
};
