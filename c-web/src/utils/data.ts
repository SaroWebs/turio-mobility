export type Tour = {
  brochureUrl?: string
  generatedBrochureUrl?: string
  hasUploadedBrochure?: boolean
  id: string
  title: string
  destination: string
  duration: string
  price: number
  rating: number
  seatsLeft: number
  image: string
  category: string
  nextSchedule: string
  highlights: string[]
  itinerary: string[]
  itineraryStops: ItineraryStop[]
  relatedPlaces: Destination[]
  schedules: TourSchedule[]
  policy: string
  summary?: string
  originalPrice?: number
  tourType: 'planned' | 'private'
  depositPercent: number
  groupSizeLabel?: string
  nights?: number
  inclusions?: string[]
  exclusions?: string[]
  gallery?: MediaAsset[]
  startLocation?: string
  endLocation?: string
  difficulty?: string
  minGroupSize?: number
  maxGroupSize?: number
  travelStyle?: 'solo' | 'family' | 'senior-friendly' | 'multi-generational'
}

export type ItineraryStop = {
  id: string
  day: string
  title: string
  description: string
  media: MediaAsset[]
  placeName?: string
  from?: string
  to?: string
  distance?: string
  travelTime?: string
  keyStops?: KeyStop[]
  startTime?: string
  activities?: string[]
  accommodation?: string
  mealsIncluded?: string[]
  stopOrder?: number
  inclusions?: string[]
  exclusions?: string[]
}

export type KeyStop = {
  name: string
  description: string
}

export type MediaAsset = {
  id: string
  type: 'image' | 'panorama' | 'video'
  url: string
  caption: string
}

export type TourSchedule = {
  id: string
  label: string
  seatsLeft: number
  price: number
  childPrice: number
  status: string
}

export type Rental = {
  id: string
  name: string
  category: string
  seats: number
  luggage: number
  transmission: string
  pricePerDay: number
  rating: number
  image: string
  availability: string
  features: string[]
  policy: string
}

export type Booking = {
  id: string
  type: 'Tour' | 'Rental' | 'Ride'
  title: string
  date: string
  status: 'Confirmed' | 'In progress' | 'Pending payment' | 'Cancelled' | 'Completed'
  paymentStatus: 'Paid' | 'Pending' | 'Refunded' | 'Failed'
  refundStatus: 'None' | 'Pending' | 'Processed' | 'Failed' | 'Wallet refunded'
  amount: number
  method: 'Wallet' | 'Cash' | 'Card' | 'UPI' | 'Razorpay'
  transactionId: string
  cancellable: boolean
  nextStep: string
  reviewed?: boolean
}

export type Transaction = {
  id: string
  label: string
  kind: 'Credit' | 'Debit' | 'Refund' | 'Booking' | 'Tip'
  date: string
  amount: number
}

export type Destination = {
  id: string
  name: string
  region: string
  image: string
  rating: number
  summary: string
  tags: string[]
  media: MediaAsset[]
  activeTours: Tour[]
  google?: GooglePlaceProfile
}

export type GooglePlaceReview = {
  author: string
  rating: number
  relativeTime: string
  text: string
}

export type GooglePlaceProfile = {
  placeId: string
  rating: number
  reviewCount: number
  address: string
  phone: string
  website: string
  mapsUrl: string
  businessStatus: string
  categories: string[]
  priceLevel?: number
  editorialSummary: string
  openingHours: string[]
  openNow?: boolean
  latitude?: number
  longitude?: number
  reviews: GooglePlaceReview[]
  photos: Array<{ url: string; attribution: string }>
  lastSyncedAt: string
}

export type Notification = {
  id: string
  title: string
  text: string
  type: 'Booking' | 'Payment' | 'Tracking' | 'Support'
  unread: boolean
}

export type InsurancePolicy = {
  id: string
  policyNumber: string
  title: string
  status: 'Active' | 'Pending' | 'Expired' | 'Cancelled' | 'Claimed'
  coverage: number
  validUntil: string
}

export type Review = {
  id: string
  subject: string
  rating: number
  text: string
}

export const tours: Tour[] = [
  {
    id: 'coastal-heritage',
    title: 'Coastal Heritage Day Tour',
    destination: 'Old Port, Lighthouse Trail',
    duration: '8 hours',
    price: 4200,
    rating: 4.8,
    seatsLeft: 6,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    category: 'Culture',
    tourType: 'planned',
    depositPercent: 25,
    groupSizeLabel: 'Shared group departure',
    nextSchedule: 'Tomorrow, 8:30 AM',
    highlights: ['Verified local guide', 'Hotel pickup', 'Coastal lunch stop'],
    itinerary: ['Pickup and welcome briefing', 'Old Port walk', 'Lighthouse viewpoint', 'Local lunch', 'Sunset return'],
    itineraryStops: [
      {
        id: 'coastal-day-1',
        day: 'Day 1',
        title: 'Old Port and Lighthouse Trail',
        description: 'Start with a hotel pickup, walk the old lanes, and close at the lighthouse viewpoint.',
        media: [
          {
            id: 'coastal-day-1-image',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            caption: 'Coastal viewpoint included in the itinerary',
          },
        ],
        placeName: 'Old Port Quarter',
      },
    ],
    relatedPlaces: [],
    schedules: [{ id: 'SCH-COASTAL-1', label: 'Tomorrow, 8:30 AM', seatsLeft: 6, price: 4200, childPrice: 3200, status: 'Open' }],
    policy: 'Free reschedule until 12 hours before pickup.',
    travelStyle: 'solo',
  },
  {
    id: 'hill-temple-loop',
    title: 'Hill Temple And Valley Loop',
    destination: 'Valley Road, Hill Shrine',
    duration: '10 hours',
    price: 5600,
    rating: 4.9,
    seatsLeft: 4,
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    category: 'Scenic',
    tourType: 'private',
    depositPercent: 20,
    groupSizeLabel: 'Your family or private group',
    nextSchedule: 'Fri, 7:00 AM',
    highlights: ['Private vehicle option', 'Certified guide', 'Photo stops'],
    itinerary: ['Early pickup', 'Valley viewpoint', 'Temple visit', 'Traditional meal', 'Market stop'],
    itineraryStops: [
      {
        id: 'hill-day-1',
        day: 'Day 1',
        title: 'Valley viewpoint and hill shrine',
        description: 'The day connects scenic roads, temple time, meal stops, and a return through the market.',
        media: [
          {
            id: 'hill-day-1-image',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
            caption: 'Hill route viewpoint',
          },
        ],
        placeName: 'Valley Road',
      },
    ],
    relatedPlaces: [],
    schedules: [{ id: 'SCH-HILL-1', label: 'Fri, 7:00 AM', seatsLeft: 4, price: 5600, childPrice: 4400, status: 'Open' }],
    policy: 'Partial refund available for cancellations before 24 hours.',
    travelStyle: 'family',
  },
  {
    id: 'food-market-night',
    title: 'Night Food And Market Walk',
    destination: 'Central Market District',
    duration: '4 hours',
    price: 1800,
    rating: 4.7,
    seatsLeft: 10,
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    category: 'Food',
    tourType: 'planned',
    depositPercent: 25,
    groupSizeLabel: 'Small shared group',
    nextSchedule: 'Tonight, 6:30 PM',
    highlights: ['Small group', 'Tasting pass', 'Support hotline'],
    itinerary: ['Meet at central square', 'Snack trail', 'Spice market', 'Dessert stop', 'Drop point guidance'],
    itineraryStops: [
      {
        id: 'food-day-1',
        day: 'Evening',
        title: 'Central market snack trail',
        description: 'A compact walking route across snack counters, spice lanes, and dessert stops.',
        media: [
          {
            id: 'food-day-1-image',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
            caption: 'Food market lanes',
          },
        ],
        placeName: 'Central Market District',
      },
    ],
    relatedPlaces: [],
    schedules: [{ id: 'SCH-FOOD-1', label: 'Tonight, 6:30 PM', seatsLeft: 10, price: 1800, childPrice: 1200, status: 'Open' }],
    policy: 'Weather-safe plan with indoor alternates.',
    travelStyle: 'senior-friendly',
  },
  {
    id: 'tawang-road-journey',
    title: 'Tawang Himalayan Road Journey',
    destination: 'Guwahati, Dirang, Tawang',
    duration: '6 days',
    price: 28500,
    originalPrice: 31000,
    rating: 4.9,
    seatsLeft: 8,
    image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
    category: 'Adventure',
    tourType: 'planned',
    depositPercent: 25,
    groupSizeLabel: 'Fixed-date group departure',
    nextSchedule: '2026-10-12',
    highlights: ['Sela Pass at 13,700 ft', 'Army heritage stops', 'Waterfalls and alpine lakes'],
    itinerary: ['Day 1: Guwahati to Dirang', 'Day 2: Dirang to Tawang'],
    itineraryStops: [
      {
        id: 'tawang-day-1',
        day: 'Day 1',
        title: 'Guwahati to Dirang',
        description: 'A full-day mountain drive from the Assam plains into the forested valleys of Arunachal Pradesh.',
        from: 'Guwahati',
        to: 'Dirang',
        distance: '~315 km',
        travelTime: '8–9 hours',
        placeName: 'Dirang',
        keyStops: [
          { name: 'Kameng River, Bhalukpong', description: 'Stretch your legs beside the crystal-clear glacial waters.' },
          { name: 'Tippi Orchid Research Centre', description: 'A conservation centre home to more than 50 rare orchid species.' },
          { name: 'Nag Mandir', description: 'A small revered shrine built and maintained by the Indian Army.' },
        ],
        media: [{
          id: 'tawang-day-1-image',
          type: 'image',
          url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
          caption: 'The mountain road into Arunachal Pradesh',
        }],
      },
      {
        id: 'tawang-day-2',
        day: 'Day 2',
        title: 'Dirang to Tawang',
        description: 'Climb through the high Himalayas with time for the region’s most important scenic and heritage stops.',
        from: 'Dirang',
        to: 'Tawang',
        distance: '~135 km',
        travelTime: '5–6 hours',
        placeName: 'Tawang',
        keyStops: [
          { name: 'Sela Pass', description: 'The 13,700 ft high-altitude gateway to Tawang.' },
          { name: 'Sela Lake', description: 'A striking alpine lake that is often frozen in winter.' },
          { name: 'Jaswant Garh War Memorial', description: 'A memorial to Rifleman Jaswant Singh Rawat, a hero of the 1962 war.' },
          { name: 'Nuranang Falls', description: 'A spectacular waterfall with a drop of about 100 metres.' },
        ],
        media: [{
          id: 'tawang-day-2-image',
          type: 'image',
          url: 'https://images.unsplash.com/photo-1589802829985-817e51171b92?auto=format&fit=crop&w=1200&q=80',
          caption: 'High-altitude Himalayan road and lake scenery',
        }],
      },
    ],
    relatedPlaces: [],
    schedules: [
      { id: 'SCH-TAWANG-1', label: '2026-10-12', seatsLeft: 8, price: 28500, childPrice: 22800, status: 'Open' },
      { id: 'SCH-TAWANG-2', label: '2026-11-09', seatsLeft: 5, price: 29500, childPrice: 23600, status: 'Filling fast' },
    ],
    policy: 'Reserve with 25% today. Balance is due 14 days before departure; free date transfer until 21 days before travel.',
    travelStyle: 'multi-generational',
  },
]

export const rentals: Rental[] = [
  {
    id: 'compact-city',
    name: 'Compact City Hatchback',
    category: 'Economy',
    seats: 4,
    luggage: 2,
    transmission: 'Manual',
    pricePerDay: 2200,
    rating: 4.6,
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80',
    availability: 'Available today',
    features: ['Fuel efficient', 'Airport pickup', 'Roadside support'],
    policy: 'Includes standard insurance and 150 km/day.',
  },
  {
    id: 'family-suv',
    name: 'Family SUV With Driver Option',
    category: 'SUV',
    seats: 6,
    luggage: 4,
    transmission: 'Automatic',
    pricePerDay: 5200,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80',
    availability: '2 vehicles left',
    features: ['Driver included', 'Child seat on request', 'Tour-ready'],
    policy: 'Refundable damage deposit; cancellation before pickup is flexible.',
  },
  {
    id: 'premium-sedan',
    name: 'Premium Sedan',
    category: 'Premium',
    seats: 4,
    luggage: 3,
    transmission: 'Automatic',
    pricePerDay: 6800,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
    availability: 'Available tomorrow',
    features: ['Business class cabin', 'Priority support', 'Unlimited city km'],
    policy: 'Best for airport transfers and full-day private itineraries.',
  },
]

export const bookings: Booking[] = [
  {
    id: 'TB-1024',
    type: 'Tour',
    title: 'Coastal Heritage Day Tour',
    date: '20 Jun 2026',
    status: 'Confirmed',
    paymentStatus: 'Paid',
    refundStatus: 'None',
    amount: 4200,
    method: 'Wallet',
    transactionId: 'TXN-902',
    cancellable: true,
    nextStep: 'Driver and guide assignment will appear 2 hours before pickup.',
  },
  {
    id: 'CR-8841',
    type: 'Rental',
    title: 'Family SUV With Driver Option',
    date: '22 Jun 2026',
    status: 'Pending payment',
    paymentStatus: 'Pending',
    refundStatus: 'Pending',
    amount: 10400,
    method: 'Razorpay',
    transactionId: 'PAY-PENDING',
    cancellable: true,
    nextStep: 'Complete wallet or Razorpay payment to lock this vehicle.',
  },
  {
    id: 'RB-3119',
    type: 'Ride',
    title: 'Airport to Old Port',
    date: 'Today',
    status: 'In progress',
    paymentStatus: 'Paid',
    refundStatus: 'None',
    amount: 1450,
    method: 'Wallet',
    transactionId: 'TXN-918',
    cancellable: false,
    nextStep: 'Driver is heading to pickup. Track location from booking detail.',
  },
]

export const transactions: Transaction[] = [
  { id: 'TXN-901', label: 'Wallet top-up', kind: 'Credit', date: '18 Jun 2026', amount: 15000 },
  { id: 'TXN-902', label: 'Coastal Heritage booking', kind: 'Booking', date: '18 Jun 2026', amount: 4200 },
  { id: 'TXN-903', label: 'Ride tip', kind: 'Tip', date: '17 Jun 2026', amount: 150 },
  { id: 'TXN-904', label: 'Rental cancellation refund', kind: 'Refund', date: '15 Jun 2026', amount: 1800 },
]

export const destinations: Destination[] = [
  {
    id: 'old-port',
    name: 'Old Port Quarter',
    region: 'Coastal district',
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
    rating: 4.8,
    summary: 'Historic lanes, lighthouse viewpoints, seafood stops, and easy hotel pickup zones.',
    tags: ['Tours', 'Food', 'Transfers'],
    media: [
      {
        id: 'old-port-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
        caption: 'Old Port Quarter preview',
      },
    ],
    activeTours: [],
  },
  {
    id: 'valley-road',
    name: 'Valley Road',
    region: 'Hill route',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    rating: 4.9,
    summary: 'Scenic full-day loop with temple stops, photo points, and SUV-friendly routes.',
    tags: ['Scenic', 'SUV', 'Guides'],
    media: [
      {
        id: 'valley-road-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
        caption: 'Valley Road preview',
      },
    ],
    activeTours: [],
  },
  {
    id: 'market-district',
    name: 'Central Market District',
    region: 'City center',
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
    rating: 4.7,
    summary: 'Evening food walks, compact rentals, short rides, and busy pickup notes.',
    tags: ['Food', 'Night tours', 'Compact cars'],
    media: [
      {
        id: 'market-district-image',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80',
        caption: 'Central Market District preview',
      },
    ],
    activeTours: [],
  },
]

export const notifications: Notification[] = [
  {
    id: 'N-1',
    title: 'Tour confirmed',
    text: 'Coastal Heritage is confirmed. Assignment details arrive before pickup.',
    type: 'Booking',
    unread: true,
  },
  {
    id: 'N-2',
    title: 'Payment pending',
    text: 'Family SUV is reserved for a short window. Complete payment to lock it.',
    type: 'Payment',
    unread: true,
  },
  {
    id: 'N-3',
    title: 'Driver approaching',
    text: 'Airport to Old Port pickup is in progress. Tracking will refresh automatically.',
    type: 'Tracking',
    unread: false,
  },
]

export const insurancePolicies: InsurancePolicy[] = [
  {
    id: 'INS-1',
    policyNumber: 'POL-2026-000142',
    title: 'Travel protection plus',
    status: 'Active',
    coverage: 500000,
    validUntil: '31 Dec 2026',
  },
  {
    id: 'INS-2',
    policyNumber: 'POL-QUOTE-91',
    title: 'Rental damage waiver',
    status: 'Pending',
    coverage: 150000,
    validUntil: 'Quote expires in 24 hours',
  },
]

export const reviews: Review[] = [
  {
    id: 'REV-1',
    subject: 'Night Food And Market Walk',
    rating: 5,
    text: 'Clear meeting point, good tasting stops, and helpful return guidance.',
  },
  {
    id: 'REV-2',
    subject: 'Compact City Hatchback',
    rating: 4,
    text: 'Clean car and fast handover. Would like clearer fuel notes.',
  },
]

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// Render strict v1 money, which arrives as integer minor units (paise) plus an ISO-4217
// currency. Divide by 100 to match the server's FormatsMoney concern; keep 2 decimals so a
// paise-precise amount is never silently rounded (unlike formatCurrency's whole-rupee display).
export function formatMoney(money?: { amount_minor?: number; currency?: string } | null) {
  if (!money || typeof money.amount_minor !== 'number') return formatCurrency(0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: money.currency || 'INR',
  }).format(money.amount_minor / 100)
}
