import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import api, { apiErrorMessage } from './api';

export function useAccountData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try { const result = await fetcher(); if (generation.current === request) setData(result); }
    catch (err) { if (generation.current === request) setError(apiErrorMessage(err)); }
    finally { if (generation.current === request) setLoading(false); }
  }, [fetcher]);
  useFocusEffect(useCallback(() => { void reload(); return () => { generation.current++; }; }, [reload]));
  return { data, loading, error, reload };
}

export type BookingUpdate = { id: number; kind: 'ride' | 'tour' | 'rental'; title: string; status: string; updatedAt: string; key: string };
export async function getBookingUpdates(): Promise<BookingUpdate[]> {
  const kinds = ['ride', 'tour', 'rental'] as const;
  const endpoints = ['/rides', '/tour-bookings', '/car-rentals'];
  const responses = await Promise.all(endpoints.map(endpoint => api.get(endpoint)));
  return responses.flatMap((response, index) => (response.data.data.data || []).map((booking: any) => ({
    id: booking.id, kind: kinds[index], title: booking.tour?.title || booking.car_category?.name || booking.dropoff_location || `${kinds[index]} booking #${booking.id}`,
    status: booking.status, updatedAt: booking.updated_at || booking.created_at,
    key: `${kinds[index]}:${booking.id}:${booking.status}:${booking.updated_at || booking.created_at}`,
  }))).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
