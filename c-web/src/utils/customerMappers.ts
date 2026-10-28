import type { BookingKind, InsurancePolicyData, WalletTransactionData } from './customerApi'
import type { Booking, Destination, InsurancePolicy, ItineraryStop, MediaAsset, Rental, Tour, TourSchedule, Transaction } from './data'

type RawRecord = Record<string, unknown>

export function isNumericId(value: string | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value))
}

export function tomorrowDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)

  return date.toISOString().slice(0, 10)
}

export function nextScheduledAt() {
  const date = new Date()
  date.setHours(date.getHours() + 2, 0, 0, 0)

  return date.toISOString().slice(0, 16)
}

export function bookingKindFor(type: Booking['type']): BookingKind {
  return type === 'Ride' ? 'ride' : type === 'Tour' ? 'tour' : 'rental'
}

export function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' ? (value as RawRecord) : {}
}

export function text(value: unknown, fallback: string) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return typeof value === 'string' && value.trim() ? value : fallback
}

export function numberValue(value: unknown, fallback: number) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

export function titleCase(value: unknown, fallback: string) {
  const normalized = text(value, fallback).replaceAll('_', ' ').trim()

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function records(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

export function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item, '')).filter(Boolean) : []
}

export function firstImage(record: RawRecord, fallback: string) {
  const media = Array.isArray(record.media) ? asRecord(record.media[0]) : {}

  return text(record.cover_image ?? record.image_url ?? record.image ?? record.photo_url ?? media.url ?? media.path, fallback)
}

export function mapMedia(value: unknown, fallbackImage: string, fallbackCaption: string): MediaAsset[] {
  const media = (Array.isArray(value) ? value : [])
    .map((rawItem, index) => {
      const item = asRecord(rawItem)
      const url = text(
        typeof rawItem === 'string' ? rawItem : item.url ?? item.file_path ?? item.path ?? item.image_url ?? item.photo_url,
        '',
      )

      if (!url) {
        return null
      }

      const mediaType = text(item.file_type ?? item.type, 'image').toLowerCase()
      return {
        id: text(item.id, `${fallbackCaption}-${index}`),
        type: mediaType.includes('video') ? 'video' : mediaType.includes('panorama') || mediaType.includes('360') ? 'panorama' : 'image',
        url,
        caption: text(item.caption ?? item.title, fallbackCaption),
      } satisfies MediaAsset
    })
    .filter((item): item is MediaAsset => Boolean(item))

  if (media.length) return media
  return fallbackImage ? [{ id: `${fallbackCaption}-image`, type: 'image', url: fallbackImage, caption: fallbackCaption }] : []
}

function emptyTour(index: number): Tour {
  return {
    id: `tour-${index + 1}`, title: 'Tour', destination: '', duration: '1 day', price: 0, rating: 0,
    seatsLeft: 0, image: '', category: 'Tour', nextSchedule: '', highlights: [], itinerary: [], itineraryStops: [],
    relatedPlaces: [], schedules: [], policy: '', tourType: 'planned', depositPercent: 0,
  }
}

export function mapSchedule(value: unknown, index: number, fallback: Tour): TourSchedule {
  const record = asRecord(value)
  const seats = numberValue(record.available_seats ?? record.seats_left, fallback.seatsLeft)

  return {
    id: text(record.id, `${fallback.id}-schedule-${index}`),
    label: text(record.departure_date ?? record.starts_at ?? record.available_from, fallback.nextSchedule),
    seatsLeft: seats,
    price: numberValue(record.price_per_adult ?? record.price_per_person ?? record.price, fallback.price),
    childPrice: numberValue(record.price_per_child ?? record.child_price, fallback.price),
    status: text(record.status, seats > 0 ? 'Open' : 'Waitlist'),
  }
}

export function mapItineraryStop(value: unknown, index: number, fallback: Tour): ItineraryStop {
  const record = asRecord(value)
  const place = asRecord(record.place)
  const dayNumber = numberValue(record.day_number ?? record.day_index, index + 1)
  const title = text(record.title, fallback.itinerary[index] ?? `Itinerary stop ${index + 1}`)
  const description = text(record.details ?? record.description ?? record.activities, title)
  const keyStops = records(record.key_stops ?? record.stops).map((item) => {
    const stop = asRecord(item)
    return {
      name: text(stop.name ?? stop.title, 'Route stop'),
      description: text(stop.description ?? stop.details, ''),
    }
  })

  return {
    id: text(record.id, `${fallback.id}-itinerary-${index}`),
    day: text(record.day_label, `Day ${dayNumber}`),
    title,
    description,
    media: mapMedia(record.media ?? place.media, firstImage(place, fallback.image), title),
    placeName: text(record.place_name ?? place.name, ''),
    from: text(record.from ?? record.start_location ?? record.origin, ''),
    to: text(record.to ?? record.end_location ?? record.destination, ''),
    distance: text(record.distance ?? record.distance_text ?? (record.distance_km ? `${record.distance_km} km` : ''), ''),
    travelTime: text(record.travel_time ?? record.duration ?? record.drive_time, ''),
    keyStops,
    startTime: text(record.time, ''),
    activities: textList(record.activities),
    accommodation: text(record.accommodation, ''),
    mealsIncluded: textList(record.meals_included),
    stopOrder: numberValue(record.stop_order, index + 1),
    inclusions: textList(record.inclusions),
    exclusions: textList(record.exclusions),
  }
}

export function mapTour(value: unknown, index: number): Tour {
  const record = asRecord(value)
  const fallback = emptyTour(index)
  const itineraryRecords = records(record.itineraries)
  const itineraryStops = itineraryRecords.map((item, itemIndex) => mapItineraryStop(item, itemIndex, fallback))
  const itineraries = itineraryStops.map((item) => `${item.day}: ${item.title}`)
  const relatedPlaces = records(record.related_places ?? record.places).map((item, itemIndex) => mapDestination(item, itemIndex))
  const schedules = records(record.schedules ?? record.upcoming_schedules).map((item, itemIndex) => mapSchedule(item, itemIndex, fallback))
  const basePrice = numberValue(record.price_per_person ?? record.price, fallback.price)
  const rawTourType = text(record.tour_type ?? record.booking_type ?? record.departure_type, fallback.tourType).toLowerCase()
  const title = text(record.title ?? record.name, fallback.title)
  const image = firstImage(record, fallback.image)
  const minGroupSize = numberValue(record.min_group_size, 1)
  const maxGroupSize = numberValue(record.max_group_size, minGroupSize)

  return {
    id: text(record.id, fallback.id),
    title,
    brochureUrl: text(record.brochure_url, ''),
    generatedBrochureUrl: text(record.generated_brochure_url, ''),
    hasUploadedBrochure: record.has_uploaded_brochure === true,
    destination: text(record.destination ?? record.region ?? record.start_location ?? record.location ?? record.summary, fallback.destination),
    duration: `${numberValue(record.duration_days, 1)} day${numberValue(record.duration_days, 1) === 1 ? '' : 's'}`,
    price: numberValue(record.discounted_price, basePrice),
    originalPrice: basePrice,
    rating: numberValue(record.rating, fallback.rating),
    seatsLeft: numberValue(record.available_seats ?? record.seats_left, fallback.seatsLeft),
    image,
    category: text(asRecord(record.category).name ?? record.category ?? record.tour_type, fallback.category),
    nextSchedule: schedules[0]?.label ?? text(record.available_from, fallback.nextSchedule),
    highlights: textList(record.highlights).length ? textList(record.highlights) : fallback.highlights,
    itinerary: itineraries.length ? itineraries : fallback.itinerary,
    itineraryStops: itineraryStops.length ? itineraryStops : fallback.itineraryStops,
    relatedPlaces: relatedPlaces.length ? relatedPlaces : fallback.relatedPlaces,
    schedules: schedules.length ? schedules : fallback.schedules,
    policy: text(record.cancellation_policy ?? record.policy, fallback.policy),
    summary: text(record.short_description ?? record.description, ''),
    tourType: ['private', 'family', 'custom', 'flexible'].some((type) => rawTourType.includes(type)) ? 'private' : 'planned',
    depositPercent: numberValue(record.deposit_percent ?? record.advance_percentage ?? record.booking_percentage, fallback.depositPercent),
    groupSizeLabel: text(record.group_size_label ?? record.group_type, `${minGroupSize}-${maxGroupSize} guests`),
    nights: numberValue(record.duration_nights, 0),
    inclusions: textList(record.inclusions),
    exclusions: textList(record.exclusions),
    gallery: mapMedia(record.gallery ?? record.media, image, title),
    startLocation: text(record.start_location, ''),
    endLocation: text(record.end_location, ''),
    difficulty: titleCase(record.difficulty, ''),
    travelStyle: (text(record.travel_style, fallback.travelStyle || 'solo') as 'solo' | 'family' | 'senior-friendly' | 'multi-generational'),
    minGroupSize,
    maxGroupSize,
  }
}

export function mapRental(value: unknown, index: number): Rental {
  const record = asRecord(value)
  const fallback: Rental = { id: `rental-${index + 1}`, name: 'Vehicle', category: 'Vehicle', seats: 0, luggage: 0, transmission: '', pricePerDay: 0, rating: 0, image: '', availability: '', features: [], policy: '' }

  return {
    id: text(record.id, fallback.id),
    name: text(record.name ?? record.title ?? record.vehicle_type, fallback.name),
    category: text(record.vehicle_type ?? record.category, fallback.category),
    seats: numberValue(record.seats, fallback.seats),
    luggage: numberValue(record.luggage_capacity ?? record.luggage, fallback.luggage),
    transmission: text(record.transmission, fallback.transmission),
    pricePerDay: numberValue(record.base_price_per_day ?? record.price_per_day, fallback.pricePerDay),
    rating: numberValue(record.rating, fallback.rating),
    image: firstImage(record, fallback.image),
    availability: text(record.status ?? record.availability, fallback.availability),
    features: Array.isArray(record.features) ? record.features.map((item) => text(item, '')).filter(Boolean) : fallback.features,
    policy: text(record.policy, fallback.policy),
  }
}

export function mapDestination(value: unknown, index: number): Destination {
  const record = asRecord(value)
  const place = Object.keys(asRecord(record.place)).length ? asRecord(record.place) : record
  const fallback: Destination = { id: `destination-${index + 1}`, name: 'Destination', region: '', image: '', rating: 0, summary: '', tags: [], media: [], activeTours: [] }
  const image = firstImage(place, fallback.image)
  const activeTours = records(record.active_tours ?? record.related_tours ?? record.tours).map((item, itemIndex) => mapTour(item, itemIndex))
  const google = asRecord(record.google_summary)
  const googleDetails = asRecord(google.details)
  const googleHours = asRecord(googleDetails.opening_hours)
  const googleCoordinates = asRecord(google.coordinates)
  const googleReviews = records(google.reviews).map((review) => ({
    author: text(review.author_name, 'Google user'),
    rating: numberValue(review.rating, 0),
    relativeTime: text(review.relative_time_description, ''),
    text: text(review.text, ''),
  }))
  const googlePlaceId = text(google.place_id ?? place.google_place_id, '')

  return {
    id: text(place.id, fallback.id),
    name: text(place.name ?? place.title, fallback.name),
    region: text(place.region ?? place.location ?? place.address ?? place.city, fallback.region),
    image,
    rating: numberValue(place.google_rating ?? place.rating, fallback.rating),
    summary: text(place.short_description ?? place.description ?? place.summary, fallback.summary),
    tags: textList(place.tags).length ? textList(place.tags) : fallback.tags,
    media: mapMedia(place.media ?? record.media, image, text(place.name ?? place.title, fallback.name)),
    activeTours: activeTours.length ? activeTours : fallback.activeTours,
    google: googlePlaceId ? {
      placeId: googlePlaceId,
      rating: numberValue(google.rating ?? place.google_rating, 0),
      reviewCount: numberValue(google.review_count ?? place.google_review_count, 0),
      address: text(googleDetails.formatted_address ?? place.location, ''),
      phone: text(googleDetails.international_phone_number ?? googleDetails.formatted_phone_number, ''),
      website: text(googleDetails.website, ''),
      mapsUrl: text(googleDetails.google_maps_url, ''),
      businessStatus: titleCase(googleDetails.business_status, ''),
      categories: textList(googleDetails.types).map((category) => titleCase(category, category)),
      priceLevel: googleDetails.price_level === null || googleDetails.price_level === undefined ? undefined : numberValue(googleDetails.price_level, 0),
      editorialSummary: text(googleDetails.editorial_summary, ''),
      openingHours: textList(googleHours.weekday_text),
      openNow: typeof googleHours.open_now === 'boolean' ? googleHours.open_now : undefined,
      latitude: googleCoordinates.latitude === null || googleCoordinates.latitude === undefined ? undefined : numberValue(googleCoordinates.latitude, 0),
      longitude: googleCoordinates.longitude === null || googleCoordinates.longitude === undefined ? undefined : numberValue(googleCoordinates.longitude, 0),
      reviews: googleReviews,
      photos: records(google.photos).map((photo) => ({
        url: text(photo.url, ''),
        attribution: textList(photo.html_attributions).join(' ').replace(/<[^>]*>/g, ''),
      })).filter((photo) => photo.url),
      lastSyncedAt: text(google.last_synced_at, ''),
    } : undefined,
  }
}

export function paginatedItems(value: unknown): unknown[] {
  const record = asRecord(value)
  const data = record.data

  if (Array.isArray(data)) {
    return data
  }

  const nested = asRecord(data).data

  return Array.isArray(nested) ? nested : []
}

export function mapBooking(value: unknown, type: Booking['type'], index: number): Booking {
  const record = asRecord(value)
  const fallback: Booking = {
    id: `${type.toLowerCase()}-${index + 1}`, type, title: `${type} booking`, date: '', status: 'Pending payment',
    paymentStatus: 'Pending', refundStatus: 'None', amount: 0, method: 'Cash', transactionId: '', cancellable: false, nextStep: '',
  }
  const titleRecord = asRecord(record.tour ?? record.car_category ?? record.driver)
  const rawStatus = text(record.status, fallback.status)
  const statusMap: Record<string, Booking['status']> = {
    cancelled: 'Cancelled',
    completed: 'Completed',
    confirmed: 'Confirmed',
    driver_assigned: 'In progress',
    driver_arriving: 'In progress',
    in_transit: 'In progress',
    in_progress: 'In progress',
    pickup: 'In progress',
    pending: 'Pending payment',
  }
  const paymentStatusMap: Record<string, Booking['paymentStatus']> = {
    failed: 'Failed',
    paid: 'Paid',
    pending: 'Pending',
    refunded: 'Refunded',
  }
  const methodMap: Record<string, Booking['method']> = {
    cash: 'Cash',
    card: 'Card',
    upi: 'UPI',
    wallet: 'Wallet',
    razorpay: 'Razorpay',
  }
  const normalizedStatus = statusMap[rawStatus.toLowerCase()] ?? fallback.status
  const rawPaymentStatus = text(record.payment_status, 'pending').toLowerCase()
  const paymentStatus = paymentStatusMap[rawPaymentStatus] ?? 'Pending'
  const method = methodMap[text(record.payment_method, 'cash').toLowerCase()] ?? 'Razorpay'

  return {
    id: text(record.id ?? record.booking_number, fallback.id),
    type,
    title: text(titleRecord.title ?? titleRecord.name ?? record.pickup_location, fallback.title),
    date: text(record.travel_date ?? record.start_date ?? record.scheduled_at, fallback.date),
    status: normalizedStatus,
    paymentStatus,
    refundStatus: rawPaymentStatus === 'refunded' ? (method === 'Wallet' ? 'Wallet refunded' : 'Processed') : text(record.refund_status, fallback.refundStatus) as Booking['refundStatus'],
    amount: numberValue(record.total_price ?? record.total_fare ?? record.estimated_fare, fallback.amount),
    method,
    transactionId: text(record.transaction_id, fallback.transactionId),
    cancellable: !['cancelled', 'completed', 'in_progress'].includes(rawStatus.toLowerCase()),
    nextStep: text(record.next_step, fallback.nextStep),
    reviewed: (Array.isArray(record.reviews) && record.reviews.length > 0) || Boolean(record.is_reviewed || record.reviewed || record.has_reviewed),
  }
}

export function mapWalletTransaction(value: WalletTransactionData, index: number): Transaction {
  const reference = text(value.reference_type, '').toLowerCase()
  const type = text(value.type, 'debit').toLowerCase()
  let kind: Transaction['kind'] = type === 'credit' ? 'Credit' : 'Debit'

  if (reference.includes('refund')) kind = 'Refund'
  else if (reference.includes('tip')) kind = 'Tip'
  else if (reference.includes('booking') || reference.includes('rental')) kind = 'Booking'

  return {
    id: text(value.id, `transaction-${index + 1}`),
    label: text(value.description, titleCase(value.reference_type, type === 'credit' ? 'Wallet credit' : 'Wallet debit')),
    kind,
    date: text(value.created_at, 'Recent'),
    amount: Math.abs(numberValue(value.amount, 0)),
  }
}

export function mapInsurancePolicy(value: InsurancePolicyData, index: number): InsurancePolicy {
  const status = titleCase(value.status, 'Pending') as InsurancePolicy['status']

  return {
    id: text(value.id, `policy-${index + 1}`),
    policyNumber: text(value.policy_number, 'Policy pending'),
    title: `${titleCase(value.policy_type, 'Travel')} protection`,
    status,
    coverage: numberValue(value.coverage_amount, 0),
    validUntil: text(value.end_date, 'Validity pending'),
  }
}

export function relatedToursForDestination(destination: Destination, tourList: Tour[]) {
  const terms = [destination.name, destination.region, ...destination.tags].map((item) => item.toLowerCase()).filter(Boolean)

  return tourList.filter((tour) => {
    const haystack = [
      tour.title,
      tour.destination,
      tour.category,
      ...tour.highlights,
      ...tour.itinerary,
      ...tour.itineraryStops.map((stop) => `${stop.title} ${stop.description} ${stop.placeName ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()

    return terms.some((term) => term.length > 2 && haystack.includes(term))
  })
}

export function attachToursToDestinations(destinationList: Destination[], tourList: Tour[]) {
  return destinationList.map((destination) => ({
    ...destination,
    activeTours: relatedToursForDestination(destination, tourList),
  }))
}
