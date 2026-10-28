import { createContext, useContext } from 'react'

export type CustomerAuthContextValue = {
  token: string | null
  isAuthenticated: boolean
  authModalOpen: boolean
  authRedirectTo: string
  login: (token: string) => void
  logout: () => void
  openAuthModal: (redirectTo?: string) => void
  closeAuthModal: () => void
}

export const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null)

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext)

  if (!context) {
    throw new Error('useCustomerAuth must be used inside CustomerAuthProvider')
  }

  return context
}
