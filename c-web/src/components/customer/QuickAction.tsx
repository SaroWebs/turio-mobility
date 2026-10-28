import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../Icon'
import { useCustomerAuth } from '../../contexts/customerAuth'

export function QuickAction({ icon, label, requireAuth = false, text, to }: { icon: IconName; label: string; requireAuth?: boolean; text: string; to: string }) {
  const { isAuthenticated, openAuthModal } = useCustomerAuth()
  const quickActionClass = 'flex min-h-[72px] items-start gap-2.5 bg-white/10 rounded px-5 py-3.5 text-left [&_svg]:mt-0.5 [&_svg]:text-[#0f766e] [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:leading-[1.45] [&_small]:text-gray-100 [&_strong]:block'
  const content = (
    <>
      <Icon name={icon} />
      <span>
        <strong>{label}</strong>
        <small>{text}</small>
      </span>
    </>
  )

  if (requireAuth && !isAuthenticated) {
    return (
      <button className={`${quickActionClass} cursor-pointer border-0 font-[inherit]`} onClick={() => openAuthModal(to)} type="button">
        {content}
      </button>
    )
  }

  return (
    <Link className={quickActionClass} to={to}>
      {content}
    </Link>
  )
}
