import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  to?: string
  href?: string
  fullWidth?: boolean
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconRight,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0d7769] disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

  const sizeClasses = {
    sm: 'min-h-[36px] px-3 py-1.5 text-xs gap-1.5',
    md: 'min-h-[44px] px-4 py-2.5 text-sm gap-2',
    lg: 'min-h-[48px] px-5 py-3 text-base gap-2.5 font-semibold',
  }[size]

  const variantClasses = {
    primary:
      'bg-[#0d7769] text-white hover:bg-[#0a5d54] active:bg-[#084841] border border-transparent shadow-xs',
    secondary:
      'bg-white text-[#13231f] border border-[#dbe1dc] hover:bg-[#f7f8f5] hover:border-[#b4c0ba] active:bg-[#edf0ec]',
    outline:
      'bg-transparent text-[#0d7769] border border-[#0d7769] hover:bg-[#e4f3ef] active:bg-[#c9e8e0]',
    ghost:
      'bg-transparent text-[#5b6964] hover:text-[#13231f] hover:bg-black/5 active:bg-black/10 border border-transparent',
  }[variant]

  const widthClass = fullWidth ? 'w-full' : ''
  const combinedClasses = `${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${className}`

  const content = (
    <>
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </>
  )

  if (to) {
    return (
      <Link className={combinedClasses} to={to}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a className={combinedClasses} href={href}>
        {content}
      </a>
    )
  }

  return (
    <button
      className={combinedClasses}
      disabled={disabled || loading}
      {...rest}
    >
      {content}
    </button>
  )
}
