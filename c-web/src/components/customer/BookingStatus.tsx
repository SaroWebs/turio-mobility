export interface BookingStatusProps {
  status: string
  className?: string
  size?: 'sm' | 'md'
}

export function BookingStatus({
  status,
  className = '',
  size = 'md',
}: BookingStatusProps) {
  const normalized = (status || '').toLowerCase().replace(/[\s_-]+/g, '')

  let colorClasses = 'bg-[#f0f2ee] text-[#5b6964] border-[#dbe1dc]'
  let label = status || 'Pending'

  if (normalized.includes('confirm') || normalized === 'active' || normalized === 'completed') {
    colorClasses = 'bg-[#e7f7ed] text-[#137333] border-[#b8e4c7]'
    label = normalized.includes('confirm') ? 'Booking confirmed' : label
  } else if (normalized.includes('cancel')) {
    colorClasses = 'bg-[#fdeeed] text-[#b42318] border-[#f8c4c0]'
    label = 'Cancelled'
  } else if (normalized.includes('progress') || normalized.includes('assigned') || normalized.includes('transit')) {
    colorClasses = 'bg-[#e4f3ef] text-[#0d7769] border-[#b2e1d5]'
  } else if (normalized.includes('wait') || normalized.includes('hold') || normalized.includes('search')) {
    colorClasses = 'bg-[#fef6e7] text-[#b45309] border-[#fcd38d]'
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
