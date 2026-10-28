export type ServiceKind = 'ride' | 'tour' | 'rental';

export interface RideTask {
  id: number;
  booking_number?: string;
  status: string;
  pickup_location?: string;
  dropoff_location?: string;
  customer_name?: string;
  total_fare?: number | string;
  scheduled_at?: string;
}

export interface TourBookingTask {
  id: number;
  booking_number?: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  number_of_adults?: number;
  number_of_children?: number;
  total_price?: number | string;
  customer?: { name?: string; phone?: string };
}

export interface TourAssignmentTask {
  id: number;
  status: string;
  role?: string;
  fee?: number | string;
  notes?: string;
  schedule?: {
    departure_date?: string;
    departure_time?: string;
    meeting_point?: string;
    tour?: {
      title?: string;
      start_location?: string;
      end_location?: string;
      duration_days?: number;
      itineraries?: { id: number; day_number?: number; title?: string; description?: string }[];
    };
  };
  bookings?: TourBookingTask[];
}

export interface RentalTask {
  id: number;
  booking_number?: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_location?: string;
  dropoff_location?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  total_price?: number | string;
  driver_share?: number | string;
  special_requests?: string;
  car_category?: { name?: string; vehicle_type?: string };
  customer?: { name?: string; phone?: string };
}

export const unwrapPage = <T,>(payload: any): T[] => {
  const value = payload?.data?.data ?? payload?.data ?? payload ?? [];
  return Array.isArray(value) ? value : [];
};

export const labelStatus = (status?: string) =>
  (status || 'pending').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const money = (value?: number | string) => `₹${Number(value || 0).toFixed(0)}`;
