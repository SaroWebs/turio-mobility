import { Link } from 'react-router-dom'
import { Icon } from '../Icon'
import { type Destination } from '../../utils/data'
import { WishlistButton } from './WishlistButton'

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <article className="rainbow-border-top group grid overflow-hidden rounded-lg border border-[#e4dfd3] bg-[#faf8f5] shadow-xs transition duration-300 hover:-translate-y-1 hover:border-[#c5dcd5] hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#eeebe2]">
        <img
          alt={`${destination.name} destination`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          loading="lazy"
          src={destination.image}
        />
        <div className="absolute right-2.5 top-2.5 z-10">
          <WishlistButton
            id={destination.id}
            title={destination.name}
            image={destination.image}
            serviceType="destination"
          />
        </div>
      </div>
      <div className="grid p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-[#e4f3ef] px-2 py-0.5 text-[11px] font-normal tracking-wide text-[#0b615a]">
            {destination.region}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-light text-[#8a5a32]">
            <Icon name="star" />
            {destination.rating}
          </span>
        </div>
        <h3 className="my-2 text-base font-medium leading-snug tracking-[-0.015em] text-[#1c2723]">
          {destination.name}
        </h3>
        <p className="min-h-[42px] text-xs font-light leading-relaxed text-[#5f6b64]">
          {destination.summary}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {destination.tags.slice(0, 3).map((tag) => (
            <span
              className="rounded-md border border-[#e4dfd3] bg-[#f2f6f4] px-2 py-0.5 text-[11px] font-light text-[#5f6b64]"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[#eee9df] pt-3">
          <span className="text-xs font-medium text-[#1c2723]">
            {destination.activeTours.length} {destination.activeTours.length === 1 ? 'tour' : 'tours'}
          </span>
          <div className="flex items-center gap-2">
            <Link
              className="inline-flex min-h-8 items-center justify-center rounded-md border border-[#0f766e] px-3 py-1 text-xs font-medium text-[#0f766e] transition hover:bg-[#0f766e] hover:text-white"
              to={`/destinations/${destination.id}`}
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
