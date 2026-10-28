import { type ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from '../Icon'

export interface StatePanelProps {
  type?: 'loading' | 'empty' | 'error' | 'offline' | 'success'
  title: string
  description?: ReactNode
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function StatePanel({
  type = 'empty',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}: StatePanelProps) {
  const iconName =
    type === 'loading'
      ? 'compass'
      : type === 'error'
        ? 'info'
        : type === 'offline'
          ? 'info'
          : type === 'success'
            ? 'check'
            : 'search'

  const iconBg =
    type === 'error'
      ? 'bg-[#fdeeed] text-[#b42318]'
      : type === 'offline'
        ? 'bg-[#fef6e7] text-[#b45309]'
        : type === 'success'
          ? 'bg-[#e7f7ed] text-[#137333]'
          : 'bg-[#e4f3ef] text-[#0d7769]'

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`flex flex-col items-center justify-center rounded-2xl border border-[#dbe1dc] bg-white p-8 text-center sm:p-12 shadow-xs ${className}`}
    >
      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${iconBg} ${
          type === 'loading' ? 'animate-spin' : ''
        }`}
      >
        <Icon name={iconName} />
      </div>

      <h3 className="text-xl font-bold text-[#13231f]">{title}</h3>

      {description && (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-[#5b6964]">
          {description}
        </div>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button variant="primary" size="md" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="secondary" size="md" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
