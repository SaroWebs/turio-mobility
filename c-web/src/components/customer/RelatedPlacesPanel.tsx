import { Link } from 'react-router-dom'
import type { Destination, Tour } from '../../utils/data'

export function RelatedPlacesPanel({ places }: { places: Destination[]; tour: Tour }) {
  const displayPlaces = places

  return (
    <section className="mt-[18px] rounded-2xl border border-[#ded8ca] bg-white p-[22px]">
      <h2>Destinations and places covered</h2>
      {displayPlaces.length ? (
        <div className="grid gap-3.5">
          {displayPlaces.map((place) => (
            <Link className="grid min-h-[104px] grid-cols-[104px_minmax(0,1fr)] items-center gap-3.5 overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fdfbf6] max-[700px]:grid-cols-[92px_minmax(0,1fr)]" key={place.id} to={`/destinations/${place.id}`}>
              {place.image ? (
                <img alt={`${place.name} place`} className="aspect-square h-full w-[104px] object-cover max-[700px]:w-[92px]" loading="lazy" src={place.image} />
              ) : (
                <span aria-label={`${place.name} image unavailable`} className="grid aspect-square h-full w-[104px] place-items-center bg-[#e9ece7] px-2 text-center text-xs font-bold text-[#65716a] max-[700px]:w-[92px]" role="img">
                  Image coming soon
                </span>
              )}
              <span className="grid gap-1 px-3.5 py-3 pl-0">
                <strong>{place.name}</strong>
                <small className="leading-[1.45] text-[#5f6b64]">{place.region}</small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="helper-text">This tour does not have mapped place details yet. Itinerary descriptions are shown above.</p>
      )}
    </section>
  )
}
