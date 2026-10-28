import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../Icon'
import { formatCurrency, type Tour } from '../../utils/data'
import { WishlistButton } from './WishlistButton'

function readableDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
}

export function TourCard({ tour }: { tour: Tour }) {
  const location = useLocation()
  const detailUrl = `/tours/${tour.id}${location.search}`
  const hasDiscount = Boolean(tour.originalPrice && tour.originalPrice > tour.price)
  const lowSeats = tour.seatsLeft > 0 && tour.seatsLeft <= 5
  const isPlanned = tour.tourType === 'planned'
  const hasRating = typeof tour.rating === 'number' && tour.rating > 0
  const departureDate = readableDate(tour.nextSchedule)
  const discountPercent = hasDiscount
    ? Math.round((1 - tour.price / (tour.originalPrice ?? tour.price)) * 100)
    : 0

  const galleryImages = tour.gallery?.filter((g) => g.url).map((g) => g.url) ?? []
  const [hoverImageIdx, setHoverImageIdx] = useState(0)

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-[#dbe1dc] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b2d5cc] hover:shadow-md">
      {/* Media & Badges */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#eeebe2]">
        <Link
          aria-label={`View ${tour.title}`}
          className="block h-full w-full"
          to={detailUrl}
          onMouseEnter={() => {
            if (galleryImages.length > 1) setHoverImageIdx(1)
          }}
          onMouseLeave={() => setHoverImageIdx(0)}
        >
          {tour.image ? (
            <>
              <img
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                src={hoverImageIdx === 1 && galleryImages[1] ? galleryImages[1] : tour.image}
              />
              {/* Quick view overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-xs">
                  Quick view
                </span>
              </div>
            </>
          ) : (
            <div
              aria-label={`${tour.title} image unavailable`}
              className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-xs text-[#5b6964]"
              role="img"
            >
              <Icon name="compass" />
              <span className="mt-1 font-medium">Tour photography coming soon</span>
            </div>
          )}
        </Link>

        {/* Top Badges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#0d7769] shadow-xs backdrop-blur-xs">
              {isPlanned ? 'Scheduled departure' : 'Private tour'}
            </span>
            {hasDiscount && discountPercent > 0 && (
              <span className="rounded-md bg-[#9a4f16] px-2.5 py-1 text-xs font-semibold text-white shadow-xs">
                SAVE {discountPercent}%
              </span>
            )}
          </div>

          {isPlanned && tour.seatsLeft > 0 && (
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold shadow-xs backdrop-blur-xs ${
                lowSeats
                  ? 'bg-[#fef6e7] text-[#b45309]'
                  : 'bg-[#13231f]/80 text-white'
              }`}
            >
              {lowSeats ? `Only ${tour.seatsLeft} seats left` : `${tour.seatsLeft} seats left`}
            </span>
          )}
          {isPlanned && tour.seatsLeft === 0 && (
            <span className="rounded-md bg-[#fdeeed] px-2.5 py-1 text-xs font-semibold text-[#b42318] shadow-xs">
              Sold out
            </span>
          )}
        </div>

        {/* Wishlist Button floating top-right (below badge if any, or accessible) */}
        <div className="absolute right-3 bottom-3 z-10">
          <WishlistButton
            id={tour.id}
            title={tour.title}
            image={tour.image}
            duration={tour.duration}
            price={tour.price}
            serviceType="tour"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Meta Row: Duration, Nights, Destination, Rating (only if > 0) */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5b6964]">
          <span className="inline-flex items-center gap-1 font-medium">
            <Icon name="clock" />
            {tour.duration}
          </span>
          {tour.nights && (
            <span className="rounded bg-[#e4f3ef] px-1.5 py-0.5 font-medium text-[#0d7769]">
              {tour.nights} nights
            </span>
          )}
          <span aria-hidden="true" className="text-[#dbe1dc]">·</span>
          <span className="truncate font-medium">{tour.destination}</span>
          {hasRating && (
            <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[#9a4f16]">
              <Icon name="star" />
              {tour.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Category tag */}
        {tour.category && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-[#f7f8f5] border border-[#dbe1dc] px-2.5 py-0.5 text-xs font-medium text-[#5b6964]">
              {tour.category}
            </span>
          </div>
        )}

        {/* Title */}
        <h2 className="mt-2.5 mb-0 text-lg font-bold leading-snug tracking-tight text-[#13231f]">
          <Link
            className="hover:text-[#0d7769] transition-colors focus-visible:outline-[#0d7769]"
            to={detailUrl}
          >
            {tour.title}
          </Link>
        </h2>

        {/* Brief summary / highlights */}
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-[#5b6964]">
          {tour.summary || tour.highlights.slice(0, 2).join(' · ')}
        </p>

        {/* Departure info */}
        {isPlanned && departureDate && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#5b6964]">
            <span className="font-medium text-[#13231f]">Next departure:</span>
            <span>{departureDate}</span>
          </div>
        )}

        {/* Pricing & CTA */}
        <div className="mt-auto border-t border-[#f0f3f1] pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              {hasDiscount && (
                <span className="block text-xs text-[#8a9893] line-through">
                  {formatCurrency(tour.originalPrice ?? tour.price)}
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[#0d7769]">
                  {formatCurrency(tour.price)}
                </span>
                <span className="text-xs text-[#5b6964]">
                  {isPlanned ? '/ person' : 'from'}
                </span>
              </div>
            </div>

            <Link
              to={detailUrl}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#0d7769] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0a5d54] focus-visible:outline-3 focus-visible:outline-[#0d7769]"
            >
              <span>View tour</span>
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
