import { Icon } from '../Icon'

export function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="col-span-full mb-6 flex flex-col items-start gap-3 rounded-2xl border border-[#ded8ca] bg-white p-4 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-[#0f766e]">
      <Icon name="map" />
      <h2>{title}</h2>
      <p className="m-0 leading-[1.55] text-[#5f6b64]">{text}</p>
      <button className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full border border-[#ded8ca] bg-white px-[18px] py-3 font-extrabold text-[#17211d] transition hover:-translate-y-px" onClick={onAction} type="button">
        {actionLabel}
      </button>
    </div>
  )
}
