import { formatCurrency, type TourSchedule } from '../../utils/data'

export function SchedulePanel({
  schedules,
  tourType = 'planned',
}: {
  schedules: TourSchedule[]
  tourType?: 'planned' | 'private'
}) {
  if (tourType === 'private') {
    return (
      <section className="mt-6 rounded-xl border border-[#d8f3eb] bg-[#f2faf7] p-6 shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0d7769]">
          Flexible private package
        </span>
        <h2 className="mb-2 mt-2 text-xl font-bold text-[#13231f]">
          Travel when it works for you
        </h2>
        <p className="m-0 max-w-2xl text-sm leading-relaxed text-[#5b6964]">
          Choose a preferred start date at booking. The operations team confirms the vehicle, stays, and route for your family or private group.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
      <h2 className="text-xl font-bold text-[#13231f] mb-4">Upcoming Departures</h2>
      {schedules.length === 0 ? (
        <p className="text-sm text-[#5b6964]">New departure dates will be announced shortly.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="rounded-lg border border-[#dbe1dc] bg-[#fafbf8] p-4 transition-all hover:border-[#b2d5cc]"
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#9a4f16] uppercase tracking-wide">
                  {schedule.status}
                </span>
                <span
                  className={
                    schedule.seatsLeft > 0
                      ? 'text-[#0d7769]'
                      : 'text-[#b42318]'
                  }
                >
                  {schedule.seatsLeft > 0
                    ? `${schedule.seatsLeft} seats left`
                    : 'Sold out'}
                </span>
              </div>
              <strong className="my-2 block text-base font-bold text-[#13231f]">
                {schedule.label}
              </strong>
              <p className="m-0 text-sm font-semibold text-[#0d7769]">
                {formatCurrency(schedule.price)}
                <span className="text-xs font-normal text-[#5b6964]"> / person</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
