import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BookingPayment } from '../components/customer/BookingPayment'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createInsurancePolicy, createTopUpOrder, getBookingNextSteps, getCarRentals, getDashboard, getInsurancePolicies, getRides, getTourBookings, getTrackingInfo, getWallet, getWalletTransactions, requestExtendedCare, submitBookingCheckIn, submitRideTip, submitServiceReview, submitSupportRequest, verifyTopUp, type BookingKind, type BookingNextStepsData, type TrackingData } from '../utils/customerApi'
import { formatCurrency, type Booking, type InsurancePolicy, type Transaction } from '../utils/data'
import { loadRazorpayCheckout, type RazorpaySuccessResponse } from '../utils/razorpay'
import { customerRealtime, realtimeContractNotes, type CustomerRealtimePayload } from '../utils/realtime'
import { asRecord, mapBooking, mapInsurancePolicy, mapWalletTransaction, numberValue, text, titleCase } from '../utils/customerMappers'
import { useCustomerAuth } from '../contexts/customerAuth'
import {
  BookingRow,
  BookingRowSkeleton,
  Button,
  Metric,
  MetricSkeleton,
  PageContainer,
  PageHeading,
  SectionHeader,
  Skeleton,
  StatePanel,
  SupportCard,
  TransactionRowSkeleton,
} from '../components/customer/index'
import { Icon } from '../components/Icon'
import { LiveRideGoogleMap } from '../components/customer/LiveRideGoogleMap'
import { RideSearchStatus } from '../components/customer/RideSearchStatus'
import { AvailableRideMap } from '../components/customer/AvailableRideMap'

export function DashboardPage() {
  const navigate = useNavigate()
  const { logout: clearSession } = useCustomerAuth()
  const [upcoming, setUpcoming] = useState<Booking[]>([])
  const [metrics, setMetrics] = useState({
    upcoming: '—',
    wallet: '—',
    protection: '—',
  })
  const [accountStatus, setAccountStatus] = useState('Loading your account data…')

  useEffect(() => {
    let mounted = true

    const loadDashboard = () => getDashboard().then((dashboardResult) => {
      if (!mounted) {
        return
      }

      if (dashboardResult.error) {
        setAccountStatus(dashboardResult.error)
        return
      }

      const stats = dashboardResult.data?.stats ?? {}
      const recentTours = (dashboardResult.data?.recent_bookings ?? []).map((item, index) => mapBooking(item, 'Tour', index))
      const recentRides = (dashboardResult.data?.recent_ride_bookings ?? []).map((item, index) => mapBooking(item, 'Ride', index))
      const recent = [...recentRides, ...recentTours].slice(0, 3)

      setUpcoming(recent)

      setMetrics({
        upcoming: String(numberValue(stats.tour_bookings, 0) + numberValue(stats.car_rentals, 0) + numberValue(stats.ride_bookings, 0)),
        wallet: formatCurrency(numberValue(stats.wallet_balance, 0)),
        protection: String(numberValue(stats.active_policies, 0)),
      })
      setAccountStatus(recent.length ? 'Account information is up to date.' : 'No upcoming bookings found.')
    })
    void loadDashboard()
    const timer = window.setInterval(loadDashboard, 15000)

    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  function logout() {
    clearSession()
    navigate('/')
  }

  return (
    <section className="page-section">
      <div className="dashboard-top">
        <div className="page-heading compact">
          <p className="eyebrow">Customer dashboard</p>
          <h1>Welcome back, traveler</h1>
          <p>Track active plans, review receipts, and manage wallet balance from one place.</p>
          <p className="helper-text">{accountStatus}</p>
        </div>
        <button className="button button-secondary" onClick={logout} type="button">
          Logout
        </button>
      </div>
      <div className="metric-grid">
        {accountStatus.startsWith('Loading') ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <Metric icon="ticket" label="Customer services" value={metrics.upcoming} />
            <Metric icon="wallet" label="Wallet balance" value={metrics.wallet} />
            <Metric icon="shield" label="Protection products" value={metrics.protection} />
          </>
        )}
      </div>
      <SectionHeader kicker="Next steps" title="Upcoming bookings" actionLabel="All bookings" actionTo="/bookings" />
      <div className="booking-list">
        {accountStatus.startsWith('Loading') ? (
          <>
            <BookingRowSkeleton />
            <BookingRowSkeleton />
          </>
        ) : upcoming.length ? (
          upcoming.map((booking) => (
            <BookingRow booking={booking} key={booking.id} />
          ))
        ) : (
          <p className="helper-text">No upcoming bookings in your account.</p>
        )}
      </div>
    </section>
  )
}

export function BookingsPage() {
  const [filter, setFilter] = useState<'All' | Booking['type']>('All')
  const [serviceBookings, setServiceBookings] = useState<Booking[]>([])
  const [status, setStatus] = useState('Loading booking history…')
  const visibleBookings = filter === 'All' ? serviceBookings : serviceBookings.filter((booking) => booking.type === filter)

  useEffect(() => {
    let mounted = true

    const loadBookings = () => Promise.all([getTourBookings(), getCarRentals(), getRides()]).then(([tourResult, rentalResult, rideResult]) => {
      if (!mounted) {
        return
      }

      const errors = [tourResult.error, rentalResult.error, rideResult.error].filter(Boolean)
      const liveBookings = [
        ...(tourResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Tour', index)),
        ...(rentalResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Rental', index)),
        ...(rideResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Ride', index)),
      ]

      setServiceBookings(liveBookings)
      setStatus(errors.length ? errors[0] ?? 'Could not load booking history.' : liveBookings.length ? `${liveBookings.length} bookings loaded from your account.` : 'No bookings found in your account.')
    })
    void loadBookings()
    const timer = window.setInterval(loadBookings, 10000)

    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Trips</p>
        <h1>Booking history</h1>
        <p>{status}</p>
      </div>
      <div className="filter-row">
        {(['All', 'Tour', 'Rental', 'Ride'] as const).map((item) => (
          <button aria-pressed={filter === item} className="chip" key={item} onClick={() => setFilter(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="booking-list">
        {status.startsWith('Loading') ? (
          <>
            <BookingRowSkeleton />
            <BookingRowSkeleton />
            <BookingRowSkeleton />
          </>
        ) : visibleBookings.length ? (
          visibleBookings.map((booking) => (
            <BookingRow booking={booking} key={booking.id} />
          ))
        ) : (
          <p className="helper-text">No system bookings match this filter.</p>
        )}
      </div>
    </section>
  )
}

export function WalletPage() {
  const [liveBalance, setLiveBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<Transaction[]>([])
  const [filter, setFilter] = useState('All')
  const [walletStatus, setWalletStatus] = useState('Loading wallet data…')
  const [topUpStatus, setTopUpStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const visibleTransactions = filter === 'All' ? ledger : ledger.filter((transaction) => transaction.kind === filter)

  // Re-pull the ledger after a top-up without disturbing the initial-load status copy.
  const refreshLedger = useCallback(async () => {
    const result = await getWalletTransactions()
    if (!result.error) {
      setLedger((result.data?.data?.data ?? []).map(mapWalletTransaction))
    }
  }, [])

  useEffect(() => {
    let mounted = true

    getWallet().then((result) => {
      if (!mounted) {
        return
      }

      if (result.error) {
        setWalletStatus(result.error)
        return
      }

      const balance = result.data?.data?.balance
      if (balance !== undefined) {
        setLiveBalance(Number(balance))
        setWalletStatus('Live wallet balance loaded.')
      }
    })

    getWalletTransactions().then((result) => {
      if (!mounted) return

      if (result.error) {
        setWalletStatus(result.error)
        return
      }

      const mapped = (result.data?.data?.data ?? []).map(mapWalletTransaction)
      setLedger(mapped)
      setWalletStatus(mapped.length ? `Loaded ${mapped.length} wallet transactions.` : 'No wallet transactions found.')
    })

    return () => {
      mounted = false
    }
  }, [])

  async function submitTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTopUpStatus('')
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount') ?? 0)

    if (!Number.isFinite(amount) || amount < 100) {
      setTopUpStatus('Enter a top-up amount of ₹100 or more.')
      return
    }

    setIsSubmitting(true)
    const orderResult = await createTopUpOrder(amount)
    const order = orderResult.data?.data

    if (orderResult.error || !order?.order_id || !order.razorpay_config?.key) {
      setIsSubmitting(false)
      setTopUpStatus(orderResult.error ?? 'Could not start the payment. Please try again.')
      return
    }

    try {
      await loadRazorpayCheckout()
    } catch {
      setIsSubmitting(false)
      setTopUpStatus('Could not load the payment gateway. Check your connection and try again.')
      return
    }

    if (!window.Razorpay) {
      setIsSubmitting(false)
      setTopUpStatus('Payment gateway is unavailable right now. Please try again shortly.')
      return
    }

    const config = order.razorpay_config
    setTopUpStatus('Opening secure payment…')

    const checkout = new window.Razorpay({
      key: config.key,
      // The order amount comes back in rupees; Razorpay Checkout expects integer paise.
      amount: Math.round((order.amount ?? amount) * 100),
      currency: order.currency ?? config.currency ?? 'INR',
      name: config.name ?? 'Turiya Mobility',
      description: `Wallet top-up (${order.receipt ?? order.order_id})`,
      image: config.image,
      order_id: order.order_id,
      prefill: config.prefill,
      theme: config.theme,
      handler: (response) => {
        void completeTopUp(response, amount)
      },
      modal: {
        ondismiss: () => {
          setIsSubmitting(false)
          setTopUpStatus('Payment cancelled. Your wallet was not charged.')
        },
      },
    })

    checkout.on('payment.failed', (response) => {
      setIsSubmitting(false)
      setTopUpStatus(response.error?.description ?? 'Payment failed. Your wallet was not charged.')
    })

    checkout.open()
  }

  async function completeTopUp(response: RazorpaySuccessResponse, expectedAmount: number) {
    setTopUpStatus('Confirming your payment…')
    // Double-credit is prevented server-side (natural key wallet_topup:{order}:{payment}); the
    // Idempotency-Key header + safe retry cover a lost response, so no body key is needed here.
    const verifyResult = await verifyTopUp({
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    })
    setIsSubmitting(false)

    if (verifyResult.error) {
      setTopUpStatus(`We could not confirm the payment automatically: ${verifyResult.error} Your balance will update shortly if the charge succeeded.`)
      void refreshLedger()
      return
    }

    const balance = verifyResult.data?.data?.wallet?.balance
    if (balance !== undefined) {
      setLiveBalance(Number(balance))
    }
    await refreshLedger()
    setTopUpStatus(`Wallet topped up by ${formatCurrency(expectedAmount)}. Balance updated.`)
  }

  return (
    <section className="wallet-layout">
      <div className="wallet-card">
        <p className="eyebrow">Wallet balance</p>
        <h1>{liveBalance === null ? <Skeleton className="h-9 w-32 inline-block" /> : formatCurrency(liveBalance)}</h1>
        <p>Use wallet balance for tour, rental, ride, tip, and support payments.</p>
        <p className="helper-text">{walletStatus}</p>
        <form className="topup-form" onSubmit={submitTopUp}>
          <label>
            Top-up amount
            <input min="100" name="amount" type="number" defaultValue="5000" />
          </label>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Processing…' : 'Add money to wallet'}
          </button>
          {topUpStatus ? <p className="helper-text" role="status">{topUpStatus}</p> : null}
        </form>
      </div>
      <div className="transaction-panel">
        <SectionHeader kicker="Ledger" title="Recent transactions" />
        <div className="filter-row">
          {(['All', 'Credit', 'Booking', 'Refund', 'Tip'] as const).map((item) => (
            <button aria-pressed={filter === item} className="chip" key={item} onClick={() => setFilter(item)} type="button">
              {item}
            </button>
          ))}
        </div>
        <div className="transaction-list">
          {liveBalance === null && walletStatus.includes('Loading') ? (
            <>
              <TransactionRowSkeleton />
              <TransactionRowSkeleton />
              <TransactionRowSkeleton />
            </>
          ) : visibleTransactions.length ? (
            visibleTransactions.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <div>
                  <strong>{transaction.label}</strong>
                  <span>
                    {transaction.id} - {transaction.date}
                  </span>
                </div>
                <span className={`amount ${transaction.kind.toLowerCase()}`}>
                  {transaction.kind === 'Credit' || transaction.kind === 'Refund' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
            ))
          ) : (
            <p className="helper-text">No transactions recorded yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export function SupportPage() {
  const { isAuthenticated } = useCustomerAuth()
  const [supportStatus, setSupportStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSupportStatus('')

    if (!isAuthenticated) {
      setSupportStatus('Login first to submit a support request.')
      return
    }

    setIsSubmitting(true)
    const bookingId = Number(form.get('bookingId'))
    const serviceType = String(form.get('serviceType') ?? '')
    const result = await submitSupportRequest({
      category: String(form.get('category') ?? 'general') as 'general' | 'account' | 'payment' | 'insurance' | 'safety' | 'accessibility' | 'feedback' | 'booking',
      subject: String(form.get('subject') ?? ''),
      message: String(form.get('message') ?? ''),
      priority: String(form.get('priority') ?? 'normal') as 'low' | 'normal' | 'high' | 'urgent',
      ...(bookingId > 0 && serviceType ? { service_type: serviceType as BookingKind, booking_id: bookingId } : {}),
    })
    setIsSubmitting(false)

    setSupportStatus(result.error ?? `Ticket ${result.data?.data?.ticket_number ?? ''} submitted. Keep this reference for follow-up.`)
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Support</p>
        <h1>Get help with trips, rentals, payments, and protection</h1>
        <p>Open a trackable ticket for any question. A booking reference is optional.</p>
      </div>
      <div className="support-grid">
        <SupportCard icon="calendar" title="Change a booking" text="Request date, pickup, participant, or vehicle changes before confirmation cutoffs." />
        <SupportCard icon="card" title="Payment issue" text="Retry payment, verify top-up, or ask operations to review a pending transaction." />
        <SupportCard icon="shield" title="Insurance and care" text="View policy support, roadside care, medical help, and emergency escalation options." />
        <SupportCard icon="map" title="Active service help" text="Use when a driver, guide, or rental handover is delayed or unclear." />
      </div>
      <form className="support-form" onSubmit={submitSupport}>
        <label>
          Related service (optional)
          <select name="serviceType">
            <option value="">No booking</option>
            <option value="ride">Ride</option>
            <option value="tour">Tour</option>
            <option value="rental">Rental</option>
          </select>
        </label>
        <label>
          Booking ID (optional)
          <input min="1" name="bookingId" type="number" />
        </label>
        <label>
          Category
          <select name="category">
            <option value="general">General question</option>
            <option value="account">Account</option>
            <option value="payment">Payment or wallet</option>
            <option value="insurance">Insurance or claim</option>
            <option value="booking">Booking</option>
            <option value="accessibility">Accessibility</option>
            <option value="feedback">Feedback</option>
            <option value="safety">Safety</option>
          </select>
        </label>
        <label>
          Priority
          <select name="priority">
            <option value="normal">Normal</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="span-2">
          Subject
          <input maxLength={160} name="subject" required />
        </label>
        <label className="span-2">
          Message
          <textarea name="message" placeholder="Tell support what happened and what you need next." required />
        </label>
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Submitting request...' : 'Submit support request'}
        </button>
        {supportStatus ? <p className="helper-text" role="status">{supportStatus}</p> : null}
      </form>
    </section>
  )
}

function displayStatus(value: unknown) {
  return titleCase(value, 'Pending')
}

function coordinateText(point: TrackingData['current_location']) {
  if (!point?.latitude || !point.longitude) {
    return 'Waiting for live location'
  }

  return `${Number(point.latitude).toFixed(4)}, ${Number(point.longitude).toFixed(4)}`
}

function trackingWeather(tracking: TrackingData | null) {
  if (tracking?.weather?.summary) {
    return `${tracking.weather.temperature_c ?? '--'}°C · ${tracking.weather.summary}`
  }

  return 'Weather pending'
}

export function TrackingPage() {
  const [searchParams] = useSearchParams()
  const { id: pathRideId } = useParams()
  const requestedKind = (searchParams.get('kind') ?? '').toLowerCase() as BookingKind
  const trackingKind: BookingKind = pathRideId ? 'ride' : ['ride', 'tour', 'rental'].includes(requestedKind) ? requestedKind : 'ride'
  const trackingId = pathRideId ?? searchParams.get('id') ?? ''
  const [trackingStatus, setTrackingStatus] = useState(trackingId ? 'Loading live tracking…' : 'Choose a booking from your booking history to track it.')
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [nextSteps, setNextSteps] = useState<BookingNextStepsData | null>(null)
  const [checkInStatus, setCheckInStatus] = useState('')
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  useEffect(() => {
    if (!trackingId) return
    let mounted = true
    let pollTimer: number | undefined
    let inFlight = false

    const poll = async () => {
      if (inFlight || document.hidden || !mounted) return
      window.clearTimeout(pollTimer)
      inFlight = true
      const [result, stepsResult] = await Promise.all([getTrackingInfo(trackingKind, trackingId), getBookingNextSteps(trackingKind, trackingId)])
      inFlight = false
      if (!mounted) {
        return
      }

      if (result.error) {
        if (result.status === 401 || result.status === 403 || result.status === 404) { setTracking(null); setNextSteps(null) }
        setTrackingStatus(result.error)
        pollTimer = window.setTimeout(poll, 15000)
        return
      }

      const nextTracking = result.data?.data ?? null
      setTracking(nextTracking)
      setNextSteps(stepsResult.data?.data ?? null)
      const trackingState = nextTracking?.tracking?.state
      setTrackingStatus(trackingState === 'terminal'
        ? nextTracking?.booking?.status === 'completed' || nextTracking?.rental?.status === 'completed'
          ? 'Service completed. You can now rate your experience.'
          : 'This service is closed.'
        : trackingState === 'live'
          ? 'Driver location is live.'
          : trackingState === 'stale'
            ? 'Driver location is delayed. Retrying automatically.'
            : 'Waiting for the next driver location update.')
      if (!nextTracking?.tracking?.terminal) {
        pollTimer = window.setTimeout(poll, Math.max(5, nextTracking?.tracking?.poll_after_seconds ?? 10) * 1000)
      }
    }

    void poll()
    const refreshVisible = () => { if (!document.hidden) void poll(); else window.clearTimeout(pollTimer) }
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('online', refreshVisible)

    return () => {
      mounted = false
      if (pollTimer) window.clearTimeout(pollTimer)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('online', refreshVisible)
    }
  }, [trackingId, trackingKind])

  const liveBooking = asRecord(tracking?.booking ?? tracking?.rental)
  const liveTitle = text(liveBooking.pickup_location ?? liveBooking.booking_number ?? liveBooking.customer_name, trackingId ? `Booking #${trackingId}` : 'Live tracking')
  const liveStatus = displayStatus(liveBooking.status)
  const eta = tracking?.eta_minutes ? `${tracking.eta_minutes} min` : liveBooking.status === 'completed' ? 'Arrived' : 'Calculating'
  const protection = tracking?.protection?.label ?? (tracking?.protection?.status === 'active' ? 'Active' : 'Optional')
  const startCode = tracking?.start_verification?.code
  const statusSteps = tracking?.status_steps?.length
    ? tracking.status_steps
    : [
        { key: 'confirmed', label: 'Booking confirmed', done: liveStatus !== 'Pending', active: liveStatus === 'Confirmed' },
        { key: 'assigned', label: trackingKind === 'tour' ? 'Guide/driver assigned' : 'Driver assigned', done: ['Driver Assigned', 'In Progress', 'In Transit', 'Completed'].includes(liveStatus), active: liveStatus === 'Driver Assigned' },
        { key: 'started', label: 'OTP verified and service started', done: ['In Progress', 'In Transit', 'Completed'].includes(liveStatus), active: ['In Progress', 'In Transit'].includes(liveStatus) },
        { key: 'completed', label: 'Complete service and rate', done: liveStatus === 'Completed', active: liveStatus === 'Completed' },
      ]

  async function submitCheckIn() {
    setCheckInStatus('')
    setIsCheckingIn(true)

    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 5000,
      })
    })

    const result = await submitBookingCheckIn(trackingKind, trackingId, {
      latitude: position?.coords.latitude,
      longitude: position?.coords.longitude,
      note: `Customer checked in from tracking for ${trackingKind} booking ${trackingId}.`,
    })
    const stepsResult = await getBookingNextSteps(trackingKind, trackingId)
    setIsCheckingIn(false)

    if (result.error) {
      setCheckInStatus(result.error)
      return
    }

    setNextSteps(stepsResult.data?.data ?? nextSteps)
    setCheckInStatus(result.data?.message ?? 'Customer check-in recorded.')
  }

  return (
    <section className="tracking-layout">
      {trackingKind === 'ride' && !liveBooking.driver_id && ['pending', 'confirmed'].includes(String(liveBooking.status)) && liveBooking.request_expires_at && tracking?.pickup?.latitude != null && tracking?.pickup?.longitude != null
        ? <AvailableRideMap deadline={String(liveBooking.request_expires_at)} serverTime={tracking.server_time} payload={{ pickup_lat: Number(tracking.pickup.latitude), pickup_lng: Number(tracking.pickup.longitude), dropoff_lat: tracking.dropoff?.latitude == null ? undefined : Number(tracking.dropoff.latitude), dropoff_lng: tracking.dropoff?.longitude == null ? undefined : Number(tracking.dropoff.longitude), service_type: 'point_to_point', scheduled_at: String(liveBooking.scheduled_at), vehicle_class: String(liveBooking.vehicle_class ?? 'mini') }} />
        : <LiveRideGoogleMap currentLocation={tracking?.current_location} dropoff={tracking?.dropoff} pickup={tracking?.pickup} status={liveStatus} />}
      <aside className="tracking-panel">
        <p className="eyebrow">Live tracking</p>
        <h1>{liveTitle}</h1>
        {trackingKind === 'ride' && !liveBooking.driver_id && ['pending', 'confirmed'].includes(String(liveBooking.status)) && typeof liveBooking.request_expires_at === 'string' && <RideSearchStatus deadline={liveBooking.request_expires_at} serverTime={tracking?.server_time} />}
        {trackingId && <BookingPayment key={`${trackingKind}:${trackingId}`} kind={trackingKind} id={trackingId} />}
        {trackingKind === 'ride' && ['cancelled', 'rejected'].includes(String(liveBooking.status)) && <p>This ride request is closed. <Link to="/rides">Search again</Link></p>}
        <p>
          {liveStatus} · {coordinateText(tracking?.current_location)}
        </p>
        <div className="trip-glance" aria-label="Current trip conditions">
          <div><Icon name="clock" /><span>ETA<strong>{eta}</strong></span></div>
          <div><Icon name="compass" /><span>Weather<strong>{trackingWeather(tracking)}</strong></span></div>
          <div><Icon name="shield" /><span>Protection<strong>{protection}</strong></span></div>
        </div>
        <div className="otp-card">
          <span><Icon name="shield" /> Start verification</span>
          <strong>{startCode ? `OTP ${startCode}` : 'OTP pending'}</strong>
          <small>{tracking?.start_verification?.instructions ?? 'Share this code only after you meet the assigned driver or guide.'}</small>
        </div>
        <button className="button button-secondary full-width" disabled={isCheckingIn || nextSteps?.actions?.can_check_in === false} onClick={submitCheckIn} type="button">
          {isCheckingIn ? 'Recording check-in...' : 'I am ready / check in'}
        </button>
        {checkInStatus ? <p className="helper-text" role="status">{checkInStatus}</p> : null}
        {nextSteps?.instructions?.length ? (
          <div className="next-step-card">
            <span>What to do next</span>
            <ul className="instruction-list">
              {nextSteps.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="api-status-panel inline-status">
          <Icon name="bell" />
          <p>{trackingStatus}</p>
        </div>
        <div className="timeline">
          {statusSteps.map((step) => (
            <TrackingStep
              done={step.done}
              key={step.key}
              title={step.label}
              text={step.active ? 'This is the current operational state.' : step.done ? 'Completed.' : 'Waiting for operations update.'}
            />
          ))}
        </div>
        <Link className="button button-primary full-width" to="/support">
          Contact support
        </Link>
        <Link className="text-link tracking-review-link" to="/reviews">
          Rate this service after completion <Icon name="arrow" />
        </Link>
      </aside>
    </section>
  )
}

export function TrackingStep({ done = false, title, text }: { done?: boolean; title: string; text: string }) {
  return (
    <div className={done ? 'timeline-step done' : 'timeline-step'}>
      <span>
        <Icon name={done ? 'check' : 'clock'} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const [realtimeEvents, setRealtimeEvents] = useState<CustomerRealtimePayload[]>([])

  useEffect(() => {
    const unsubscribe = customerRealtime.subscribe('tracking.location.updated', (payload) => {
      setRealtimeEvents((events) => [payload, ...events].slice(0, 3))
    })

    return unsubscribe
  }, [])

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Notification center</p>
        <h1>Booking, payment, tracking, and support updates</h1>
        <p>Customer alerts stay grouped by booking, payment, tracking, and support state.</p>
      </div>
      <div className="notification-list">
        {realtimeEvents.map((event) => (
          <article className="notification-card unread" key={`${event.bookingId}-${event.updatedAt}`}>
            <span>{titleCase(event.serviceType, 'Service')}</span>
            <h2>{titleCase(event.status, 'Tracking update')}</h2>
            <p>{event.message}</p>
          </article>
        ))}
        {!realtimeEvents.length ? <p className="helper-text">No system notifications received in this session.</p> : null}
      </div>
      <div className="policy-panel">
        <Icon name="bell" />
        <div>
          <h2>Realtime contract prep</h2>
          <ul>
            {realtimeContractNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function InsurancePage() {
  const { isAuthenticated } = useCustomerAuth()
  const [policyStatus, setPolicyStatus] = useState('Loading insurance policies…')
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [careStatus, setCareStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false)

  useEffect(() => {
    let mounted = true

    getInsurancePolicies().then((result) => {
      if (!mounted) {
        return
      }

      if (result.error) {
        setPolicyStatus(result.error)
        return
      }

      const mapped = (result.data?.data ?? []).map(mapInsurancePolicy)
      setPolicies(mapped)
      setPolicyStatus(`Live insurance policies loaded: ${mapped.length}.`)
    })

    return () => {
      mounted = false
    }
  }, [])

  async function submitPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsCreatingPolicy(true)
    const result = await createInsurancePolicy({
      plan_code: String(form.get('planCode') ?? 'ride_protect') as 'ride_protect' | 'tour_protect' | 'rental_protect',
      service_type: String(form.get('serviceType') ?? 'ride') as BookingKind,
      booking_id: Number(form.get('bookingId')),
      terms_accepted: true as const,
      terms_version: '2026-07-22',
    })
    setIsCreatingPolicy(false)

    if (result.error) {
      setPolicyStatus(result.error)
      return
    }

    const policy = result.data?.data
    if (policy) {
      setPolicies((items) => [mapInsurancePolicy(policy, 0), ...items])
    }
    setPolicyStatus(result.data?.message ?? 'Insurance policy created successfully.')
    event.currentTarget.reset()
  }

  async function submitCare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsSubmitting(true)
    const result = await requestExtendedCare(String(form.get('careType') ?? 'roadside'), String(form.get('notes') ?? ''))
    setIsSubmitting(false)

    setCareStatus(result.error ?? 'Extended-care request submitted.')
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Protection</p>
        <h1>Insurance and extended care</h1>
        <p>{policyStatus}</p>
      </div>
      <div className="card-grid">
        {policyStatus.startsWith('Loading') ? (
          <>
            <article className="rounded-2xl border border-[#ded8ca] bg-white p-[22px] animate-pulse space-y-3">
              <div className="h-7 w-7 rounded bg-[#e8eae6]" />
              <div className="h-5 w-40 rounded bg-[#e8eae6]" />
              <div className="h-3.5 w-28 rounded bg-[#e8eae6]" />
              <div className="h-3.5 w-52 rounded bg-[#e8eae6]" />
            </article>
            <article className="rounded-2xl border border-[#ded8ca] bg-white p-[22px] animate-pulse space-y-3">
              <div className="h-7 w-7 rounded bg-[#e8eae6]" />
              <div className="h-5 w-40 rounded bg-[#e8eae6]" />
              <div className="h-3.5 w-28 rounded bg-[#e8eae6]" />
              <div className="h-3.5 w-52 rounded bg-[#e8eae6]" />
            </article>
          </>
        ) : policies.length ? (
          policies.map((policy) => (
            <article className="rounded-2xl border border-[#ded8ca] bg-white p-[22px] shadow-[0_12px_32px_rgba(23,33,29,0.1)] [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-[#0f766e] [&_h2]:m-0 [&_p]:leading-relaxed [&_p]:text-[#5f6b64]" key={policy.id}>
              <Icon name="shield" />
              <h2>{policy.title}</h2>
              <p>{policy.policyNumber}</p>
              <p>
                {policy.status} - {formatCurrency(policy.coverage)} coverage - {policy.validUntil}
              </p>
            </article>
          ))
        ) : (
          <p className="helper-text">No insurance policies found in your account.</p>
        )}
      </div>
      <form className="support-form" onSubmit={submitPolicy}>
        <label>
          Insurance plan
          <select name="planCode">
            <option value="ride_protect">Ride Protect</option>
            <option value="tour_protect">Tour Protect</option>
            <option value="rental_protect">Rental Protect</option>
          </select>
        </label>
        <label>
          Related service
          <select name="serviceType">
            <option value="ride">Ride</option>
            <option value="tour">Tour</option>
            <option value="rental">Rental</option>
          </select>
        </label>
        <label>
          Booking ID
          <input min="1" name="bookingId" required type="number" />
        </label>
        <label className="span-2">
          <input name="termsAccepted" required type="checkbox" />
          I accept insurance policy version 2026-07-22 and understand that provider details, price, coverage, exclusions, and cancellation terms must be shown before issuance.
        </label>
        <button className="button button-primary" disabled={isCreatingPolicy || !isAuthenticated} type="submit">
          {isCreatingPolicy ? 'Creating policy...' : 'Create insurance policy'}
        </button>
        {!isAuthenticated ? <p className="helper-text">Login first to create a policy.</p> : null}
      </form>
      <div className="support-grid">
        <SupportCard icon="help" title="Roadside care" text="Request help for breakdowns, handover problems, or route interruptions." />
        <SupportCard icon="shield" title="Medical care" text="Escalate medical support with location and booking context." />
        <SupportCard icon="card" title="Claims support" text="Collect booking, payment, and receipt context for claim follow-up." />
        <SupportCard icon="map" title="Emergency dispatch" text="Keep pickup, driver, guide, or rental details visible during escalation." />
      </div>
      <form className="support-form" onSubmit={submitCare}>
        <label>
          Care type
          <select name="careType">
            <option value="roadside">Roadside</option>
            <option value="medical">Medical</option>
            <option value="emergency">Emergency</option>
            <option value="legal">Legal</option>
          </select>
        </label>
        <label className="span-2">
          Care notes
          <textarea name="notes" placeholder="Describe the location, booking, and assistance needed." />
        </label>
        <button className="button button-primary" disabled={isSubmitting || !isAuthenticated} type="submit">
          {isSubmitting ? 'Requesting care...' : 'Request extended care'}
        </button>
        {careStatus ? <p className="helper-text" role="status">{careStatus}</p> : null}
        {!isAuthenticated ? <p className="helper-text">Login first to submit an extended-care request.</p> : null}
      </form>
    </section>
  )
}

export function ReviewsPage() {
  const { isAuthenticated, openAuthModal } = useCustomerAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [reviewStatus, setReviewStatus] = useState<{ message: string; isError?: boolean } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(() => isAuthenticated)
  const [completedBookings, setCompletedBookings] = useState<Booking[]>([])
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(() => new Set())
  const [selectedBookingKey, setSelectedBookingKey] = useState<string>('')
  const [rating, setRating] = useState<number>(5)
  const [reviewText, setReviewText] = useState('')
  const [tipAmount, setTipAmount] = useState('0')

  const preselectedId = searchParams.get('id')
  const preselectedKind = searchParams.get('kind')?.toLowerCase()

  useEffect(() => {
    if (!isAuthenticated) return

    let mounted = true

    Promise.all([getTourBookings(), getCarRentals(), getRides()]).then(([tourResult, rentalResult, rideResult]) => {
      if (!mounted) return
      setIsLoading(false)

      const items = [
        ...(tourResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Tour', index)),
        ...(rentalResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Rental', index)),
        ...(rideResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Ride', index)),
      ].filter((booking) => booking.status === 'Completed')

      setCompletedBookings(items)

      // Initialize selection from query params or first unreviewed booking
      const unreviewed = items.filter((b) => !b.reviewed)
      if (preselectedId) {
        const match = unreviewed.find(
          (b) => b.id === preselectedId && (!preselectedKind || b.type.toLowerCase() === preselectedKind)
        )
        if (match) {
          setSelectedBookingKey(`${match.type.toLowerCase()}:${match.id}`)
          return
        }
      }
      if (unreviewed.length > 0) {
        setSelectedBookingKey(`${unreviewed[0].type.toLowerCase()}:${unreviewed[0].id}`)
      }
    })

    return () => {
      mounted = false
    }
  }, [isAuthenticated, preselectedId, preselectedKind])

  const getBookingKey = (b: Booking) => `${b.type.toLowerCase()}:${b.id}`

  const unreviewedBookings = completedBookings.filter(
    (b) => !b.reviewed && !reviewedKeys.has(getBookingKey(b))
  )
  const reviewedBookings = completedBookings.filter(
    (b) => b.reviewed || reviewedKeys.has(getBookingKey(b))
  )

  const selectedBooking = unreviewedBookings.find(
    (b) => getBookingKey(b) === selectedBookingKey
  ) ?? unreviewedBookings[0]

  async function submitReviewForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedBooking) {
      setReviewStatus({ message: 'Please select one of your completed trips to review.', isError: true })
      return
    }

    const serviceType: BookingKind =
      selectedBooking.type === 'Ride' ? 'ride' : selectedBooking.type === 'Tour' ? 'tour' : 'rental'
    const subjectId = selectedBooking.id
    const tip = Number(tipAmount)

    setIsSubmitting(true)
    setReviewStatus(null)

    const result = await submitServiceReview(serviceType, subjectId, rating, reviewText)
    const tipResult = serviceType === 'ride' && tip > 0 ? await submitRideTip(subjectId, tip) : { error: null }
    setIsSubmitting(false)

    if (result.error || tipResult.error) {
      setReviewStatus({
        message: result.error ?? tipResult.error ?? 'Could not submit review. Please try again.',
        isError: true,
      })
      return
    }

    const submittedKey = getBookingKey(selectedBooking)
    setReviewedKeys((prev) => new Set([...prev, submittedKey]))
    setReviewStatus({
      message: `Thank you! Your verified review for "${selectedBooking.title}" has been published.`,
      isError: false,
    })
    setReviewText('')
    setTipAmount('0')

    const remaining = unreviewedBookings.filter((b) => getBookingKey(b) !== submittedKey)
    if (remaining.length > 0) {
      setSelectedBookingKey(getBookingKey(remaining[0]))
    } else {
      setSelectedBookingKey('')
    }
  }

  const ratingDescriptions: Record<number, string> = {
    5: '5 ★ — Excellent! Exceeded expectations',
    4: '4 ★ — Good, very satisfied',
    3: '3 ★ — Average, met expectations',
    2: '2 ★ — Below expectations',
    1: '1 ★ — Poor experience',
  }

  return (
    <PageContainer className="py-8 sm:py-12">
      <div className="mb-8">
        <PageHeading
          eyebrow="Customer Feedback"
          title="Review completed services"
          description="Rate and share feedback for verified trips you completed. Only trips completed under your account that haven't been reviewed yet can be reviewed."
        />
      </div>

      {!isAuthenticated ? (
        <StatePanel
          type="empty"
          title="Login to view your completed trips"
          description="Reviews are restricted to verified travelers who have completed a ride, tour, or rental booking."
          actionLabel="Login with OTP"
          onAction={() => openAuthModal('/reviews')}
        />
      ) : isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-2xl border border-[#dbe1dc] bg-white p-6 sm:p-8 space-y-4">
            <div className="h-4 w-40 rounded bg-[#e8eae6]" />
            <div className="h-12 w-full rounded-lg bg-[#e8eae6]" />
            <div className="h-4 w-32 rounded bg-[#e8eae6]" />
            <div className="h-10 w-48 rounded-lg bg-[#e8eae6]" />
            <div className="h-28 w-full rounded-lg bg-[#e8eae6]" />
            <div className="h-11 w-36 rounded-lg bg-[#e8eae6]" />
          </div>
        </div>
      ) : completedBookings.length === 0 ? (
        <StatePanel
          type="empty"
          title="No completed services available for review"
          description="You haven't completed any trips yet. Once you complete a ride, tour, or car rental, you can share your feedback here."
          actionLabel="Explore tours"
          onAction={() => navigate('/tours')}
        />
      ) : unreviewedBookings.length === 0 ? (
        <div className="space-y-8">
          <StatePanel
            type="empty"
            title="All completed trips have been reviewed"
            description="Thank you for taking the time to share your feedback! Your reviews help fellow travelers discover great experiences."
            actionLabel="View booking history"
            onAction={() => navigate('/bookings')}
          />

          {reviewedBookings.length > 0 && (
            <div className="rounded-2xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#13231f] mb-4">
                Your Reviewed Trips ({reviewedBookings.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reviewedBookings.map((b) => (
                  <div
                    key={getBookingKey(b)}
                    className="flex flex-col justify-between rounded-xl border border-[#e4f3ef] bg-[#f7fbf9] p-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-[#0d7769] uppercase tracking-wider">{b.type}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f7ed] px-2 py-0.5 font-semibold text-[#137333]">
                          ✓ Reviewed
                        </span>
                      </div>
                      <strong className="block text-sm font-bold text-[#13231f] line-clamp-1">{b.title}</strong>
                      <p className="mt-1 text-[#5b6964]">Completed on {b.date || 'Recent'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] items-start gap-8">
          {/* Review Form */}
          <div className="rounded-2xl border border-[#dbe1dc] bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#13231f] mb-2">Write your review</h2>
            <p className="text-xs text-[#5b6964] mb-6 leading-relaxed">
              Your feedback is verified against your actual booking. Choose which completed trip you wish to review.
            </p>

            <form onSubmit={submitReviewForm} className="space-y-5">
              {/* Trip Selector: Dropdown of only unreviewed completed bookings */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#13231f] mb-2">
                  Select Completed Trip to Review
                </label>
                <select
                  aria-label="Select completed trip to review"
                  value={selectedBooking ? getBookingKey(selectedBooking) : ''}
                  onChange={(e) => setSelectedBookingKey(e.target.value)}
                  className="w-full rounded-xl border border-[#dbe1dc] bg-[#f7f8f5] px-4 py-3 text-sm font-semibold text-[#13231f] transition focus:border-[#0d7769] focus:bg-white focus:outline-none"
                  required
                >
                  {unreviewedBookings.map((b) => (
                    <option key={getBookingKey(b)} value={getBookingKey(b)}>
                      {b.type}: {b.title} (Completed: {b.date || 'Recent'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Verified Trip Banner */}
              {selectedBooking && (
                <div className="flex items-start gap-3 rounded-xl border border-[#b2e1d5] bg-[#e4f3ef] p-4 text-xs text-[#0a5d54]">
                  <span className="mt-0.5 text-base leading-none">✓</span>
                  <div>
                    <strong className="block text-sm font-bold text-[#0a5d54]">
                      {selectedBooking.title}
                    </strong>
                    <p className="mt-0.5 text-[#0d7769]">
                      Verified {selectedBooking.type} booking #{selectedBooking.id} · Completed on {selectedBooking.date || 'recorded date'}
                    </p>
                  </div>
                </div>
              )}

              {/* Rating selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#13231f] mb-2">
                  Rating: <span className="font-semibold text-[#0d7769]">{ratingDescriptions[rating]}</span>
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg transition cursor-pointer active:scale-95 ${
                        star <= rating
                          ? 'border-[#0d7769] bg-[#0d7769] text-white shadow-xs'
                          : 'border-[#dbe1dc] bg-white text-[#899590] hover:border-[#0d7769] hover:text-[#0d7769]'
                      }`}
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#13231f] mb-2">
                  Your Review
                </label>
                <textarea
                  name="review"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share details of your experience: promptness, vehicle cleanliness, tour itinerary, guide expertise, or driver courtesy..."
                  rows={4}
                  required
                  className="w-full rounded-xl border border-[#dbe1dc] bg-white p-4 text-sm text-[#13231f] placeholder:text-[#899590] transition focus:border-[#0d7769] focus:outline-none focus:ring-1 focus:ring-[#0d7769]"
                />
              </div>

              {/* Optional tip for rides only */}
              {selectedBooking?.type === 'Ride' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#13231f] mb-2">
                    Optional Driver Tip (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-[#dbe1dc] bg-white px-4 py-3 text-sm text-[#13231f] transition focus:border-[#0d7769] focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-[#5b6964]">
                    Tip amount is transferred directly to your driver's wallet from your Turiya Mobility wallet.
                  </p>
                </div>
              )}

              {reviewStatus && (
                <div
                  className={`rounded-xl p-4 text-sm ${
                    reviewStatus.isError
                      ? 'border border-[#f8c4c0] bg-[#fdeeed] text-[#b42318]'
                      : 'border border-[#b8e4c7] bg-[#e7f7ed] text-[#137333]'
                  }`}
                  role={reviewStatus.isError ? 'alert' : 'status'}
                >
                  {reviewStatus.message}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting || !selectedBooking}
              >
                Submit review
              </Button>
            </form>
          </div>

          {/* Sidebar: Unreviewed List & Already Reviewed */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
                Pending Feedback ({unreviewedBookings.length})
              </span>
              <h3 className="text-base font-bold text-[#13231f] mt-1 mb-3">
                Trips awaiting review
              </h3>
              <div className="space-y-3">
                {unreviewedBookings.map((b) => {
                  const isSelected = selectedBooking && getBookingKey(selectedBooking) === getBookingKey(b)
                  return (
                    <div
                      key={getBookingKey(b)}
                      onClick={() => setSelectedBookingKey(getBookingKey(b))}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? 'border-[#0d7769] bg-[#e4f3ef]/40 shadow-xs'
                          : 'border-[#dbe1dc] bg-white hover:border-[#0d7769]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0d7769]">
                          {b.type} #{b.id}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-bold text-[#0d7769]">● Selected</span>
                        )}
                      </div>
                      <strong className="block text-sm font-bold text-[#13231f] truncate">
                        {b.title}
                      </strong>
                      <p className="mt-1 text-xs text-[#5b6964]">
                        Completed on {b.date || 'Recent'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {reviewedBookings.length > 0 && (
              <div className="rounded-2xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#137333]">
                  Completed ({reviewedBookings.length})
                </span>
                <h3 className="text-base font-bold text-[#13231f] mt-1 mb-3">
                  Previously reviewed trips
                </h3>
                <div className="space-y-2">
                  {reviewedBookings.slice(0, 3).map((b) => (
                    <div
                      key={getBookingKey(b)}
                      className="rounded-xl border border-[#e7f7ed] bg-[#f7fbf9] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#13231f] truncate">{b.title}</span>
                        <span className="shrink-0 text-[#137333]">✓ Done</span>
                      </div>
                    </div>
                  ))}
                  {reviewedBookings.length > 3 && (
                    <p className="text-xs text-[#5b6964] pt-1">
                      + {reviewedBookings.length - 3} more trips reviewed
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export function PolicyPage() {
  const { slug } = useParams()
  const policyContent: Record<string, { title: string; points: string[] }> = {
    'cancellation-policy': {
      title: 'Cancellation policy',
      points: [
        'Tours and rentals can be cancelled from the booking row when the booking is eligible.',
        'Paid wallet bookings are refunded to wallet after the cancellation service calculates any applicable fee.',
        'Active rides, in-progress tours, and in-progress rentals may carry operational cancellation fees.',
      ],
    },
    'refund-policy': {
      title: 'Refund policy',
      points: [
        'Wallet refunds are processed back to the customer wallet when the payment method supports it.',
        'Card, UPI, or manually settled refunds remain pending until operations completes the refund review.',
        'Refund status is visible on receipts and booking history.',
      ],
    },
    'privacy-policy': {
      title: 'Privacy policy',
      points: [
        'Customer phone numbers are used for OTP login, booking coordination, and support follow-up.',
        'Location data is used for pickup, dropoff, tracking, dispatch, and safety escalation.',
        'Payment references are stored to connect wallet, booking, refund, and receipt records.',
      ],
    },
    'terms-and-conditions': {
      title: 'Terms and conditions',
      points: [
        'A booking contract is created only after the server returns a booking reference and confirmed price or payment state.',
        'Ride, tour, and rental services have separate lifecycle rules; a status in one service never changes another service.',
        'Customers must provide accurate passenger, pickup, contact, and payment information and follow lawful driver and safety instructions.',
        'Prices, inclusions, change windows, cancellation fees, refund method, and optional protection must be shown before confirmation.',
      ],
    },
    'insurance-policy': {
      title: 'Insurance policy',
      points: [
        'Insurance is optional and issued only for the ride, tour, or rental booking shown at acceptance.',
        'The licensed provider name, exact policy wording, premium, coverage limit, dates, benefits, exclusions, claim evidence, and cancellation rules must be visible before issuance.',
        'Customers cannot edit an issued premium, coverage limit, provider, terms version, or policy status. Corrections are handled through a support ticket with an audit trail.',
        'Driver policies are stored separately, linked to the driver and vehicle, and shown as active only after verification and date checks.',
        'If provider details or policy wording are missing, issuance remains unavailable rather than presenting protection as active.',
      ],
    },
    'support-policy': {
      title: 'Support policy',
      points: [
        'Every request receives a ticket reference and message history; a ride, tour, or rental reference is optional.',
        'General, account, payment, insurance, accessibility, feedback, booking, and safety topics can be submitted without starting a booking.',
        'Urgent safety tickets should include current location and immediate assistance needed. Use local emergency services when there is immediate danger.',
      ],
    },
    'safety-policy': {
      title: 'Safety policy',
      points: [
        'Tracking, driver assignment, and stale-location states remain visible during active services.',
        'Emergency and extended-care requests can be submitted from the insurance and support flows.',
        'Customers should keep pickup notes, contact details, and booking references current before travel.',
      ],
    },
  }
  const policy = policyContent[slug ?? ''] ?? {
    title: (slug ?? 'policy').replaceAll('-', ' '),
    points: ['This policy is connected to the customer support and booking workflow.'],
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Policy</p>
        <h1>{policy.title}</h1>
        <p>Operational policy details for customer bookings, payments, tracking, safety, and support.</p>
      </div>
      <div className="policy-panel">
        <Icon name="help" />
        <div>
          <h2>Frequently asked questions</h2>
          <details><summary>Do I need a booking to contact support?</summary><p>No. Add a booking only when it helps the team investigate.</p></details>
          <details><summary>Can I edit insurance after purchase?</summary><p>No. Issued terms are immutable; open a ticket for a correction or cancellation.</p></details>
          <details><summary>Where should I check before travel?</summary><p>Review the receipt, assigned service details, cancellation window, coverage status, contact information, and live next steps.</p></details>
        </div>
      </div>
      <div className="policy-panel">
        <Icon name="shield" />
        <div>
          <h2>Customer commitments</h2>
          <ul>
            {policy.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
