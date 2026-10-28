import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../utils/api'
import { loadRazorpayCheckout, type RazorpaySuccessResponse } from '../../utils/razorpay'
import { Button } from './Button'
import { PaymentStatus } from './PaymentStatus'

type Status = {
  checkout_state: string
  status_message: string
  enabled: boolean
  can_pay: boolean
  payment_status: string
  refund_pending: boolean
  amount_minor: number
  currency: string
  tour_payment?: {
    total_minor: number
    minimum_minor: number
    selected_minor: number
    online_paid_minor: number
    remaining_cash_minor: number
    refunded_minor: number
    refund_pending_minor: number
  } | null
}
type Order = { order_id: string; amount_minor: number; currency: string; key: string }

export function BookingPayment({ kind, id }: { kind: 'ride' | 'tour' | 'rental'; id: string }) {
  const path = `/booking-payments/${kind}/${encodeURIComponent(id)}`
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [verification, setVerification] = useState<RazorpaySuccessResponse | null>(null)
  const generation = useRef(0)
  const opening = useRef(false)
  const requestSequence = useRef(0)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const version = ++generation.current
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (opening.current) {
        timer = setTimeout(refresh, 10000)
        return
      }
      const sequence = ++requestSequence.current
      const result = await apiRequest<{ data: Status }>(path)
      if (version !== generation.current) return
      if (sequence === requestSequence.current) {
        setConnected(!result.error)
        if (result.data?.data) setStatus(result.data.data)
      }
      timer = setTimeout(refresh, 10000)
    }
    void refresh()
    return () => {
      generation.current += 1
      clearTimeout(timer)
    }
  }, [path])

  async function verify(payment: RazorpaySuccessResponse, version: number) {
    opening.current = true
    requestSequence.current += 1
    const result = await apiRequest<{ data: Status; message?: string }>(`${path}/verify`, {
      method: 'POST',
      body: JSON.stringify(payment),
    })
    if (version !== generation.current) return
    opening.current = false
    setBusy(false)
    if (result.error) {
      setMessage(`${result.error} Do not pay again; retry verification.`)
      return
    }
    if (result.data?.data?.checkout_state) setStatus(result.data.data)
    if (result.data?.data?.payment_status === 'pending') {
      setMessage(result.data.data.status_message || 'Waiting for provider capture. Do not pay again.')
      if (result.data.data.checkout_state === 'retryable') setVerification(null)
      return
    }
    if (result.data?.data) setStatus(result.data.data)
    setVerification(null)
    setMessage(
      result.data?.data?.refund_pending
        ? 'Payment received; a refund is pending. Contact support for its progress.'
        : 'Payment verified.',
    )
  }

  async function pay() {
    if (opening.current || busy || !connected) return
    opening.current = true
    requestSequence.current += 1
    const version = generation.current
    setBusy(true)
    setMessage('Preparing secure checkout…')
    try {
      await loadRazorpayCheckout()
      const result = await apiRequest<{ data: Order }>(`${path}/order`, { method: 'POST', body: '{}' })
      if (version !== generation.current) return
      const order = result.data?.data
      if (result.error || !order || !window.Razorpay) throw new Error(result.error || 'Checkout could not be opened.')
      const checkout = new window.Razorpay({
        key: order.key,
        order_id: order.order_id,
        amount: order.amount_minor,
        currency: order.currency,
        name: 'Turiya Mobility',
        description: 'Booking payment',
        handler: (payment) => {
          if (version === generation.current) {
            setVerification(payment)
            void verify(payment, version)
          }
        },
        modal: {
          ondismiss: () => {
            if (version === generation.current) {
              opening.current = false
              setBusy(false)
              setMessage('Checkout closed. Your booking status will refresh automatically.')
            }
          },
        },
      })
      checkout.on('payment.failed', (error) => {
        if (version === generation.current) {
          opening.current = false
          setBusy(false)
          setMessage(error.error?.description || 'Payment was not completed. Your payment status will refresh automatically.')
        }
      })
      checkout.open()
    } catch (error) {
      if (version === generation.current) {
        opening.current = false
        setBusy(false)
        setMessage(error instanceof Error ? error.message : 'Checkout is unavailable. Please retry later.')
      }
    }
  }

  if (!status || status.checkout_state === 'unavailable') return null

  const payableFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: status.currency,
  }).format(status.amount_minor / 100)

  return (
    <div
      className="rounded-xl border border-[#dbe1dc] bg-white p-5 shadow-xs"
      aria-label="Booking payment"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f3f1] pb-3 mb-4">
        <h3 className="text-base font-bold text-[#13231f]">Payment Information</h3>
        <PaymentStatus status={status.payment_status} refundPending={status.refund_pending} />
      </div>

      <p className="text-sm text-[#5b6964] mb-4" role="status">
        {status.status_message}
      </p>

      {status.tour_payment && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-[#f0f3f1] bg-[#fafbf8] p-3.5 mb-4 text-xs">
          <div>
            <dt className="text-[#5b6964]">Total trip</dt>
            <dd className="font-bold text-sm text-[#13231f]">
              ₹{(status.tour_payment.total_minor / 100).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-[#5b6964]">Online paid</dt>
            <dd className="font-bold text-sm text-[#137333]">
              ₹{(status.tour_payment.online_paid_minor / 100).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-[#5b6964]">Cash due at tour start</dt>
            <dd className="font-bold text-sm text-[#13231f]">
              ₹{(status.tour_payment.remaining_cash_minor / 100).toFixed(2)}
            </dd>
          </div>
          {status.tour_payment.refunded_minor > 0 && (
            <div>
              <dt className="text-[#5b6964]">Refunded</dt>
              <dd className="font-bold text-sm text-[#b42318]">
                ₹{(status.tour_payment.refunded_minor / 100).toFixed(2)}
              </dd>
            </div>
          )}
          {status.tour_payment.refund_pending_minor > 0 && (
            <div>
              <dt className="text-[#5b6964]">Refund pending</dt>
              <dd className="font-bold text-sm text-[#d97706]">
                ₹{(status.tour_payment.refund_pending_minor / 100).toFixed(2)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {status.can_pay && (
        <div className="mb-4 flex items-baseline justify-between rounded-lg bg-[#f2faf7] p-3 text-sm">
          <span className="font-semibold text-[#0d7769]">Payable online:</span>
          <span className="text-lg font-bold text-[#0d7769]">{payableFormatted}</span>
        </div>
      )}

      {!connected && (
        <p className="mb-3 text-xs text-[#b45309]" role="status">
          Payment status could not be refreshed. Check your connection before paying again.
        </p>
      )}

      {verification && ['ready', 'retryable', 'awaiting_capture'].includes(status.checkout_state) ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={busy}
          loading={busy}
          onClick={() => {
            setBusy(true)
            void verify(verification, generation.current)
          }}
        >
          Retry payment verification
        </Button>
      ) : status.can_pay ? (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={busy || !connected}
          loading={busy}
          onClick={() => void pay()}
        >
          Pay online ({payableFormatted})
        </Button>
      ) : null}

      {message && (
        <p className="mt-3 text-xs text-[#5b6964]" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
