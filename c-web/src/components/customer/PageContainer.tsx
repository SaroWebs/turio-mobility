import { type ReactNode } from 'react'

export interface PageContainerProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'main'
  size?: 'default' | 'narrow' | 'wide'
}

export function PageContainer({
  children,
  className = '',
  as: Component = 'div',
  size = 'default',
}: PageContainerProps) {
  const maxWidthClass =
    size === 'narrow'
      ? 'max-w-[760px]'
      : size === 'wide'
        ? 'max-w-[1320px]'
        : 'max-w-[1200px]'

  return (
    <Component
      className={`mx-auto w-full ${maxWidthClass} px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </Component>
  )
}
