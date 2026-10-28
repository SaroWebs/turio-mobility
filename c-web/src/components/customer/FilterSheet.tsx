import { type ReactNode, useEffect } from 'react'
import { Button } from './Button'
import { Icon } from '../Icon'

export interface FilterSheetProps {
  isOpen: boolean
  onClose: () => void
  onApply: () => void
  onClear: () => void
  children: ReactNode
  totalResults?: number
}

export function FilterSheet({
  isOpen,
  onClose,
  onApply,
  onClear,
  children,
  totalResults,
}: FilterSheetProps) {
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter options"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-[#dbe1dc] bg-white p-6 shadow-xl transition-all"
      >
        <div className="flex items-center justify-between border-b border-[#ece8df] pb-4">
          <h2 className="text-lg font-bold text-[#13231f]">Filter & Refine</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#5b6964] hover:bg-[#f7f8f5] hover:text-[#13231f]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          {children}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#ece8df] pt-4">
          <Button variant="ghost" size="md" onClick={onClear}>
            Clear all
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={onApply}>
              {totalResults !== undefined ? `Show ${totalResults} tours` : 'Apply filters'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FilterToggleButton({
  onClick,
  activeFilterCount = 0,
}: {
  onClick: () => void
  activeFilterCount?: number
}) {
  return (
    <Button
      variant="secondary"
      size="md"
      onClick={onClick}
      icon={<Icon name="filter" />}
      className="gap-2"
    >
      <span>Filters</span>
      {activeFilterCount > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d7769] text-xs font-semibold text-white">
          {activeFilterCount}
        </span>
      )}
    </Button>
  )
}
