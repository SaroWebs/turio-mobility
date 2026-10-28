import { TravelHero } from '../components/customer/TravelHero'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AvailableRideMap } from '../components/customer/AvailableRideMap'
import { RideLocationInput } from '../components/customer/RideLocationInput'
import { useCustomerAuth } from '../contexts/customerAuth'
import {
  createRide,
  estimateRide,
  getCurrentRide,
  type CurrentRide,
  type LocationSearchResult,
  type RideBookingPayload,
  type RideEstimateData,
} from '../utils/customerApi'
import { asRecord } from '../utils/customerMappers'
import { formatCurrency } from '../utils/data'
import {
  PageContainer,
  Button,
} from '../components/customer/index'
import { Icon } from '../components/Icon'

export function RideBookingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, openAuthModal } = useCustomerAuth()
  const [pickupText, setPickupText] = useState('')
  const [dropText, setDropText] = useState('')
  const [pickup, setPickup] = useState<LocationSearchResult | null>(null)
  const [drop, setDrop] = useState<LocationSearchResult | null>(null)
  const [quote, setQuote] = useState<{
    result: RideEstimateData
    payload: RideBookingPayload
    expires: number
  } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  const bookingKey = useRef('')
  const submitting = useRef(false)
  const [currentRide, setCurrentRide] = useState<CurrentRide | null>(null)
  const [checkingCurrent, setCheckingCurrent] = useState(isAuthenticated)
  const [recoveryError, setRecoveryError] = useState('')

  useEffect(() => {
    let mounted = true
    let recoverySequence = 0
    async function recover() {
      const request = ++recoverySequence
      if (!isAuthenticated) {
        setCurrentRide(null)
        setCheckingCurrent(false)
        return
      }
      setCheckingCurrent(true)
      const result = await getCurrentRide()
      if (!mounted || request !== recoverySequence) return
      setCurrentRide(result.data?.data ?? null)
      setRecoveryError(result.error ?? '')
      setCheckingCurrent(false)
    }
    void recover()
    const onFocus = () => {
      void recover()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      mounted = false
      window.removeEventListener('focus', onFocus)
    }
  }, [isAuthenticated])

  const activeRide =
    currentRide &&
    ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'].includes(
      currentRide.status,
    )

  function invalidate() {
    sequence.current += 1
    bookingKey.current = ''
    setQuote(null)
    setMessage('')
    if (!submitting.current) setBusy(false)
  }

  async function getFare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      pickup?.lat == null ||
      pickup.lng == null ||
      drop?.lat == null ||
      drop.lng == null
    ) {
      setMessage('Choose pickup and drop locations from the suggestions.')
      return
    }
    const request = ++sequence.current
    const payload: RideBookingPayload = {
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: drop.lat,
      dropoff_lng: drop.lng,
      pickup_location: pickup.address || pickup.name,
      dropoff_location: drop.address || drop.name,
      service_type: 'point_to_point',
      scheduled_at: new Date(Date.now() + 5 * 60000).toISOString(),
      payment_method: 'cash',
      vehicle_class: 'mini',
      request_mode: 'immediate',
    }
    setBusy(true)
    setQuote(null)
    const result = await estimateRide(payload)
    if (request !== sequence.current) return
    setBusy(false)
    setMessage(result.error || '')
    if (result.data) {
      bookingKey.current = `ride-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setQuote({
        result: result.data,
        payload,
        expires: Date.now() + 2 * 60000,
      })
    }
  }

  async function book() {
    if (submitting.current || activeRide || checkingCurrent || recoveryError) return
    if (!isAuthenticated) {
      openAuthModal('/rides')
      return
    }
    if (!quote || quote.expires <= Date.now()) {
      setQuote(null)
      setMessage('Please check the latest fare to continue.')
      return
    }
    setBusy(true)
    submitting.current = true
    const result = await createRide(quote.payload, bookingKey.current)
    setBusy(false)
    submitting.current = false
    const booking = asRecord(result.data?.data)
    if (result.error) {
      const recovered = await getCurrentRide()
      if (recovered.data?.data) {
        navigate(`/tracking?kind=ride&id=${recovered.data.data.id}`)
        return
      }
      setMessage(result.error)
      return
    }
    if (booking.id) navigate(`/tracking?kind=ride&id=${booking.id}`)
    else
      setMessage(
        'Your request was received. Check My Bookings before trying again.',
      )
  }

  const fare = quote?.result.pricing?.total

  return (
    <>
      <TravelHero service="rides"><form
            onSubmit={getFare}
            className="hero-search-bar hero-ride-search"
          >
            

            <RideLocationInput
              kind="pickup"
              value={pickupText}
              onChange={(value) => {
                setPickupText(value)
                setPickup(null)
                invalidate()
              }}
              onSelect={(place) => {
                setPickup(place)
                setPickupText(place.address || place.name)
                invalidate()
              }}
            />

            <RideLocationInput
              kind="dropoff"
              value={dropText}
              onChange={(value) => {
                setDropText(value)
                setDrop(null)
                invalidate()
              }}
              onSelect={(place) => {
                setDrop(place)
                setDropText(place.address || place.name)
                invalidate()
              }}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={busy}
              loading={busy}
            >
              {busy ? 'Please wait...' : 'Check fare'}
            </Button>
          </form></TravelHero>
    <PageContainer className="py-8 sm:py-12">
      <nav aria-label="Ride services" className="mb-6 flex gap-4"><span className="font-semibold">Fast rides</span><Link className="font-semibold text-[#0d7769] underline" to="/rides/carpool">Carpool · Intercity cost sharing</Link></nav>
      <div className="mb-8"><h2 className="text-2xl font-bold text-[#202b3b]">Where are you heading?</h2><p className="mt-2 text-sm text-[#647184]">Set your route below to see available rides and fares.</p></div>

      {/* Active ride recovery notification */}
      {checkingCurrent && (
        <div className="mb-6 rounded-lg bg-[#e4f3ef] p-4 text-sm text-[#0d7769]" role="status">
          Checking your current ride…
        </div>
      )}

      {recoveryError && (
        <div className="mb-6 rounded-lg bg-[#fdeeed] p-4 text-sm text-[#b42318]" role="alert">
          Your current ride could not be checked. Refresh before starting another search.
        </div>
      )}

      {currentRide && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d8f3eb] bg-[#f2faf7] p-4 text-sm" role="status">
          <div className="flex items-center gap-2 text-[#0d7769]">
            <Icon name="car" />
            <span>
              {activeRide
                ? 'You already have an active assigned ride.'
                : 'You have a search in progress. Starting another search will close it.'}
            </span>
          </div>
          <Link
            to={`/tracking?kind=ride&id=${currentRide.id}`}
            className="font-bold text-[#0d7769] hover:underline"
          >
            Continue current ride →
          </Link>
        </div>
      )}

      <div className={`grid grid-cols-1 ${quote || message ? 'lg:grid-cols-[440px_minmax(0,1fr)]' : ''} items-start gap-8`}>
        {/* Left Side: Booking & Fare Console */}
        <div className={quote || message ? "space-y-6" : "hidden"}>
          

          {message && (
            <div className="rounded-lg bg-[#fafbf8] border border-[#dbe1dc] p-4 text-sm text-[#5b6964]" role="status">
              {message}
            </div>
          )}

          {/* Fare Quote Review Panel */}
          {quote && typeof fare === 'number' && (
            <div className="rounded-2xl border border-[#dbe1dc] bg-white p-6 shadow-xs animate-fadeIn">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
                Estimated Fare
              </span>
              <h2 className="mt-1 text-3xl font-extrabold text-[#0d7769]">
                {formatCurrency(fare)}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-[#5b6964]">
                Pay the driver after your ride. The final fare is confirmed by the server when you book.
              </p>

              {quote.result.nearby_drivers === 0 && (
                <div className="mt-3 rounded-lg bg-[#fef6e7] p-3 text-xs text-[#b45309]">
                  No car was available at the last fare check. A search can wait up to ten minutes for one.
                </div>
              )}

              <div className="mt-5">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={
                    busy ||
                    Boolean(activeRide) ||
                    checkingCurrent ||
                    Boolean(recoveryError)
                  }
                  onClick={book}
                >
                  {isAuthenticated
                    ? currentRide
                      ? 'Replace search'
                      : 'Find a driver'
                    : 'Login to book'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Map & Route View */}
        <div className="min-w-0">
          {quote ? (
            <div className="overflow-hidden rounded-2xl border border-[#dbe1dc] shadow-xs">
              <AvailableRideMap payload={quote.payload} />
            </div>
          ) : (
            <div className="flex aspect-[16/10] sm:min-h-[440px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#dbe1dc] bg-[#fafbf8] p-8 text-center text-[#5b6964]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e4f3ef] text-[#0d7769] mb-3">
                <Icon name="map" />
              </div>
              <h3 className="text-lg font-bold text-[#13231f]">Live Map View</h3>
              <p className="mt-1 max-w-sm text-sm">
                Enter pickup and drop locations and click "Check fare" to preview the route and available drivers.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
    </>
  )
}
