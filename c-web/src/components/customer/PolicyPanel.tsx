import { Icon } from '../Icon'

export function PolicyPanel({ text }: { text: string }) {
  return (
    <div className="mt-[18px] flex items-start gap-3.5 rounded-2xl border border-[#ded8ca] bg-white p-[22px] [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-[#0f766e]">
      <Icon name="shield" />
      <div>
        <h3>Policy and protection</h3>
        <p className="leading-[1.6] text-[#5f6b64]">{text}</p>
      </div>
    </div>
  )
}
