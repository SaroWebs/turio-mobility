import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../Icon'
import { formatCurrency, type Rental } from '../../utils/data'
import { WishlistButton } from './WishlistButton'

export function RentalCard({ rental }: { rental: Rental }) {
  const location = useLocation()
  const hasRating = typeof rental.rating === 'number' && rental.rating > 0

  return (
    <article
      aria-label="Car rental with driver"
      className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-[#dbe1dc] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b2d5cc] hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#eeebe2]">
        <img
          alt={`${rental.name} rental vehicle`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          src={rental.image}
        />
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <span className="rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#0d7769] shadow-xs backdrop-blur-xs">
            {rental.category}
          </span>
          <span className="rounded-md bg-[#e4f3ef] px-2.5 py-1 text-xs font-semibold text-[#0d7769] shadow-xs">
            Driver included
          </span>
        </div>
        <div className="absolute right-3 bottom-3 z-10">
          <WishlistButton
            id={rental.id}
            title={rental.name}
            image={rental.image}
            price={rental.pricePerDay}
            serviceType="rental"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2 text-xs text-[#5b6964]">
          <span className="font-semibold text-[#0d7769]">Driver included with every car</span>
          {hasRating && (
            <span className="inline-flex items-center gap-1 font-semibold text-[#9a4f16]">
              <Icon name="star" />
              {rental.rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="mt-2 text-lg font-bold leading-snug tracking-tight text-[#13231f]">
          {rental.name}
        </h3>

        <p className="mt-1.5 text-xs text-[#5b6964]">
          {rental.availability}
        </p>

        {/* Vehicle specs */}
        <div className="mt-3 flex items-center gap-4 text-xs font-medium text-[#5b6964]">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="user" />
            {rental.seats} seats
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="car" />
            {rental.transmission}
          </span>
        </div>

        {/* Pricing & CTA */}
        <div className="mt-auto border-t border-[#f0f3f1] pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="block text-xs text-[#5b6964]">Daily rate</span>
              <span className="text-xl font-bold text-[#0d7769]">
                {formatCurrency(rental.pricePerDay)}
                <span className="text-xs font-normal text-[#5b6964]">/day</span>
              </span>
            </div>

            <Link
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#0d7769] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0a5d54] focus-visible:outline-3 focus-visible:outline-[#0d7769]"
              to={`/rentals/${rental.id}${location.search}`}
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
