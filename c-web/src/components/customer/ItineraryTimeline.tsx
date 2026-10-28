import { Icon } from '../Icon'
import { type ItineraryStop } from '../../utils/data'
import { MediaGallery } from './MediaGallery'

function DayTerms({ stop }: { stop: ItineraryStop }) {
  if (!stop.inclusions?.length && !stop.exclusions?.length) return null

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {stop.inclusions?.length ? (
        <div className="rounded-2xl bg-[#edf8f5] p-4">
          <h4 className="mb-3 mt-0 text-xs uppercase tracking-[0.1em] text-[#0b615a]">Included this day</h4>
          <ul className="m-0 grid list-none gap-2 p-0 text-sm leading-6 text-[#3f5048]">
            {stop.inclusions.map((item) => <li className="flex gap-2" key={item}><span className="mt-0.5 text-[#0f766e]"><Icon name="check" /></span><span>{item}</span></li>)}
          </ul>
        </div>
      ) : null}
      {stop.exclusions?.length ? (
        <div className="rounded-2xl bg-[#fff8f1] p-4">
          <h4 className="mb-3 mt-0 text-xs uppercase tracking-[0.1em] text-[#9a4f16]">Not included this day</h4>
          <ul className="m-0 grid list-none gap-2 p-0 text-sm leading-6 text-[#5f4b3d]">
            {stop.exclusions.map((item) => <li className="flex gap-2" key={item}><span className="mt-0.5 text-[#9a4f16]"><Icon name="x" /></span><span>{item}</span></li>)}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function ItineraryTimeline({ stops }: { stops: ItineraryStop[] }) {
  const groupedDays = Object.entries(
    stops.reduce<Record<string, ItineraryStop[]>>((days, stop) => {
      const day = stop.day || 'Day plan'
      days[day] = [...(days[day] ?? []), stop]
      return days
    }, {}),
  ).map(([day, dayStops]) => [
    day,
    [...dayStops].sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0) || (a.startTime ?? '').localeCompare(b.startTime ?? '')),
  ] as const)

  return (
    <section className="mt-[18px] rounded-3xl border border-[#ded8ca] bg-white p-5 sm:p-6">
      <div className="mb-7 max-w-[720px]">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#9a4f16]">Day-by-day route</p>
        <h2 className="m-0 text-[clamp(1.7rem,3vw,2.5rem)] tracking-[-0.04em]">Know every road before you go</h2>
        <p className="mb-0 mt-3 leading-7 text-[#5f6b64]">Drive time, stays, meals, major experiences, and daily costs follow the client brief instead of being hidden in a generic description.</p>
      </div>

      {groupedDays.length ? (
        <div className="grid gap-8">
          {groupedDays.map(([day, dayStops]) => (
            <section aria-labelledby={`itinerary-${day.replace(/\s+/g, '-').toLowerCase()}`} className="border-t border-[#ded8ca] pt-6" key={day}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#0b615a]">{day}</p>
                  <h3 className="m-0 text-[clamp(1.55rem,3vw,2.25rem)] tracking-[-0.035em]" id={`itinerary-${day.replace(/\s+/g, '-').toLowerCase()}`}>{dayStops[0]?.title}</h3>
                </div>
                <span className="rounded-full bg-[#dff2ed] px-3 py-1.5 text-xs font-black uppercase text-[#0b615a]">{dayStops.length} planned visit{dayStops.length === 1 ? '' : 's'}</span>
              </div>

              <div className="grid gap-4">
                {dayStops.map((stop, visitIndex) => (
                  <article className="grid grid-cols-[minmax(0,1fr)_minmax(240px,.45fr)] items-start gap-6 rounded-[24px] bg-[#f8f5ed] p-5 sm:p-6 max-[760px]:grid-cols-1" key={stop.id}>
                    <div>
                      <span className="inline-flex rounded-full bg-[#fff0d8] px-3 py-1.5 text-xs font-black uppercase text-[#9a4f16]">
                        Visit {visitIndex + 1}{stop.startTime ? ` - ${stop.startTime.slice(0, 5)}` : ''}
                      </span>
                      {stop.from || stop.to ? (
                        <div aria-label={`${stop.from} to ${stop.to}`} className="mt-4 flex flex-wrap items-center gap-3">
                          <strong className="text-lg">{stop.from || 'Start'}</strong>
                          <span aria-hidden="true" className="text-[#0f766e]"><Icon name="arrow" /></span>
                          <strong className="text-lg">{stop.to || 'Destination'}</strong>
                        </div>
                      ) : null}
                      <p className="mb-0 mt-3 leading-7 text-[#5f6b64]">{stop.description}</p>

                      {stop.distance || stop.travelTime || stop.accommodation || stop.mealsIncluded?.length ? (
                        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                          {stop.distance ? <div className="rounded-xl border border-[#ded8ca] bg-white p-3"><dt className="text-xs font-black uppercase tracking-[0.08em] text-[#6b756f]">Distance</dt><dd className="m-0 mt-1 font-extrabold text-[#17211d]">{stop.distance}</dd></div> : null}
                          {stop.travelTime ? <div className="rounded-xl border border-[#ded8ca] bg-white p-3"><dt className="text-xs font-black uppercase tracking-[0.08em] text-[#6b756f]">Drive time</dt><dd className="m-0 mt-1 font-extrabold text-[#17211d]">{stop.travelTime}</dd></div> : null}
                          {stop.accommodation ? <div className="rounded-xl border border-[#ded8ca] bg-white p-3"><dt className="text-xs font-black uppercase tracking-[0.08em] text-[#6b756f]">Stay</dt><dd className="m-0 mt-1 font-extrabold text-[#17211d]">{stop.accommodation}</dd></div> : null}
                          {stop.mealsIncluded?.length ? <div className="rounded-xl border border-[#ded8ca] bg-white p-3"><dt className="text-xs font-black uppercase tracking-[0.08em] text-[#6b756f]">Meals</dt><dd className="m-0 mt-1 font-extrabold capitalize text-[#17211d]">{stop.mealsIncluded.join(', ')}</dd></div> : null}
                        </dl>
                      ) : null}

                      {stop.activities?.length ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {stop.activities.map((activity) => <span className="rounded-full bg-[#e1f3ee] px-3 py-1.5 text-sm font-bold text-[#0b615a]" key={activity}>{activity}</span>)}
                        </div>
                      ) : null}

                      {stop.keyStops?.length ? (
                        <div className="mt-6">
                          <h4 className="mb-3 mt-0 text-sm uppercase tracking-[0.08em]">Experience stops</h4>
                          <ul className="m-0 grid list-none gap-3 p-0">
                            {stop.keyStops.map((keyStop) => (
                              <li className="grid grid-cols-[10px_minmax(0,1fr)] gap-3" key={keyStop.name}>
                                <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 rounded-full bg-[#d97706]" />
                                <span><strong className="block">{keyStop.name}</strong>{keyStop.description ? <span className="mt-0.5 block text-sm leading-6 text-[#5f6b64]">{keyStop.description}</span> : null}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : stop.placeName ? <small className="mt-4 inline-block font-black text-[#115e59]">Covers: {stop.placeName}</small> : null}

                      <DayTerms stop={stop} />
                    </div>
                    {stop.media.length ? <div className="[&_figure]:rounded-[20px] [&_img]:aspect-[4/5] [&_section]:mt-0 [&_section]:grid-cols-1"><MediaGallery media={stop.media.slice(0, 1)} title={stop.title} /></div> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#f8f5ed] p-6 text-[#5f6b64]">The detailed day plan is being finalized. Departure and payment remain unavailable until the itinerary is published.</div>
      )}
    </section>
  )
}
