import api, { API_URL } from './api';

export type CarpoolLocation = { name: string; lat: number; lng: number };
export type CarpoolTrip = {
  id: number;
  origin: string;
  destination: string;
  departure_at: string;
  timezone: string;
  duration_minutes: number;
  remaining_seats: number;
  price_minor: number;
  fee_minor: number;
  total_minor: number;
  currency: string;
  booking_mode: string;
  luggage: string;
  preferences: { smoking: boolean; pets: boolean; ac: boolean };
  cancellation: { free_hours: number; late_refund_bps: number };
  driver: { name: string; verified: boolean; rating: number | string | null; completed_trips: number };
  vehicle: { make: string; model: string };
};

export async function findCarpoolTrips(origin: CarpoolLocation, destination: CarpoolLocation, signal: AbortSignal) {
  const response = await api.get<{ data: CarpoolTrip[] }>('/rides', {
    // Reuse the authenticated client while addressing the sibling Carpool API.
    baseURL: API_URL.replace(/\/customer-app$/, '/carpool'),
    signal,
    params: {
      origin: origin.name,
      destination: destination.name,
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      seats: 1,
      sort: 'departure',
    },
  });
  return response.data.data;
}

export function carpoolTiming(trip: Pick<CarpoolTrip, 'departure_at' | 'duration_minutes' | 'timezone'>) {
  const departure = new Date(trip.departure_at);
  const arrival = new Date(departure.getTime() + trip.duration_minutes * 60_000);
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone: trip.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const hours = Math.floor(trip.duration_minutes / 60);
  const minutes = trip.duration_minutes % 60;
  return {
    departure: formatter.format(departure),
    arrival: formatter.format(arrival),
    duration: `${hours ? `${hours}h ` : ''}${minutes}m`,
  };
}

export const carpoolMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
