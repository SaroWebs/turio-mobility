export interface PaymentStatusProps {
  status: string
  refundPending?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function PaymentStatus({
  status,
  refundPending = false,
  className = '',
  size = 'md',
}: PaymentStatusProps) {
  const normalized = (status || '').toLowerCase().replace(/[\s_-]+/g, '')

  let colorClasses: string
  let label: string

  if (refundPending) {
    colorClasses = 'bg-[#fef6e7] text-[#b45309] border-[#fcd38d]'
    label = 'Refund in progress'
  } else if (normalized.includes('paid') || normalized.includes('complete') || normalized.includes('success')) {
    colorClasses = 'bg-[#e7f7ed] text-[#137333] border-[#b8e4c7]'
    label = 'Paid'
  } else if (normalized.includes('partial') || normalized.includes('deposit')) {
    colorClasses = 'bg-[#e4f3ef] text-[#0d7769] border-[#b2e1d5]'
    label = 'Deposit paid'
  } else if (normalized.includes('refund')) {
    colorClasses = 'bg-[#f0f2ee] text-[#5b6964] border-[#dbe1dc]'
    label = 'Refunded'
  } else if (normalized.includes('fail')) {
    colorClasses = 'bg-[#fdeeed] text-[#b42318] border-[#f8c4c0]'
    label = 'Payment failed'
  } else if (normalized.includes('cash')) {
    colorClasses = 'bg-[#fef6e7] text-[#b45309] border-[#fcd38d]'
    label = 'Cash on trip'
  } else {
    colorClasses = 'bg-[#fef6e7] text-[#b45309] border-[#fcd38d]'
    label = status || 'Payment pending'
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${sizeClasses} ${colorClasses} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
