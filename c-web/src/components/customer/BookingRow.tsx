import { useState } from 'react'
import { cancelBooking } from '../../utils/customerApi'
import { formatCurrency, type Booking } from '../../utils/data'
import { bookingKindFor, isNumericId } from '../../utils/customerMappers'
import { Icon } from '../Icon'
import { Link } from 'react-router-dom'
import { BookingStatus } from './BookingStatus'
import { PaymentStatus } from './PaymentStatus'
import { Button } from './Button'

export function BookingRow({ booking }: { booking: Booking }) {
  const trackingQuery = `/tracking?kind=${bookingKindFor(booking.type)}&id=${booking.id}`
  const actionTo = booking.status === 'In progress' ? trackingQuery : '/support'
  const [cancelStatus, setCancelStatus] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  async function cancelCurrentBooking() {
    setCancelStatus('')

    if (!isNumericId(booking.id)) {
      setCancelStatus(
        'This saved booking shows the cancellation state locally. Live cancellation needs a backend booking ID.',
      )
      return
    }

    setIsCancelling(true)
    const result = await cancelBooking(
      bookingKindFor(booking.type),
      booking.id,
      'Cancelled from customer web.',
    )
    setIsCancelling(false)

    setCancelStatus(
      result.error ?? 'Booking cancelled. Refund status will update from the API.',
    )
  }

  const isTour = booking.type === 'Tour'

  return (
    <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#dbe1dc] bg-white p-5 shadow-xs transition-all hover:border-[#b2d5cc]">
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f3ef] text-[#0d7769]">
          <Icon
            name={
              booking.type === 'Rental'
                ? 'car'
                : booking.type === 'Ride'
                  ? 'map'
                  : 'ticket'
            }
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-[#5b6964]">
              #{booking.id}
            </span>
            <span className="text-xs text-[#dbe1dc]">·</span>
            <span className="text-xs font-medium text-[#0d7769]">
              {booking.type}
            </span>
            <span className="text-xs text-[#dbe1dc]">·</span>
            <span className="text-xs text-[#5b6964]">
              {booking.date || 'Scheduled'}
            </span>
          </div>

          <h3 className="text-base font-bold text-[#13231f] truncate">
            {booking.title}
          </h3>

          <p className="mt-1 text-sm text-[#5b6964] leading-relaxed">
            {booking.nextStep}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#5b6964]">
            <span>Method: {booking.method}</span>
            {booking.refundStatus && booking.refundStatus !== 'None' && (
              <span className="text-[#b45309]">Refund: {booking.refundStatus}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:items-end justify-between gap-3 border-t sm:border-t-0 border-[#f0f3f1] pt-3 sm:pt-0 shrink-0">
        <div className="flex items-center gap-2">
          <BookingStatus status={booking.status} size="sm" />
          <PaymentStatus status={booking.paymentStatus} size="sm" />
        </div>

        <div className="text-lg font-bold text-[#13231f]">
          {formatCurrency(booking.amount)}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            to={`/receipts/${booking.id}?kind=${bookingKindFor(booking.type)}`}
          >
            Receipt
          </Button>

          <Button
            variant="secondary"
            size="sm"
            to={actionTo}
          >
            {booking.status === 'In progress' ? 'Track trip' : 'Support'}
          </Button>

          {isTour && ['Pending', 'Confirmed'].includes(booking.status) && (
            <Link
              className="inline-flex min-h-[36px] items-center px-3 py-1.5 text-xs font-semibold text-[#0d7769] hover:underline"
              to={`/bookings/tours/${booking.id}/share`}
            >
              Share tour
            </Link>
          )}

          {booking.cancellable && (
            <button
              className="text-xs font-semibold text-[#b42318] hover:underline disabled:opacity-50 cursor-pointer px-2 py-1"
              disabled={isCancelling}
              onClick={cancelCurrentBooking}
              type="button"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>

        {cancelStatus && (
          <small className="text-xs text-[#5b6964]" role="status">
            {cancelStatus}
          </small>
        )}
      </div>
    </article>
  )
}
