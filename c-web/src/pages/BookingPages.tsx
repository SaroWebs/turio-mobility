import { useEffect, useState, type FormEvent } from 'react'
import { BookingPayment } from '../components/customer/BookingPayment'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { bookRental, bookTour, createInsurancePolicy, getAvailableCoupons, getBookingNextSteps, getCarRentals, getPublicCarCategories, getPublicTour, getRideReceiptV1, getRides, getTourBookings, getTourSchedules, previewCoupon, searchPublicLocations, type AvailableCouponData, type BookingNextStepsData, type BookingReceipt, type CouponPreviewData, type V1Receipt } from '../utils/customerApi'
import { formatCurrency, formatMoney, type Booking, type Rental, type Tour } from '../utils/data'
import { useCustomerAuth } from '../contexts/customerAuth'
import { isNumericId, mapBooking, mapRental, mapSchedule, mapTour, tomorrowDate } from '../utils/customerMappers'
import { Icon } from '../components/Icon'
import { apiRequest } from '../utils/api'

type CheckoutFlow = 'tour' | 'rental'

function dayAfter(value: string) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function TourCheckoutPage() {
  return <CheckoutPage flow="tour" />
}

export function RentalCheckoutPage() {
  return <CheckoutPage flow="rental" />
}

function CheckoutPage({ flow }: { flow: CheckoutFlow }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useCustomerAuth()
  const isTour = flow === 'tour'
  const [tour, setTour] = useState<Tour | undefined>()
  const [rental, setRental] = useState<Rental | undefined>()
  const title = tour?.title ?? rental?.name ?? 'Selected service'
  const amount = tour?.price ?? rental?.pricePerDay ?? 0
  const [bookingStatus, setBookingStatus] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null)
  const [nextSteps, setNextSteps] = useState<BookingNextStepsData | null>(null)
  const [couponPreview, setCouponPreview] = useState<CouponPreviewData | null>(null)
  const [couponStatus, setCouponStatus] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCouponData[]>([])
  const requestedDate = searchParams.get('date') ?? ''
  const requestedPickup = searchParams.get('pickup') ?? ''
  const requestedDropoff = searchParams.get('dropoff') ?? ''
  const requestedReturnDate = searchParams.get('returnDate') ?? ''
  const requestedGuests = Math.max(1, Number(searchParams.get('guests')?.replace('+', '') ?? 2) || 2)
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [adults, setAdults] = useState(requestedGuests)
  const [children, setChildren] = useState(0)
  const [upfrontChoice, setUpfrontChoice] = useState('minimum')
  const [upfrontAmount, setUpfrontAmount] = useState('')
  const [depositRequired, setDepositRequired] = useState(false)
  const [checkoutMethod, setCheckoutMethod] = useState('cash')
  const selectedSchedule = tour?.schedules.find((schedule) => schedule.id === selectedScheduleId)
  const checkoutSubtotal = isTour
    ? selectedSchedule ? (selectedSchedule.price * adults) + (selectedSchedule.childPrice * children) : 0
    : amount
  const discountedTotal = couponPreview?.eligible ? (couponPreview.final_amount ?? checkoutSubtotal) : checkoutSubtotal
  type Quote = { quote_token: string; total: number; subtotal: number; discount: number; tax: number; service_fee: number; deposit?: number; expires_at: string; payment_plan?: { minimum_minor: number; selected_minor: number; total_minor: number } | null }
  const [reviewedQuote, setReviewedQuote] = useState<{ quote: Quote; payload: Record<string, unknown> } | null>(null)
  const bookingTotal = reviewedQuote?.quote.total ?? discountedTotal
  async function reviewOrBook(kind: 'tour' | 'rental', payload: Record<string, unknown>) {
    if (!reviewedQuote || JSON.stringify(reviewedQuote.payload) !== JSON.stringify(payload) || Date.parse(reviewedQuote.quote.expires_at) <= Date.now()) {
      const response = await apiRequest<{ data: Quote }>(kind === 'tour' ? '/tours/quote' : '/rentals/quote', { method: 'POST', body: JSON.stringify(payload) })
      if (response.error) setBookingError(response.error)
      else if (response.data) { setReviewedQuote({ quote: response.data.data, payload }); if (kind === 'tour') setDepositRequired(Boolean(response.data.data.payment_plan)); setBookingStatus('Check the total amount below, then confirm your booking.') }
      return null
    }
    const result = await (kind === 'tour' ? bookTour : bookRental)({ ...payload, quote_token: reviewedQuote.quote.quote_token })
    if (result.error) setReviewedQuote(null)
    return result
  }

  useEffect(() => {
    if (!isAuthenticated || checkoutSubtotal <= 0) {
      return
    }

    getAvailableCoupons(isTour ? 'tour' : 'rental', checkoutSubtotal).then((result) => {
      setAvailableCoupons(result.data?.data ?? [])
    })
  }, [checkoutSubtotal, isAuthenticated, isTour])

  useEffect(() => {
    let mounted = true

    if (!id || !isNumericId(id)) return () => { mounted = false }

    if (isTour) {
      Promise.all([getPublicTour(id), getTourSchedules(id)]).then(([tourResult, scheduleResult]) => {
        if (!mounted || !tourResult.data?.data) return

        const mapped = mapTour(tourResult.data.data, 0)
        const schedules = (scheduleResult.data?.data ?? []).map((item, index) => mapSchedule(item, index, mapped))
        setTour({ ...mapped, schedules })
        setSelectedScheduleId(schedules.find((schedule) => schedule.label.startsWith(requestedDate))?.id ?? schedules[0]?.id ?? '')
        if (!schedules.length) setBookingError('This tour has no bookable departures right now.')
      })
    } else {
      getPublicCarCategories().then((result) => {
        if (!mounted) return
        const match = (result.data?.data ?? []).find((item) => String((item as { id?: unknown }).id) === id)
        if (match) setRental(mapRental(match, 0))
      })
    }

    return () => { mounted = false }
  }, [id, isTour, requestedDate])

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBookingError('')
    setBookingStatus('')

    if (!isAuthenticated) {
      setBookingError('Login with OTP before creating a live booking.')
      return
    }

    const form = new FormData(event.currentTarget)
    const notes = String(form.get('notes') ?? '')
    const paymentMethod = String(form.get('paymentMethod') ?? 'cash')
    const wantsInsurance = false // Optional protection is managed separately after booking.
    const submittedCouponCode = String(form.get('couponCode') ?? '').trim()

    if (!isNumericId(id)) {
      setBookingError('This service is not available in the system catalog.')
      return
    }

    setIsSubmitting(true)
    let result

    if (isTour) {
      if (!selectedScheduleId) {
        setIsSubmitting(false)
        setBookingError('Select an available departure before booking this tour.')
        return
      }
      result = await reviewOrBook('tour', {
          tour_id: Number(id),
          tour_schedule_id: Number(selectedScheduleId),
          number_of_adults: Number(form.get('participants') ?? 1),
          number_of_children: Number(form.get('children') ?? 0),
          payment_method: paymentMethod,
          upfront_choice: upfrontChoice,
          ...(upfrontChoice === 'custom' ? { upfront_amount_minor: Math.round(Number(upfrontAmount) * 100) } : {}),
          pickup_option: form.get('pickup'),
          insurance_selected: wantsInsurance,
          coupon_code: submittedCouponCode || undefined,
          special_requests: notes,
        })
    } else {
      const pickupLocation = String(form.get('pickupLocation') ?? '').trim()
      const dropoffLocation = String(form.get('dropoffLocation') ?? '').trim()
      const pickupDate = String(form.get('pickupDate') ?? '')
      const returnDate = String(form.get('returnDate') ?? '')

      if (returnDate <= pickupDate) {
        setIsSubmitting(false)
        setBookingError('Return date must be after the pickup date.')
        return
      }

      const [pickupResult, dropoffResult] = await Promise.all([
        searchPublicLocations(pickupLocation),
        dropoffLocation ? searchPublicLocations(dropoffLocation) : Promise.resolve({ data: null, error: null }),
      ])
      const pickupPlace = pickupResult.data?.results.find((place) => place.lat !== null && place.lng !== null)
      const dropoffPlace = dropoffResult.data?.results.find((place) => place.lat !== null && place.lng !== null)

      result = await reviewOrBook('rental', {
          car_category_id: Number(id),
          start_date: pickupDate,
          end_date: returnDate,
          pickup_location: pickupLocation,
          pickup_lat: pickupPlace?.lat ?? undefined,
          pickup_lng: pickupPlace?.lng ?? undefined,
          dropoff_location: dropoffLocation || undefined,
          dropoff_lat: dropoffPlace?.lat ?? undefined,
          dropoff_lng: dropoffPlace?.lng ?? undefined,
          destination_details: form.get('destinationDetails'),
          payment_method: paymentMethod,
          extras: [
            form.get('roadsideSupport') === 'on' ? 'roadside assistance' : '',
            form.get('childSeat') === 'on' ? 'child seat' : '',
          ].filter(Boolean),
          insurance_selected: wantsInsurance,
          coupon_code: submittedCouponCode || undefined,
          special_requests: notes,
        })
    }

    setIsSubmitting(false)

    if (!result) return

    if (result.error) {
      setBookingError(result.error)
      return
    }

    const createdReceipt = result.data?.receipt ?? null
    const receiptId = createdReceipt?.receipt_number ?? createdReceipt?.booking_number ?? createdReceipt?.id ?? id
    setReceipt(createdReceipt)
    setBookingStatus(`Booking created successfully. Receipt reference: ${receiptId}.`)

    const createdBookingId = createdReceipt?.id ? String(createdReceipt.id) : ''
    const serviceType = isTour ? 'tour' : 'rental'
    if (wantsInsurance && createdBookingId) {
      const insuranceResult = await createInsurancePolicy({
        plan_code: isTour ? 'tour_protect' : 'rental_protect',
        service_type: serviceType,
        booking_id: Number(createdBookingId),
        terms_accepted: true,
        terms_version: '2026-07-22',
      })
      if (insuranceResult.error) {
        setBookingStatus(`Booking created. Insurance was not issued: ${insuranceResult.error}`)
      }
    }

    if (createdBookingId) {
      const stepsResult = await getBookingNextSteps(serviceType, createdBookingId)
      setNextSteps(stepsResult.data?.data ?? null)
    }
  }

  async function applyCoupon(form: HTMLFormElement | null) {
    if (!form) return

    setCouponStatus('')
    setCouponPreview(null)

    if (!isAuthenticated) {
      setCouponStatus('Login with OTP before applying a customer coupon.')
      return
    }

    const formData = new FormData(form)
    const code = String(formData.get('couponCode') ?? '').trim()

    if (!code) {
      setCouponStatus('Enter a coupon code first.')
      return
    }

    const result = await previewCoupon({
      coupon_code: code,
      service_type: isTour ? 'tour' : 'rental',
      subtotal: checkoutSubtotal,
    })

    if (result.error) {
      setCouponStatus(result.error)
      return
    }

    setCouponPreview(result.data?.data ?? null)
    setCouponStatus(result.data?.data?.message ?? 'Coupon checked.')
  }

  return (
    <section className="checkout-layout">
      <form className="checkout-form" onSubmit={submitBooking} onChange={() => { setReviewedQuote(null); setBookingStatus('') }}>
        <div className="page-heading compact">
          <p className="eyebrow">Step 1 of 3</p>
          <h1>Book {title}</h1>
          <p>Confirm trip details. Payment and assignment updates are visible after booking.</p>
        </div>
        <div className="progress-steps" aria-label="Booking progress">
          <span className="active">Details</span>
          <span>Payment</span>
          <span>Confirmation</span>
        </div>
        <div className="next-step-card" role="status">
          <span>Verified customer</span>
          <strong>Name and mobile number come from your OTP-verified account.</strong>
        </div>
        <fieldset>
          <legend>{isTour ? 'Tour details' : 'Rental details'}</legend>
          {isTour ? (
            <>
              <label>
                Travellers
                <input min="1" max={selectedSchedule?.seatsLeft ?? 10} name="participants" required type="number" value={adults} onChange={(event) => setAdults(Number(event.currentTarget.value))} />
              </label>
              <label>
                Children
                <input min="0" max={Math.max(0, (selectedSchedule?.seatsLeft ?? 10) - adults)} name="children" type="number" value={children} onChange={(event) => setChildren(Number(event.currentTarget.value))} />
              </label>
              <label>
                Travel date
                <select name="scheduleId" required={isNumericId(id)} value={selectedScheduleId} onChange={(event) => { setSelectedScheduleId(event.currentTarget.value); setCouponPreview(null); setCouponStatus('') }}>
                  <option disabled value="">Select an available departure</option>
                  {(tour?.schedules ?? []).map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>{schedule.label} - {schedule.seatsLeft} seats - {formatCurrency(schedule.price)}</option>
                  ))}
                </select>
                {tour?.tourType === 'private' ? <small className="helper-text">Private tours use an operator-confirmed available departure.</small> : null}
              </label>
              <label>
                Pickup option
                <select name="pickup">
                  <option>Hotel pickup</option>
                  <option>Meet at start point</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Pickup date
                <input min={tomorrowDate()} name="pickupDate" required type="date" defaultValue={requestedDate || tomorrowDate()} />
              </label>
              <label>
                Return date
                <input min={dayAfter(requestedDate || tomorrowDate())} name="returnDate" required type="date" defaultValue={requestedReturnDate && requestedReturnDate > (requestedDate || tomorrowDate()) ? requestedReturnDate : dayAfter(requestedDate || tomorrowDate())} />
              </label>
              <label>
                Pickup location
                <input name="pickupLocation" required type="text" defaultValue={requestedPickup} placeholder="Airport, hotel, landmark, or full address" />
              </label>
              <label>
                Dropoff location
                <input name="dropoffLocation" type="text" defaultValue={requestedDropoff} placeholder="Same as pickup or another destination" />
              </label>
            </>
          )}
          <label>
            Payment method
            <select name="paymentMethod" value={isTour && depositRequired ? 'cash' : checkoutMethod} onChange={event => setCheckoutMethod(event.target.value)}>
              <option value="cash">{isTour && depositRequired ? 'Pay online now, remaining balance in cash' : 'Cash'}</option>
              <option value="wallet" disabled={isTour && depositRequired}>Wallet</option>

            </select>
          </label>
          {isTour && depositRequired && <fieldset className="span-2">
            <legend>Online payment now</legend>
            <p>Every tour reservation requires an online payment before confirmation, including cash-balance bookings.</p>
            <label>Amount to pay online<select value={upfrontChoice} onChange={event => { setUpfrontChoice(event.target.value); setReviewedQuote(null) }}>
              <option value="minimum">Minimum deposit</option><option value="custom">Custom amount</option><option value="full">Full amount</option>
            </select></label>
            {upfrontChoice === 'custom' && <label>Custom online amount (INR)<input type="number" min="0.01" step="0.01" required value={upfrontAmount} onChange={event => { setUpfrontAmount(event.target.value); setReviewedQuote(null) }} /></label>}
            {reviewedQuote?.quote.payment_plan && <p>Minimum: {formatCurrency(reviewedQuote.quote.payment_plan.minimum_minor / 100)}. Pay online now: {formatCurrency(reviewedQuote.quote.payment_plan.selected_minor / 100)}. Cash due at tour start after payment: {formatCurrency((reviewedQuote.quote.payment_plan.total_minor - reviewedQuote.quote.payment_plan.selected_minor) / 100)}.</p>}
          </fieldset>}
          {!isTour ? (
            <label>
              Destination details
              <input name="destinationDetails" type="text" placeholder="Airport transfer, full-day plan, or city use" />
            </label>
          ) : null}
          <label className="span-2">
            Notes for support team
            <textarea name="notes" placeholder="Pickup address, child seat, luggage, accessibility needs" />
          </label>
        </fieldset>
        <fieldset className="option-fieldset">
          <legend>Protection and extras</legend>
          <label className="span-2">
            Coupon code
            <span className="inline-input">
              <input name="couponCode" onChange={(event) => setCouponCode(event.currentTarget.value.toUpperCase())} placeholder="Enter an offer code" type="text" value={couponCode} />
              <button className="button button-small" onClick={(event) => void applyCoupon(event.currentTarget.form)} type="button">
                Apply
              </button>
            </span>
          </label>
          {couponStatus ? <p className="helper-text span-2">{couponStatus}</p> : null}
          {isAuthenticated && availableCoupons.length ? <div className="offer-chips span-2" aria-label="Available offers">
            {availableCoupons.map((offer) => <button key={offer.code ?? offer.name} onClick={() => { setCouponCode(offer.code ?? ''); setCouponStatus(`${offer.code}: save ${formatCurrency(offer.discount_amount ?? 0)}. Select Apply to confirm.`) }} type="button">
              <strong>{offer.code}</strong><span>{offer.name}</span>
            </button>)}
          </div> : null}
          {couponPreview?.eligible ? (
            <p className="helper-text span-2">Discount: {formatCurrency(couponPreview.discount_amount ?? 0)}. Estimated total: {formatCurrency(couponPreview.final_amount ?? checkoutSubtotal)}.</p>
          ) : null}
          {!isTour ? <p className="helper-text span-2">Driver included. Car and driver details are shared after assignment. Tolls, parking and any extra usage charges must be confirmed with the operator before travel.</p> : null}

        </fieldset>
        {bookingStatus && receipt ? (
          <div className="success-state" role="status">
            <Icon name="check" />
            <div>
              <h2>{receipt ? (receipt.status === 'confirmed' ? 'Booking confirmed' : 'Waiting for confirmation') : 'Review your price'}</h2>
              <p>{bookingStatus}</p>
              <Link className="text-link compact-link" state={{ receipt }} to={`/receipts/${receipt?.id ?? id}?kind=${flow}`}>
                View receipt
              </Link>
              {nextSteps?.tracking_url ? (
                <Link className="text-link compact-link" to={nextSteps.tracking_url}>
                  Track and check in
                </Link>
              ) : null}
              {nextSteps?.instructions?.length ? (
                <ul className="instruction-list">
                  {nextSteps.instructions.map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}
        {reviewedQuote && !receipt ? <p role="status">Check the total amount, then confirm your booking.</p> : null}
        {bookingError ? <p className="helper-text" role="alert">{bookingError}</p> : null}
        <div className="form-actions">
          <button className="button button-secondary" onClick={() => navigate(-1)} type="button">
            Back
          </button>
          <button className="button button-primary" disabled={!!receipt || isSubmitting || (isTour && (!selectedSchedule || adults + children > selectedSchedule.seatsLeft))} type="submit">
            {isSubmitting ? 'Please wait...' : receipt ? 'Booking received' : reviewedQuote ? `Confirm booking - ${formatCurrency(bookingTotal)}` : 'Check total amount'}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
      <aside className="booking-summary">
        {receipt?.id && <BookingPayment key={`${flow}:${receipt.id}`} kind={flow} id={String(receipt.id)} />}
        <p className="eyebrow">{reviewedQuote ? 'Total amount' : 'Price before final checks'}</p>
        <h2>{formatCurrency(bookingTotal)}</h2>
        {reviewedQuote ? <dl className="my-4 grid grid-cols-2 gap-2"><dt>Trip price</dt><dd>{formatCurrency(reviewedQuote.quote.subtotal)}</dd><dt>Discount</dt><dd>{formatCurrency(reviewedQuote.quote.discount)}</dd><dt>Tax</dt><dd>{formatCurrency(reviewedQuote.quote.tax)}</dd><dt>Service fee</dt><dd>{formatCurrency(reviewedQuote.quote.service_fee)}</dd>{reviewedQuote.quote.deposit ? <><dt>Deposit</dt><dd>{formatCurrency(reviewedQuote.quote.deposit)}</dd></> : null}</dl> : null}
        {isTour ? <p className="helper-text">{selectedSchedule ? `${adults} adult${adults === 1 ? '' : 's'}${children ? ` + ${children} children` : ''} · ${selectedSchedule.label}` : 'Select a departure to calculate the total.'}</p> : <p className="helper-text">Check the total amount for your dates before confirming. Driver included.</p>}
        <ul className="summary-list">
          <li>
            <Icon name="shield" />
            Verified service operator
          </li>
          <li>
            <Icon name="card" />
            Cash or wallet payment
          </li>
          <li>
            <Icon name="help" />
            Support and cancellation path
          </li>
          <li>
            <Icon name="check" />
            OTP at start, rating at finish
          </li>
        </ul>
        <div className="next-step-card">
          <span>What happens next</span>
          <strong>Confirmation → assignment → OTP start → live tracking → rating</strong>
        </div>
      </aside>
    </section>
  )
}

export function ReceiptPage() {
  const { id } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const receipt = (location.state as { receipt?: BookingReceipt } | null)?.receipt
  const receiptKind = (searchParams.get('kind') ?? receipt?.service_type ?? '').toLowerCase()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [v1State, setV1State] = useState<{ id: string; receipt: V1Receipt } | null>(null)
  const [v1Failed, setV1Failed] = useState(false)
  const [status, setStatus] = useState('Loading current booking information…')
  const title = receipt?.title ?? booking?.title ?? `Booking #${id ?? ''}`

  // The strict v1 receipt endpoint binds a RideBooking, so it is ride-only and needs a numeric id.
  const canUseV1 = receiptKind.includes('ride') && isNumericId(id)
  // Only trust a v1 receipt that was fetched for the id currently in the route — this component is
  // reused across receipt navigations, so guard against showing a previous booking's data.
  const v1Receipt = v1State && v1State.id === id ? v1State.receipt : null

  // Authoritative ride receipt: fetch once from /api/v1 (money as minor units, ISO dates).
  // Every state write lives in the async callback so the effect body stays side-effect free.
  useEffect(() => {
    if (!canUseV1 || !id) return
    let mounted = true
    void getRideReceiptV1(Number(id)).then((result) => {
      if (!mounted) return
      if (result.data?.data) {
        setV1State({ id, receipt: result.data.data })
        setV1Failed(false)
        setStatus('Receipt loaded.')
      } else {
        // 401/403/404/unreadable — degrade to the legacy polling path so nothing regresses.
        setV1State(null)
        setV1Failed(true)
      }
    })
    return () => { mounted = false }
  }, [canUseV1, id])

  // Supplementary booking load: fills display-only extras (payment method, transaction id) the
  // v1 schema omits, and is the sole data source for tour/rental, non-numeric ids, or v1 failure.
  // Polls every 10s only when the v1 receipt is not the authority (unchanged legacy behaviour).
  useEffect(() => {
    let mounted = true
    const usePolling = !canUseV1 || v1Failed
    const loadBooking = () => Promise.all([getTourBookings(), getCarRentals(), getRides()]).then(([tourResult, rentalResult, rideResult]) => {
      if (!mounted) return
      const candidates = [
        ...(tourResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Tour', index)),
        ...(rentalResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Rental', index)),
        ...(rideResult.data?.data?.data ?? []).map((item, index) => mapBooking(item, 'Ride', index)),
      ]
      const requestedType = receiptKind.includes('tour') ? 'Tour' : receiptKind.includes('rental') ? 'Rental' : receiptKind.includes('ride') ? 'Ride' : ''
      const match = candidates.find((item) => item.id === id && (!requestedType || item.type === requestedType)) ?? null
      setBooking(match)
      // Don't overwrite the v1 "Receipt loaded." status while the authoritative fetch owns it.
      if (usePolling) setStatus(match ? 'Booking information is up to date.' : 'Booking information was not found in your account.')
    })
    void loadBooking()
    const timer = usePolling ? window.setInterval(loadBooking, 10000) : undefined
    return () => { mounted = false; if (timer) window.clearInterval(timer) }
  }, [id, receiptKind, canUseV1, v1Failed])

  const refunded = v1Receipt?.refunded && v1Receipt.refunded.amount_minor > 0 ? formatMoney(v1Receipt.refunded) : null

  return (
    <section className="receipt-layout">
      <div className="receipt-card">
        <p className="eyebrow">Booking receipt</p>
        <h1>{title}</h1>
        {id && ['ride', 'tour', 'rental'].includes(receiptKind) && <BookingPayment key={`${receiptKind}:${id}`} kind={receiptKind as 'ride' | 'tour' | 'rental'} id={id} />}
        <div className="receipt-grid">
          <ReceiptLine label="Booking number" value={v1Receipt?.booking_number ?? receipt?.booking_number ?? receipt?.receipt_number ?? booking?.id ?? 'Pending'} />
          <ReceiptLine label="Service type" value={v1Receipt?.type ?? receipt?.service_type ?? booking?.type ?? 'Pending'} />
          <ReceiptLine label="Date" value={formatReceiptDate(v1Receipt?.travel_date) ?? receipt?.travel_date ?? booking?.date ?? 'Pending'} />
          <ReceiptLine label="Status" value={v1Receipt?.status ?? receipt?.status ?? booking?.status ?? 'Pending'} />
          <ReceiptLine label="Payment status" value={v1Receipt?.payment_status ?? receipt?.payment_status ?? booking?.paymentStatus ?? 'Pending'} />
          <ReceiptLine label="Payment method" value={receipt?.payment_method ?? booking?.method ?? 'Pending'} />
          <ReceiptLine label="Transaction ID" value={receipt?.transaction_id ?? booking?.transactionId ?? 'Pending'} />
          <ReceiptLine label="Refund state" value={refunded ?? receipt?.refund_status ?? booking?.refundStatus ?? 'None'} />
          <ReceiptLine label="Coupon" value={receipt?.coupon_code ?? 'Not applied'} />
          <ReceiptLine label="Discount" value={formatCurrency(receipt?.discount_amount ?? 0)} />
          <ReceiptLine label="Amount" value={v1Receipt?.amount ? formatMoney(v1Receipt.amount) : formatCurrency(receipt?.amount ?? booking?.amount ?? 0)} />
        </div>
        <p className="helper-text" role="status">{status}</p>
        <div className="form-actions">
          <Link className="button button-primary" to="/bookings">
            View booking
          </Link>
          <Link className="button button-secondary" to="/support">
            Need help
          </Link>
        </div>
      </div>
    </section>
  )
}

// Render an ISO-8601 v1 timestamp as a readable date; passes through anything unparseable.
function formatReceiptDate(iso?: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
