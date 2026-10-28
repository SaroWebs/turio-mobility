export interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Primitive skeleton block with pulse animation
 */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[#e4e7e3] ${className}`}
      style={style}
    />
  )
}

/**
 * Card skeleton matching TourCard layout (12px radius, 16:10 image, metadata, price, button)
 */
export function TourCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col overflow-hidden rounded-xl border border-[#dbe1dc] bg-white shadow-xs ${className}`}
    >
      {/* Media placeholder */}
      <div className="relative aspect-[16/10] w-full bg-[#e8eae6] animate-pulse">
        <div className="absolute top-3 left-3 h-5 w-16 rounded-md bg-[#d8dcd7]" />
        <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-[#d8dcd7]" />
      </div>

      {/* Content block */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="space-y-3">
          {/* Subtitle / destination */}
          <div className="h-3 w-28 rounded-sm bg-[#e8eae6] animate-pulse" />

          {/* Title (2 lines) */}
          <div className="space-y-1.5">
            <div className="h-4.5 w-5/6 rounded-sm bg-[#e8eae6] animate-pulse" />
            <div className="h-4.5 w-3/5 rounded-sm bg-[#e8eae6] animate-pulse" />
          </div>

          {/* Departure & seats left */}
          <div className="h-3 w-40 rounded-sm bg-[#e8eae6] animate-pulse" />

          {/* Rating stars & reviews */}
          <div className="flex items-center gap-2 pt-1">
            <div className="h-3.5 w-20 rounded-sm bg-[#e8eae6] animate-pulse" />
            <div className="h-3 w-12 rounded-sm bg-[#e8eae6] animate-pulse" />
          </div>
        </div>

        {/* Footer: Price & Button */}
        <div className="mt-5 flex items-end justify-between border-t border-[#f0f3f1] pt-4">
          <div className="space-y-1">
            <div className="h-2.5 w-12 rounded-sm bg-[#e8eae6] animate-pulse" />
            <div className="h-5 w-24 rounded-sm bg-[#e8eae6] animate-pulse" />
          </div>
          <div className="h-10 w-28 rounded-lg bg-[#e8eae6] animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/**
 * Card skeleton matching RentalCard layout (image, driver badge, specs, price, button)
 */
export function RentalCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col overflow-hidden rounded-xl border border-[#dbe1dc] bg-white shadow-xs ${className}`}
    >
      {/* Media placeholder */}
      <div className="relative aspect-[16/10] w-full bg-[#e8eae6] animate-pulse">
        <div className="absolute top-3 left-3 h-5 w-28 rounded-md bg-[#d8dcd7]" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="space-y-3">
          <div className="h-3 w-20 rounded-sm bg-[#e8eae6] animate-pulse" />
          <div className="h-5 w-3/4 rounded-sm bg-[#e8eae6] animate-pulse" />

          {/* Specs tags */}
          <div className="flex items-center gap-2 pt-1">
            <div className="h-6 w-14 rounded-md bg-[#e8eae6] animate-pulse" />
            <div className="h-6 w-16 rounded-md bg-[#e8eae6] animate-pulse" />
            <div className="h-6 w-14 rounded-md bg-[#e8eae6] animate-pulse" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-end justify-between border-t border-[#f0f3f1] pt-4">
          <div className="space-y-1">
            <div className="h-2.5 w-14 rounded-sm bg-[#e8eae6] animate-pulse" />
            <div className="h-5 w-24 rounded-sm bg-[#e8eae6] animate-pulse" />
          </div>
          <div className="h-10 w-24 rounded-lg bg-[#e8eae6] animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/**
 * Card skeleton matching DestinationCard layout
 */
export function DestinationCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`group flex flex-col overflow-hidden rounded-xl border border-[#dbe1dc] bg-white shadow-xs ${className}`}
    >
      <div className="relative aspect-[16/10] w-full bg-[#e8eae6] animate-pulse">
        <div className="absolute top-3 left-3 h-5 w-20 rounded-md bg-[#d8dcd7]" />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-5 w-2/3 rounded-sm bg-[#e8eae6] animate-pulse" />
        <div className="h-3 w-1/3 rounded-sm bg-[#e8eae6] animate-pulse" />
      </div>
    </div>
  )
}

/**
 * Full-page detail skeleton matching TourDetailPage and RentalDetailPage layout
 */
export function DetailPageSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {/* Breadcrumb line */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-12 rounded bg-[#e8eae6]" />
        <span className="text-[#dbe1dc]">/</span>
        <div className="h-3 w-16 rounded bg-[#e8eae6]" />
        <span className="text-[#dbe1dc]">/</span>
        <div className="h-3 w-32 rounded bg-[#e8eae6]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
        {/* Left Column */}
        <div className="min-w-0 space-y-6">
          {/* Main Hero Gallery placeholder */}
          <div className="aspect-[16/10] sm:aspect-[16/9] w-full rounded-xl bg-[#e8eae6]" />

          {/* Heading Block */}
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-[#e8eae6]" />
            <div className="h-8 w-3/4 rounded bg-[#e8eae6]" />
          </div>

          {/* Specs / Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border border-[#dbe1dc] bg-white p-3.5 space-y-2">
                <div className="h-2.5 w-16 rounded bg-[#e8eae6]" />
                <div className="h-4 w-24 rounded bg-[#e8eae6]" />
              </div>
            ))}
          </div>

          {/* Body Paragraphs */}
          <div className="rounded-xl border border-[#dbe1dc] bg-white p-6 space-y-3">
            <div className="h-5 w-40 rounded bg-[#e8eae6]" />
            <div className="h-3.5 w-full rounded bg-[#e8eae6]" />
            <div className="h-3.5 w-5/6 rounded bg-[#e8eae6]" />
            <div className="h-3.5 w-4/6 rounded bg-[#e8eae6]" />
          </div>
        </div>

        {/* Right Sticky Column */}
        <aside className="rounded-xl border border-[#dbe1dc] bg-white p-6 space-y-5">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-[#e8eae6]" />
            <div className="h-8 w-32 rounded bg-[#e8eae6]" />
            <div className="h-3 w-40 rounded bg-[#e8eae6]" />
          </div>

          <div className="h-12 w-full rounded-lg bg-[#e8eae6]" />

          <div className="space-y-2 pt-2 border-t border-[#f0f3f1]">
            <div className="h-3 w-full rounded bg-[#e8eae6]" />
            <div className="h-3 w-4/5 rounded bg-[#e8eae6]" />
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * Skeleton for booking history rows in BookingsPage and DashboardPage
 */
export function BookingRowSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-xl border border-[#dbe1dc] bg-white p-5 shadow-xs animate-pulse ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* Service Icon Box */}
        <div className="h-11 w-11 shrink-0 rounded-lg bg-[#e8eae6]" />
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-16 rounded bg-[#e8eae6]" />
            <div className="h-3 w-24 rounded bg-[#e8eae6]" />
          </div>
          <div className="h-4.5 w-48 rounded bg-[#e8eae6]" />
          <div className="h-3 w-32 rounded bg-[#e8eae6]" />
        </div>
      </div>

      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 border-t sm:border-t-0 border-[#f0f3f1] pt-3 sm:pt-0">
        <div className="flex items-center gap-2">
          <div className="h-5 w-20 rounded-full bg-[#e8eae6]" />
          <div className="h-5 w-16 rounded-full bg-[#e8eae6]" />
        </div>
        <div className="h-5 w-24 rounded bg-[#e8eae6]" />
      </div>
    </div>
  )
}

/**
 * Metric tile skeleton for Dashboard
 */
export function MetricSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-[#dbe1dc] bg-white p-5 shadow-xs animate-pulse flex items-center gap-4">
      <div className="h-11 w-11 rounded-lg bg-[#e8eae6] shrink-0" />
      <div className="space-y-2 flex-1">
        <div className="h-3 w-24 rounded bg-[#e8eae6]" />
        <div className="h-6 w-16 rounded bg-[#e8eae6]" />
      </div>
    </div>
  )
}

/**
 * Transaction row skeleton for Wallet
 */
export function TransactionRowSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center justify-between p-3.5 border-b border-[#f0f3f1] animate-pulse">
      <div className="space-y-1.5 flex-1">
        <div className="h-4 w-44 rounded bg-[#e8eae6]" />
        <div className="h-3 w-28 rounded bg-[#e8eae6]" />
      </div>
      <div className="h-5 w-20 rounded bg-[#e8eae6]" />
    </div>
  )
}
