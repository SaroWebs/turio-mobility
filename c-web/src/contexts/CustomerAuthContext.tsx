import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/api'
import { CustomerAuthContext, type CustomerAuthContextValue } from './customerAuth'

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => getAuthToken())
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authRedirectTo, setAuthRedirectTo] = useState('/dashboard')

  useEffect(() => {
    function syncFromStorage() {
      setToken(getAuthToken())
    }

    window.addEventListener('storage', syncFromStorage)

    return () => window.removeEventListener('storage', syncFromStorage)
  }, [])

  const value = useMemo<CustomerAuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      authModalOpen,
      authRedirectTo,
      login(nextToken) {
        setAuthToken(nextToken)
        setToken(nextToken)
        setAuthModalOpen(false)
      },
      logout() {
        clearAuthToken()
        setToken(null)
      },
      openAuthModal(nextRedirectTo = '/dashboard') {
        setAuthRedirectTo(nextRedirectTo)
        setAuthModalOpen(true)
      },
      closeAuthModal() {
        setAuthModalOpen(false)
      },
    }),
    [authModalOpen, authRedirectTo, token],
  )

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
}
