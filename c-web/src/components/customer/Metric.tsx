import { Icon, type IconName } from '../Icon'

export function Metric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ded8ca] bg-white p-[22px] shadow-[0_12px_32px_rgba(23,33,29,0.1)] [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-[#0f766e]">
      <Icon name={icon} />
      <span className="block text-sm text-[#5f6b64]">{label}</span>
      <strong className="mt-1 block text-[1.6rem]">{value}</strong>
    </div>
  )
}
