import { Link } from 'react-router-dom'
import { useCustomerAuth } from '../../contexts/customerAuth'

export function AuthActionLink({ children, className, to }: { children: React.ReactNode; className: string; to: string }) {
  const { isAuthenticated, openAuthModal } = useCustomerAuth()

  if (isAuthenticated) {
    return (
      <Link className={className} to={to}>
        {children}
      </Link>
    )
  }

  return (
    <button className={`${className} cursor-pointer border-0 bg-transparent p-0 font-[inherit]`} onClick={() => openAuthModal(to)} type="button">
      {children}
    </button>
  )
}
