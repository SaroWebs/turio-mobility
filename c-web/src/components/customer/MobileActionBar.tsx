import { type ReactNode } from 'react'

export interface MobileActionBarProps {
  label?: ReactNode
  price?: ReactNode
  subtext?: ReactNode
  action: ReactNode
  className?: string
}

export function MobileActionBar({
  label,
  price,
  subtext,
  action,
  className = '',
}: MobileActionBarProps) {
  return (
    <aside
      aria-label="Booking action bar"
      className={`fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-[#dbe1dc] bg-white/98 px-4 py-3 shadow-[0_-4px_16px_rgba(19,35,31,0.08)] backdrop-blur-md pb-[max(12px,env(safe-area-inset-bottom))] md:hidden ${className}`}
    >
      <div className="min-w-0 flex-1">
        {label && <div className="text-xs font-medium text-[#5b6964]">{label}</div>}
        {price && <div className="text-lg font-bold text-[#0d7769] leading-tight">{price}</div>}
        {subtext && <div className="text-[11px] text-[#5b6964] truncate">{subtext}</div>}
      </div>
      <div className="shrink-0">{action}</div>
    </aside>
  )
}
