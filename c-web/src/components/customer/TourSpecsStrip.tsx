export interface TourSpec {
  icon: string
  label: string
  value: string
}

export function TourSpecsStrip({ specs }: { specs: TourSpec[] }) {
  if (!specs.length) return null

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 mb-6 -mx-1 px-1 scrollbar-hide">
      {specs.map(({ icon, label, value }) => (
        <div
          key={label}
          className="rounded-xl border border-[#dbe1dc] bg-white px-4 py-3 flex flex-col gap-0.5 shrink-0"
        >
          <span className="text-xl mb-1" aria-hidden="true">
            {icon}
          </span>
          <span className="text-xs uppercase tracking-wider text-[#5b6964] font-medium">
            {label}
          </span>
          <strong className="text-sm font-bold text-[#13231f]">{value}</strong>
        </div>
      ))}
    </div>
  )
}
