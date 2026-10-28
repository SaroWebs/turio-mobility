import { formatCurrency } from '../../utils/data'

export interface PriceSummaryProps {
  subtotal: number
  discount?: number
  taxesAndFees?: number
  total: number
  deposit?: number
  depositPercent?: number
  remainingCash?: number
  onlinePaid?: number
  refunded?: number
  refundPending?: number
  className?: string
  paymentNote?: string
}

export function PriceSummary({
  subtotal,
  discount = 0,
  taxesAndFees = 0,
  total,
  deposit,
  depositPercent,
  remainingCash,
  onlinePaid,
  refunded,
  refundPending,
  className = '',
  paymentNote,
}: PriceSummaryProps) {
  const hasDeposit = typeof deposit === 'number' && deposit > 0 && deposit < total

  return (
    <div
      className={`rounded-xl border border-[#dbe1dc] bg-white p-5 shadow-xs ${className}`}
      aria-label="Price summary"
    >
      <h3 className="mb-4 text-base font-bold text-[#13231f]">Payment Summary</h3>

      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between text-[#5b6964]">
          <dt>Trip subtotal</dt>
          <dd className="font-medium text-[#13231f]">{formatCurrency(subtotal)}</dd>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-[#0d7769]">
            <dt>Promotional discount</dt>
            <dd className="font-medium">- {formatCurrency(discount)}</dd>
          </div>
        )}

        {taxesAndFees > 0 && (
          <div className="flex justify-between text-[#5b6964]">
            <dt>Taxes & booking fees</dt>
            <dd className="font-medium text-[#13231f]">{formatCurrency(taxesAndFees)}</dd>
          </div>
        )}

        <div className="flex justify-between border-t border-[#ece8df] pt-3 text-base font-bold text-[#13231f]">
          <dt>Total trip amount</dt>
          <dd className="text-[#0d7769]">{formatCurrency(total)}</dd>
        </div>

        {/* Breakdown of Online vs Cash at Tour Start */}
        {hasDeposit && (
          <div className="mt-3 rounded-lg border border-[#d8f3eb] bg-[#f2faf7] p-3 text-xs space-y-1.5">
            <div className="flex justify-between font-semibold text-[#0d7769]">
              <dt>Online reserve deposit {depositPercent ? `(${depositPercent}%)` : ''}</dt>
              <dd>{formatCurrency(deposit)}</dd>
            </div>
            {remainingCash !== undefined && remainingCash > 0 && (
              <div className="flex justify-between text-[#5b6964]">
                <dt>Cash balance due at tour departure</dt>
                <dd className="font-medium text-[#13231f]">{formatCurrency(remainingCash)}</dd>
              </div>
            )}
          </div>
        )}

        {/* Status in active bookings */}
        {typeof onlinePaid === 'number' && onlinePaid > 0 && (
          <div className="flex justify-between border-t border-[#ece8df] pt-2 text-xs text-[#5b6964]">
            <dt>Online paid</dt>
            <dd className="font-semibold text-[#137333]">{formatCurrency(onlinePaid)}</dd>
          </div>
        )}

        {typeof remainingCash === 'number' && remainingCash > 0 && !hasDeposit && (
          <div className="flex justify-between text-xs text-[#5b6964]">
            <dt>Cash due to driver/operator</dt>
            <dd className="font-medium text-[#13231f]">{formatCurrency(remainingCash)}</dd>
          </div>
        )}

        {typeof refunded === 'number' && refunded > 0 && (
          <div className="flex justify-between text-xs text-[#5b6964]">
            <dt>Refunded</dt>
            <dd className="font-medium text-[#b42318]">{formatCurrency(refunded)}</dd>
          </div>
        )}

        {typeof refundPending === 'number' && refundPending > 0 && (
          <div className="flex justify-between text-xs text-[#d97706]">
            <dt>Refund pending</dt>
            <dd className="font-medium">{formatCurrency(refundPending)}</dd>
          </div>
        )}
      </dl>

      {paymentNote && (
        <p className="mt-3 text-xs leading-relaxed text-[#5b6964] border-t border-[#f0f3f1] pt-2.5">
          {paymentNote}
        </p>
      )}
    </div>
  )
}
