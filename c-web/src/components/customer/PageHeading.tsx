import { type ReactNode } from 'react'

export interface PageHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  compact?: boolean
  className?: string
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
  className = '',
}: PageHeadingProps) {
  return (
    <div
      className={`flex flex-col gap-3 md:flex-row md:items-end md:justify-between ${
        compact ? 'mb-6' : 'mb-8 md:mb-10'
      } ${className}`}
    >
      <div className="max-w-[760px]">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a4f16]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-[#13231f] sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {description && (
          <div className="mt-2 text-sm leading-relaxed text-[#5b6964] sm:text-base">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3 pt-2 md:pt-0">
          {actions}
        </div>
      )}
    </div>
  )
}
