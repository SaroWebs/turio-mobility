import { Icon, type IconName } from '../Icon'

export function TrustItem({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#ded8ca] bg-white p-[22px] shadow-[0_12px_32px_rgba(23,33,29,0.1)] [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-[#0f766e]">
      <Icon name={icon} />
      <h2 className="m-0 mt-4">{title}</h2>
      <p className="leading-relaxed text-[#5f6b64]">{text}</p>
    </div>
  )
}
