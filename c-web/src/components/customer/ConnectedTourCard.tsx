import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/data'
import { type Tour } from '../../utils/data'

export function ConnectedTourCard({ tour, destinationName }: { tour: Tour; destinationName: string }) {
  const matchingStops = tour.itineraryStops.filter((stop) => stop.title.toLowerCase().includes(destinationName.toLowerCase()))

  return (
    <Link className="grid min-h-[104px] grid-cols-[136px_minmax(0,1fr)] items-center gap-3.5 overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fdfbf6] max-[700px]:grid-cols-[92px_minmax(0,1fr)]" to={`/tours/${tour.id}`}>
      {tour.image ? (
        <img alt={`${tour.title} tour`} className="aspect-square h-full w-[136px] object-cover max-[700px]:w-[92px]" loading="lazy" src={tour.image} />
      ) : (
        <span aria-label={`${tour.title} image unavailable`} className="grid aspect-square h-full w-[136px] place-items-center bg-[#e9ece7] px-2 text-center text-xs font-bold text-[#65716a] max-[700px]:w-[92px]" role="img">
          Image coming soon
        </span>
      )}
      <span className="grid gap-1 px-3.5 py-3 pl-0">
        <strong>{tour.title}</strong>
        <small className="leading-[1.45] text-[#5f6b64]">
          {tour.nextSchedule} - {formatCurrency(tour.price)} - {matchingStops.length || tour.itineraryStops.length} itinerary stops
        </small>
      </span>
    </Link>
  )
}
