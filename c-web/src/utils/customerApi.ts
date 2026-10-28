import { apiRequest, API_V1_BASE } from './api'

export type ApiEnvelope<T> = {
  pagination?: { current_page: number; last_page: number; total: number }
  success?: boolean
  message?: string
  data?: T
  token?: string
  customer?: unknown
  customer_exists?: boolean
  dev_otp?: string
  next_step?: string
  registration_token?: string
  requires_registration?: boolean
  stats?: Record<string, number>
  recent_bookings?: unknown[]
  recent_ride_bookings?: unknown[]
  receipt?: BookingReceipt
}

export type PaginatedData<T> = {
  data: T[]
  current_page?: number
  last_page?: number
  total?: number
}

export type DashboardData = ApiEnvelope<never> & {
  customer?: unknown
  stats?: Record<string, number>
  recent_bookings?: unknown[]
  recent_ride_bookings?: unknown[]
}

export type BookingReceipt = {
  id?: number
  service_type?: BookingKind
  title?: string
  receipt_number?: string
  booking_number?: string
  transaction_id?: string | null
  payment_method?: string
  payment_status?: string
  status?: string
  amount?: number
  coupon_code?: string | null
  discount_amount?: number
  currency?: string
  travel_date?: string | null
  refund_status?: string
  support_actions?: {
    can_contact_support?: boolean
    can_cancel?: boolean
    can_review?: boolean
  }
}

export type WalletData = {
  id?: number
  balance?: number | string
  currency?: string
  status?: string
}

export type Money = {
  amount_minor: number
  currency: string
  amount_display: string
}

// Strict v1 receipt (ride-only): GET /api/v1/bookings/{id}/receipt.
export type V1Receipt = {
  id?: number
  type?: string
  booking_number?: string
  status?: string
  payment_status?: string
  amount?: Money
  refunded?: Money
  issued_at?: string | null
  travel_date?: string | null
  completed_at?: string | null
}

export type V1Envelope<T> = {
  success?: boolean
  data?: T
  error?: {
    code?: string
    message?: string
    fields?: Record<string, string[]>
  }
  meta?: {
    request_id?: string
    contract_version?: string
  }
}

export type RazorpayClientConfig = {
  key: string
  currency?: string
  name?: string
  image?: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  theme?: {
    color?: string
  }
}

export type RazorpayOrderData = {
  order_id?: string
  amount?: number
  currency?: string
  receipt?: string
  razorpay_config?: RazorpayClientConfig
}

export type WalletTopUpResult = {
  wallet?: WalletData
  amount?: number
  payment_id?: string
  transaction_id?: number
  idempotency_key?: string
}

export type WalletTransactionData = {
  id?: number
  type?: string
  amount?: number | string
  reference_type?: string | null
  reference_id?: string | number | null
  description?: string
  status?: string
  created_at?: string
}

export type InsurancePolicyData = {
  id?: number
  policy_number?: string
  policy_type?: string
  coverage_amount?: number | string
  premium?: number | string
  start_date?: string
  end_date?: string
  status?: string
  product_code?: string
  provider_name?: string
  terms_version?: string
  terms_accepted_at?: string
}

export type RideEstimateData = {
  pricing?: {
    subtotal?: number
    total?: number
    private_subtotal?: number
    sharing_discount_percent?: number
    sharing_savings?: number
    vehicle_multiplier?: number
  }
  subtotal?: number
  coupon?: CouponPreviewData
  distance_km?: number
  duration_minutes?: number
  estimated_distance_km?: number
  estimated_duration?: number
  ride_classification?: string
  vehicle_class?: 'mini' | 'comfort' | 'xl'
  nearby_drivers?: number
  nearby_driver_locations?: Array<{
    lat: number
    lng: number
  }>
  sharing?: {
    eligible?: boolean
    requested?: boolean
    reserved_seats?: number
    nearby_sharing_drivers?: number
    can_customer_enable?: boolean
    enabled_by?: 'driver' | 'customer' | null
  }
}

export type LocationSearchResult = {
  id: string | number
  name: string
  address: string
  type: string
  lat: number | null
  lng: number | null
}

export type BookingKind = 'ride' | 'tour' | 'rental'

export type CmsPayload = Record<string, Record<string, Record<string, unknown>>>

export type PublicBootstrapData = {
  featured_tours?: unknown[]
  featured_destinations?: unknown[]
  car_categories?: unknown[]
  cms?: CmsPayload
}

export type RideEstimatePayload = {
  pickup_lat: number
  pickup_lng: number
  dropoff_lat?: number
  dropoff_lng?: number
  service_type: 'point_to_point' | 'hourly' | 'hourly_rental' | 'round_trip'
  scheduled_at: string
  vehicle_class?: string
  coupon_code?: string
  sharing_requested?: boolean
  reserved_seats?: number
}

export type RideBookingPayload = RideEstimatePayload & {
  request_mode?: 'immediate' | 'scheduled'
  pickup_location: string
  dropoff_location?: string
  special_requests?: string
  payment_method: 'cash' | 'card' | 'wallet' | 'upi'
}

export type TrackingPoint = {
  latitude?: number | string | null
  longitude?: number | string | null
  address?: string | null
  last_update?: string | null
  current_stop_index?: number | null
}

export type TrackingData = {
  server_time?: string
  booking?: Record<string, unknown>
  rental?: Record<string, unknown>
  service_type?: BookingKind
  current_location?: TrackingPoint | null
  pickup?: TrackingPoint | null
  dropoff?: TrackingPoint | null
  start_verification?: {
    required?: boolean
    code?: string | null
    verified_at?: string | null
    label?: string
    instructions?: string
  }
  weather?: {
    summary?: string
    temperature_c?: number
    source?: string
  }
  status_steps?: Array<{ key: string; label: string; done: boolean; active: boolean }>
  eta_minutes?: number | null
  protection?: { status?: string; label?: string }
  tracking?: {
    state?: 'terminal' | 'no_driver_yet' | 'driver_assigned_no_location' | 'stale' | 'live'
    driver_assigned?: boolean
    has_location?: boolean
    last_update?: string | null
    age_seconds?: number | null
    stale_after_seconds?: number
    poll_after_seconds?: number
    terminal?: boolean
  }
}

export type BookingNextStepsData = {
  service_type?: BookingKind
  booking_id?: number
  booking_number?: string
  status?: string
  payment_status?: string
  tracking_url?: string
  start_verification?: {
    required?: boolean
    code?: string | null
    verified?: boolean
  }
  instructions?: string[]
  actions?: {
    can_check_in?: boolean
    can_track?: boolean
    can_contact_support?: boolean
    can_review?: boolean
  }
}

export type CouponPreviewData = {
  eligible?: boolean
  code?: string | null
  name?: string | null
  description?: string | null
  service_type?: BookingKind
  subtotal?: number
  discount_amount?: number
  final_amount?: number
  message?: string | null
}

export type AvailableCouponData = Pick<CouponPreviewData, 'code' | 'name' | 'description' | 'discount_amount' | 'final_amount' | 'message'>

function post<T>(path: string, body: Record<string, unknown>, opts?: { retry?: boolean }) {
  return apiRequest<T>(
    path,
    {
      method: 'POST',
      headers: { 'X-Booking-Contract': '2' },
      body: JSON.stringify(body),
    },
    opts,
  )
}

export function getPublicBootstrap() {
  return apiRequest<ApiEnvelope<PublicBootstrapData>>('/public/bootstrap')
}

export function getPublicCms(app: 'customer-web' | 'customer-mobile' | 'driver-app') {
  return apiRequest<ApiEnvelope<CmsPayload>>(`/public/cms/${app}`)
}

export function getPublicTours(params?: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<ApiEnvelope<unknown[]>>(`/public/tours${params ? `?${params}` : ''}`, { signal })
}

export function getPublicTour(id: string) {
  return apiRequest<ApiEnvelope<unknown>>(`/public/tours/${id}`)
}

export function getPublicDestinations() {
  return apiRequest<ApiEnvelope<unknown[]>>('/public/destinations')
}

export function getPublicDestination(id: string) {
  return apiRequest<ApiEnvelope<unknown>>(`/public/destinations/${id}`)
}

export function getPublicPlaces() {
  return apiRequest<ApiEnvelope<unknown[]>>('/public/places')
}

export function uploadPlaceMedia(placeId: string, image: File, caption: string, is360: boolean) {
  const body = new FormData()
  body.append('image', image)
  body.append('caption', caption)
  body.append('is_360', is360 ? '1' : '0')
  return apiRequest<ApiEnvelope<unknown>>(`/places/${placeId}/media`, { method: 'POST', body })
}

export function getPublicCarCategories() {
  return apiRequest<ApiEnvelope<unknown[]>>('/public/car-categories')
}

export function getTourBookings() {
  return apiRequest<ApiEnvelope<PaginatedData<unknown>>>('/tour-bookings')
}

export function getCarRentals() {
  return apiRequest<ApiEnvelope<PaginatedData<unknown>>>('/car-rentals')
}

export function getRides() {
  return apiRequest<ApiEnvelope<PaginatedData<unknown>>>('/rides')
}

// Authoritative ride receipt on the strict v1 surface (money as minor units, ISO dates).
export function getRideReceiptV1(bookingId: number) {
  return apiRequest<V1Envelope<V1Receipt>>(`/bookings/${bookingId}/receipt`, {}, { baseUrl: API_V1_BASE })
}

export function getDashboard() {
  return apiRequest<DashboardData>('/dashboard')
}

export function getWallet() {
  return apiRequest<ApiEnvelope<WalletData>>('/wallet')
}

export function getWalletTransactions() {
  return apiRequest<ApiEnvelope<PaginatedData<WalletTransactionData>>>('/wallet/transactions')
}

export function getInsurancePolicies() {
  return apiRequest<ApiEnvelope<InsurancePolicyData[]>>('/insurance/policies')
}

export function createInsurancePolicy(payload: {
  plan_code: 'ride_protect' | 'tour_protect' | 'rental_protect'
  service_type: BookingKind
  booking_id: number
  terms_accepted: true
  terms_version: '2026-07-22'
}) {
  return post<ApiEnvelope<InsurancePolicyData>>('/insurance/policies', payload)
}

export function getTourSchedules(id: string) {
  return apiRequest<ApiEnvelope<unknown[]>>(`/public/tours/${id}/schedules`)
}

export function sendCustomerOtp(phone: string, action = 'login') {
  return post<ApiEnvelope<unknown>>('/otp/send', { phone, action })
}

export function verifyCustomerOtp(phone: string, code: string, action = 'login', name?: string) {
  return post<ApiEnvelope<unknown>>('/otp/verify', { phone, code, action, name })
}

export function completeCustomerRegistration(payload: { phone: string; registration_token: string; name: string; email?: string }) {
  return post<ApiEnvelope<unknown>>('/otp/register-complete', payload)
}

export function bookTour(payload: Record<string, unknown>) {
  return post<ApiEnvelope<unknown>>('/tours/book', payload, { retry: true })
}

export function bookRental(payload: Record<string, unknown>) {
  return post<ApiEnvelope<unknown>>('/car-rentals', payload, { retry: true })
}

export function previewCoupon(payload: { coupon_code: string; service_type: BookingKind; subtotal: number }) {
  return post<ApiEnvelope<CouponPreviewData>>('/coupons/preview', payload)
}

export function getAvailableCoupons(serviceType: BookingKind, subtotal: number) {
  const params = new URLSearchParams({ service_type: serviceType, subtotal: String(subtotal) })
  return apiRequest<ApiEnvelope<AvailableCouponData[]>>(`/coupons/available?${params}`)
}

export function estimateRide(payload: RideEstimatePayload) {
  return post<RideEstimateData>('/public/rides/estimate', payload)
}

export function searchPublicLocations(query: string) {
  const params = new URLSearchParams({ query })
  return apiRequest<{ results: LocationSearchResult[] }>(`/public/locations/search?${params}`)
}

export type CurrentRide = { id: number; status: string; driver_id: number | null; request_expires_at: string | null; pickup_location: string; dropoff_location: string }

export function getCurrentRide() {
  return apiRequest<ApiEnvelope<CurrentRide | null>>('/rides/current')
}

export function createRide(payload: RideBookingPayload, idempotencyKey?: string) {
  return apiRequest<ApiEnvelope<unknown>>('/rides', {
    method: 'POST', body: JSON.stringify(payload),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  }, { retry: true })
}

export function cancelRide(id: string, reason = 'Customer cancelled while searching for a driver') {
  return post<ApiEnvelope<unknown>>(`/rides/${id}/cancel`, { reason })
}

export function getTrackingInfo(kind: BookingKind, id: string) {
  const resource = kind === 'rental' ? 'rental' : kind

  return apiRequest<ApiEnvelope<TrackingData>>(`/tracking/${resource}/${id}`)
}

export function getBookingNextSteps(kind: BookingKind, id: string) {
  const resource = kind === 'ride' ? 'rides' : kind === 'tour' ? 'tour-bookings' : 'car-rentals'

  return apiRequest<ApiEnvelope<BookingNextStepsData>>(`/${resource}/${id}/next-steps`)
}

export function submitBookingCheckIn(kind: BookingKind, id: string, payload: { latitude?: number; longitude?: number; note?: string } = {}) {
  const resource = kind === 'ride' ? 'rides' : kind === 'tour' ? 'tour-bookings' : 'car-rentals'

  return post<ApiEnvelope<{ next_steps?: string[] }>>(`/${resource}/${id}/check-in`, payload)
}

export function createTopUpOrder(amount: number) {
  return post<ApiEnvelope<RazorpayOrderData>>('/wallet/topup/order', { amount }, { retry: true })
}

export function verifyTopUp(payload: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}) {
  return post<ApiEnvelope<WalletTopUpResult>>('/wallet/topup/verify', payload, { retry: true })
}

export function cancelBooking(kind: BookingKind, id: string, reason: string) {
  const path =
    kind === 'ride'
      ? `/rides/${id}/cancel`
      : kind === 'tour'
        ? `/tour-bookings/${id}/cancel`
        : `/car-rentals/${id}/cancel`

  return post<ApiEnvelope<unknown>>(path, { reason })
}

export function submitServiceReview(kind: BookingKind | 'place', id: string, rating: number, review: string) {
  if (kind === 'ride') {
    return post<ApiEnvelope<unknown>>(`/rides/${id}/review`, { rating, comment: review })
  }

  if (kind === 'tour') {
    return post<ApiEnvelope<unknown>>(`/tour-bookings/${id}/review`, { tour_rating: rating, review })
  }

  if (kind === 'rental') {
    return post<ApiEnvelope<unknown>>(`/car-rentals/${id}/review`, { rental_rating: rating, review })
  }

  return post<ApiEnvelope<unknown>>(`/places/${id}/reviews`, { rating, review })
}

export function submitRideTip(id: string, amount: number) {
  return post<ApiEnvelope<unknown>>(`/rides/${id}/tip`, { amount }, { retry: true })
}

export function requestExtendedCare(careType: string, notes: string) {
  return post<ApiEnvelope<unknown>>('/insurance/extended-care', { care_type: careType, notes })
}

export function toggleWishlist(payload: { tourId: string; action: 'add' | 'remove' | 'check' }) {
  return post<ApiEnvelope<{ inWishlist: boolean }>>('/public/wishlists/tours/' + payload.tourId + '/' + payload.action, {})
}

export function toggleWishlistService(payload: {
  service_type: 'tour' | 'rental' | 'destination'
  service_id: string
  action: 'add' | 'remove' | 'check'
}) {
  return post<ApiEnvelope<{ inWishlist: boolean }>>('/wishlists/toggle', payload)
}

export function syncWishlist(items: Array<{ service_type: 'tour' | 'rental' | 'destination'; service_id: string }>) {
  return post<ApiEnvelope<{ message: string }>>('/wishlists/sync', { items })
}

export function getWishlist() {
  return apiRequest<ApiEnvelope<{
    tours: Array<{
      id: string
      wishlist_id: number
      service_type: string
      title: string
      image?: string
      duration?: string
      price: number
    }>
    rentals: Array<{
      id: string
      wishlist_id: number
      service_type: string
      title: string
      image?: string
      price: number
    }>
    places: Array<{
      id: string
      wishlist_id: number
      service_type: string
      title: string
      image?: string
    }>
    total: number
  }>>('/wishlists')
}

export function submitSupportRequest(payload: {
  category: 'general' | 'account' | 'payment' | 'insurance' | 'safety' | 'accessibility' | 'feedback' | 'booking'
  subject: string
  message: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  service_type?: BookingKind
  booking_id?: number
}) {
  return post<ApiEnvelope<{ ticket_number: string }>>('/support/tickets', payload)
}

export function subscribeNewsletter(email: string, source = 'website_footer') {
  return post<ApiEnvelope<{ email: string; subscribed_at: string }>>('/public/newsletter/subscribe', { email, source })
}

export function getLoyaltyPoints() {
  return apiRequest<ApiEnvelope<{
    total_points: number
    rupee_value: number
    tier: string
    history: Array<{
      id: number
      points: number
      action: string
      reference_type?: string
      reference_id?: number
      description?: string
      created_at?: string
    }>
  }>>('/loyalty')
}

export function getReferralDetails() {
  return apiRequest<ApiEnvelope<{
    referral_code: string
    referral_url: string
    total_referrals: number
    total_earned_points: number
    history: Array<{
      id: number
      status: string
      reward_points: number
      completed_at?: string
      created_at?: string
    }>
  }>>('/referrals')
}

export function getPublicDeals() {
  return apiRequest<ApiEnvelope<Array<{
    code: string
    name: string
    description?: string
    discount_type: string
    discount_value: number
    max_discount_amount?: number | null
    min_order_amount: number
    service_types: string[]
    deal_tag: string
    ends_at?: string
  }>>>('/public/coupons/deals')
}


