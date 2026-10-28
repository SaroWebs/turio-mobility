import { Link } from 'react-router-dom'
import { Icon } from '../Icon'

export interface SectionHeaderProps {
  kicker?: string
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
  className?: string
}

export function SectionHeader({
  kicker,
  title,
  description,
  actionLabel,
  actionTo,
  className = '',
}: SectionHeaderProps) {
  return (
    <div
      className={`mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div>
        {kicker && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a4f16]">
            {kicker}
          </p>
        )}
        <h2 className="text-xl font-bold tracking-tight text-[#13231f] sm:text-2xl lg:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[#5b6964]">{description}</p>
        )}
      </div>
      {actionLabel && actionTo ? (
        <Link
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#0d7769] hover:text-[#0a5d54] transition-colors"
          to={actionTo}
        >
          <span>{actionLabel}</span>
          <Icon name="arrow" />
        </Link>
      ) : null}
    </div>
  )
}
