import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '../contexts/customerAuth'
import { text } from '../utils/customerMappers'
import { Icon } from '../components/Icon'
import { TourSharingPage, SharedTourPage } from '../pages/TourSharingPage'
import { AuthModal } from '../components/auth/AuthModal'
import { RentalCheckoutPage, ReceiptPage, TourCheckoutPage } from '../pages/BookingPages'
import { DashboardPage, BookingsPage, TrackingPage, WalletPage, NotificationsPage, InsurancePage, ReviewsPage, PolicyPage, SupportPage } from '../pages/AccountPages'
import { HomePage, ToursPage, RentalsPage, DestinationsPage, DestinationDetailPage, RentalDetailPage, TourDetailPage } from '../pages/public'
import { RideBookingPage } from '../pages/RideBookingPage'
import { CarpoolPage } from '../pages/CarpoolPage'
import { WishlistPage } from '../pages/WishlistPage'
import { LoyaltyPage } from '../pages/LoyaltyPage'
import { InvitePage } from '../pages/InvitePage'
import { DealsPage } from '../pages/DealsPage'
import { getPublicCms, type CmsPayload } from '../utils/customerApi'
import { ServiceTabs } from '../components/customer/ServiceTabs'
import type { TravelService } from '../components/customer/TravelHero'

const accountLinks = [
  { label: 'Overview', to: '/dashboard', icon: 'home' as const },
  { label: 'Bookings', to: '/bookings', icon: 'ticket' as const },
  { label: 'Saved', to: '/wishlist', icon: 'heart' as const },
  { label: 'Wallet', to: '/wallet', icon: 'wallet' as const },
  { label: 'Notifications', to: '/notifications', icon: 'bell' as const },
  { label: 'Rewards', to: '/loyalty', icon: 'star' as const },
  { label: 'Referrals', to: '/invite', icon: 'gift' as const },
  { label: 'Reviews', to: '/reviews', icon: 'star' as const },
  { label: 'Insurance', to: '/insurance', icon: 'shield' as const },
]

function LegacyRouteRedirect({ to }: { to: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const pathname = location.pathname.replace(/^\/(cabs|places)\//, '')
  const destination = to.endsWith('/') && pathname ? `${to}${pathname}` : to

  return <Navigate replace to={{ pathname: destination, search: params.toString() ? `?${params}` : '', hash: location.hash }} />
}

function serviceDetail(pathname: string): { service: TravelService; parent: string; label: string } | null {
  const segments = pathname.split('/').filter(Boolean)
  const services: Record<string, { service: TravelService; parent: string; label: string }> = {
    tours: { service: 'tours', parent: 'Tours & attractions', label: 'Tour' },
    rentals: { service: 'rentals', parent: 'Car rentals', label: 'Rental' },
    destinations: { service: 'destinations', parent: 'Destinations', label: 'Destination' },
    rides: { service: 'rides', parent: 'Fast rides', label: 'Carpool' },
  }
  const page = services[segments[0]]
  if (!page || segments.length !== 2 || (segments[0] === 'rides' && segments[1] !== 'carpool')) return null
  if (segments[0] === 'rides') return { ...page, label: 'Carpool' }
  const readableId = decodeURIComponent(segments[1]).replace(/[-_]+/g, ' ').trim()
  const detailName = /^\d+$/.test(readableId)
    ? `${page.label} details`
    : readableId.replace(/\b\w/g, (character) => character.toUpperCase())
  return { ...page, label: detailName }
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { isAuthenticated, openAuthModal } = useCustomerAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal(location.pathname)
    }
  }, [isAuthenticated, location.pathname, openAuthModal])

  return isAuthenticated ? children : <Navigate replace to="/" />
}

export function CustomerLayout() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 980px)').matches)
  const [cms, setCms] = useState<CmsPayload>({})
  const location = useLocation()
  const { isAuthenticated, openAuthModal } = useCustomerAuth()
  const cmsText = (page: string, section: string, key: string, fallback: string) => {
    const value = cms[page]?.[section]?.[key]
    return typeof value === 'string' && value.trim() ? value : fallback
  }
  const brandName = cmsText('global', 'brand', 'name', 'Turiya Mobility')
  const brandTagline = cmsText('global', 'brand', 'tagline', 'Tours - Rides - Rentals')
  const footerDescription = cmsText(
    'global',
    'footer',
    'description',
    'Plan, book, follow, and understand every journey in one calm place.',
  )
  const trackingKind = new URLSearchParams(location.search).get('kind')
  const isCheckout = location.pathname.endsWith('/checkout')
  const isLiveTracking =
    /^\/rides\/[^/]+\/live$/.test(location.pathname) ||
    (location.pathname === '/tracking' && ['ride', 'tour', 'rental'].includes(trackingKind ?? ''))
  const isFocusedFlow = isCheckout || isLiveTracking
  const isReceipt = /^\/receipts\/[^/]+$/.test(location.pathname)
  const detail = serviceDetail(location.pathname)
  const isAccountPage = /^\/(dashboard|bookings|wishlist|wallet|notifications|loyalty|invite|reviews|insurance)(\/|$)/.test(location.pathname)
  const serviceFlowBack = (() => {
    const tourMatch = location.pathname.match(/^\/tours\/([^/]+)\/checkout$/)
    const rentalMatch = location.pathname.match(/^\/rentals\/([^/]+)\/checkout$/)
    if (tourMatch) return { to: `/tours/${tourMatch[1]}${location.search}`, label: 'Back to tour' }
    if (rentalMatch) return { to: `/rentals/${rentalMatch[1]}${location.search}`, label: 'Back to rental' }
    if (location.pathname.startsWith('/rides/')) return { to: `/rides${location.search}`, label: 'Back to ride' }
    return { to: `/bookings${location.search}`, label: 'Back to bookings' }
  })()
  const closeMenu = () => {}
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-normal transition-colors ${isActive ? 'hm-nav-active' : 'border-transparent text-[#4f5e58] hover:text-[#2e2a25]'}`
  const navButtonClass = 'inline-flex min-h-11 cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2.5 text-sm font-normal text-[#4f5e58] transition-colors hover:text-[#2e2a25]'

  useEffect(() => {
    const media = window.matchMedia('(max-width: 980px)')
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let active = true

    getPublicCms('customer-web')
      .then((response) => {
        if (active) {
          setCms(response.data?.data ?? {})
        }
      })
      .catch(() => {
        // Keep the packaged copy when the API is temporarily unavailable.
      })

    return () => {
      active = false
    }
  }, [])

  function openAuthFromNav(redirectTo = '/dashboard') {
    closeMenu()
    openAuthModal(redirectTo)
  }

  return (
    <div className={`min-h-dvh ${['/', '/tours', '/destinations', '/rentals', '/cabs', '/rides', '/app'].includes(location.pathname) ? 'tour-landing-shell' : ''} ${isMobile && !isFocusedFlow ? 'pb-[82px]' : ''}`}>
      <header className="customer-header sticky top-0 z-50 flex min-h-[72px] items-center justify-between gap-4 border-b border-[#dbe1dc] bg-white/95 px-4 sm:px-6 lg:px-8 py-3 shadow-[0_2px_12px_rgba(19,35,31,0.04)] backdrop-blur-xl">
        <Link aria-label={`${brandName} home`} className="inline-flex min-h-11 min-w-0 items-center gap-3" to="/">
          <img alt="" className="h-10 w-12 shrink-0 object-contain" src="/brand/turiya-mark.png" />
          <span className="min-w-0">
            <strong className="block truncate text-base font-bold tracking-tight text-[#13231f]">{brandName}</strong>
            <small className="block truncate text-xs text-[#5b6964] max-[640px]:hidden">{brandTagline}</small>
          </span>
        </Link>
        {isFocusedFlow ? (
          <nav aria-label="Service flow navigation" className="flex shrink-0 items-center gap-2">
            <Link className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2 text-sm font-semibold text-[#13231f] hover:bg-[#f7f8f5] transition-colors" to={serviceFlowBack.to}>
              <span>{serviceFlowBack.label}</span>
            </Link>
            <Link className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#5b6964] hover:text-[#13231f] hover:bg-black/5 transition-colors" to="/support">
              <Icon name="help" />
              <span>Help</span>
            </Link>
          </nav>
        ) : isReceipt ? (
          <nav aria-label="Receipt navigation" className="flex shrink-0 items-center gap-1">
            <NavLink className={navLinkClass} to="/bookings">My Bookings</NavLink>
            <NavLink className={navLinkClass} to="/support"><span className="hidden min-[500px]:inline">Help</span><span className="min-[500px]:hidden"><Icon name="help" /></span></NavLink>
          </nav>
        ) : (
          <nav aria-label="Global navigation" className="flex items-center gap-0.5">
            <div className="flex items-center gap-0.5">
              <NavLink className={`${navLinkClass} max-[520px]:px-2`} to="/deals"><span className="hidden max-[520px]:block"><Icon name="tag" /></span><span className="max-[520px]:hidden">Offers</span></NavLink>
              <NavLink className={`${navLinkClass} max-[520px]:px-2`} to="/bookings"><span className="hidden max-[520px]:block"><Icon name="ticket" /></span><span className="max-[520px]:hidden">My Bookings</span></NavLink>
              <NavLink className={`${navLinkClass} max-[520px]:px-2`} to="/support"><span className="hidden max-[520px]:block"><Icon name="help" /></span><span className="max-[520px]:hidden">Help</span></NavLink>
            </div>
            {isAuthenticated ? <AccountMenu onNavigate={closeMenu} /> : (
              <button className={`${navButtonClass} hm-nav-primary`} onClick={() => openAuthFromNav(`${location.pathname}${location.search}`)} type="button">
                Login
              </button>
            )}
          </nav>
        )}
      </header>
      <main className="route-stage" id="main">
        {detail && !isFocusedFlow && (
          <div className="service-navigation-compact">
            <ServiceTabs compact service={detail.service} />
            <nav aria-label="Breadcrumb" className="service-navigation-breadcrumbs">
              <Link to="/">Home</Link>
              <span aria-hidden="true">›</span>
              <Link to={detail.service === 'tours' ? '/tours' : detail.service === 'rentals' ? '/rentals' : detail.service === 'rides' ? '/rides' : '/destinations'}>{detail.parent}</Link>
              <span aria-hidden="true">›</span>
              <span aria-current="page">{detail.label}</span>
            </nav>
          </div>
        )}
        {isAccountPage && (
          <nav aria-label="Account navigation" className="flex gap-1 overflow-x-auto border-b border-[#dbe1dc] bg-white px-4 py-2 sm:px-6 lg:px-8">
            {accountLinks.map((item) => (
              <NavLink
                className={({ isActive }) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-[#e4f3ef] text-[#0d7769]' : 'text-[#5b6964] hover:bg-[#f7f8f5]'}`}
                key={item.to}
                to={item.to}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <Routes>
          <Route element={<SharedTourPage />} path="/shared-tour" />
          <Route element={<ProtectedRoute><TourSharingPage /></ProtectedRoute>} path="/bookings/tours/:id/share" />
          <Route element={<HomePage />} path="/" />
          <Route element={<ToursPage />} path="/tours" />
          <Route element={<TourDetailPage />} path="/tours/:id" />
          <Route element={<LegacyRouteRedirect to="/rentals" />} path="/cabs" />
          <Route element={<LegacyRouteRedirect to="/rentals/" />} path="/cabs/:id" />
          <Route element={<RentalsPage />} path="/rentals" />
          <Route element={<RentalDetailPage />} path="/rentals/:id" />
          <Route element={<DestinationsPage />} path="/destinations" />
          <Route element={<DestinationDetailPage />} path="/destinations/:id" />
          <Route element={<LegacyRouteRedirect to="/destinations/" />} path="/places/:id" />
          <Route
            element={
              <ProtectedRoute>
                <TourCheckoutPage />
              </ProtectedRoute>
            }
            path="/tours/:id/checkout"
          />
          <Route
            element={
              <ProtectedRoute>
                <RentalCheckoutPage />
              </ProtectedRoute>
            }
            path="/rentals/:id/checkout"
          />
          <Route
            element={
              <ProtectedRoute>
                <ReceiptPage />
              </ProtectedRoute>
            }
            path="/receipts/:id"
          />
          <Route element={<AuthRouteTrigger />} path="/auth" />
          <Route
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
            path="/dashboard"
          />
          <Route
            element={
              <ProtectedRoute>
                <BookingsPage />
              </ProtectedRoute>
            }
            path="/bookings"
          />
          <Route
            element={
              <ProtectedRoute>
                <TrackingPage />
              </ProtectedRoute>
            }
            path="/tracking"
          />
          <Route
            element={
              <ProtectedRoute>
                <WalletPage />
              </ProtectedRoute>
            }
            path="/wallet"
          />
          <Route
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
            path="/notifications"
          />
          <Route
            element={
              <ProtectedRoute>
                <InsurancePage />
              </ProtectedRoute>
            }
            path="/insurance"
          />
          <Route
            element={
              <ProtectedRoute>
                <ReviewsPage />
              </ProtectedRoute>
            }
            path="/reviews"
          />
          <Route
            element={
              <ProtectedRoute>
                <WishlistPage />
              </ProtectedRoute>
            }
            path="/wishlist"
          />
          <Route
            element={
              <ProtectedRoute>
                <LoyaltyPage />
              </ProtectedRoute>
            }
            path="/loyalty"
          />
          <Route
            element={
              <ProtectedRoute>
                <InvitePage />
              </ProtectedRoute>
            }
            path="/invite"
          />
          <Route element={<DealsPage />} path="/deals" />
          <Route element={<PolicyPage />} path="/policies/:slug" />
          <Route element={<RideBookingPage />} path="/rides" />
          <Route element={<CarpoolPage />} path="/rides/carpool" />
          <Route element={<LegacyRouteRedirect to="/rides" />} path="/app" />
          <Route element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} path="/rides/:id/live" />
          <Route element={<SupportPage />} path="/support" />
        </Routes>
      </main>
      <footer className={`hm-footer${isMobile && !isFocusedFlow ? ' hm-footer-with-mobile-nav' : ''}`}>
        <div className="hm-footer-grid">
          <div className="hm-footer-brand">
            <img alt="" className="h-10 w-14 object-contain" src="/brand/turiya-mark-white.png" />
            <div><strong>{brandName}</strong><p>{footerDescription}</p></div>
          </div>
          <div><strong>Travel</strong><Link to="/tours">Tours & attractions</Link><Link to="/rides">Fast rides</Link><Link to="/rentals">Car rentals</Link><Link to="/destinations">Destinations</Link><Link to="/deals">Offers</Link></div>
          <div><strong>My journey</strong><Link to="/bookings">Bookings</Link><Link to="/wishlist">Wishlist</Link><Link to="/loyalty">Club Rewards</Link><Link to="/invite">Refer a Friend</Link><Link to="/wallet">Wallet</Link></div>
          <div><strong>Trust</strong><Link to="/support">Ticket support</Link><Link to="/policies/terms-and-conditions">Terms</Link><Link to="/policies/privacy-policy">Privacy</Link><Link to="/policies/safety-policy">Safety</Link></div>
        </div>
        <div className="hm-footer-bottom"><span>Transparent travel, from search to support.</span><div><Link to="/policies/cancellation-policy">Cancellation</Link><Link to="/policies/refund-policy">Refunds</Link><Link to="/policies/insurance-policy">Insurance policy</Link></div></div>
      </footer>
      {isFocusedFlow ? null : isMobile ? <BottomNav /> : null}
      <AuthModal />
    </div>
  )
}

export function AuthRouteTrigger() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, openAuthModal } = useCustomerAuth()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
      return
    }

    openAuthModal(text((location.state as { from?: string } | null)?.from, '/dashboard'))
    navigate('/', { replace: true })
  }, [isAuthenticated, location.state, navigate, openAuthModal])

  return null
}

export function AccountMenu({ onNavigate, compact = false }: { onNavigate: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { logout } = useCustomerAuth()
  const menuItemClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 w-full items-center justify-start gap-2 rounded-lg px-3 py-2.5 font-bold ${isActive ? 'bg-[#d6f2ec] text-[#115e59]' : 'text-[#17211d] hover:bg-[#d6f2ec] hover:text-[#115e59]'}`

  useEffect(() => {
    if (!open) {
      return
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target

      if (target instanceof Node && menuRef.current?.contains(target)) {
        return
      }

      setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function closeAfterNavigate() {
    setOpen(false)
    onNavigate()
  }

  function signOut() {
    logout()
    closeAfterNavigate()
    navigate('/')
  }

  return (
    <div className={compact ? 'relative shrink-0' : 'relative max-[980px]:border-t max-[980px]:border-[#ded8ca] max-[980px]:pt-2'} ref={menuRef}>
      <button aria-expanded={open} aria-haspopup="menu" className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-[#17211d] px-3.5 py-2.5 font-bold text-white ${compact ? 'max-[520px]:px-3 max-[520px]:text-sm' : 'max-[980px]:w-full max-[980px]:justify-center'}`} onClick={() => setOpen((current) => !current)} type="button">
        <Icon name="user" />
        <span className="max-[400px]:hidden">Account</span>
      </button>
      <div className={`absolute right-0 top-[calc(100%+10px)] z-[80] grid min-w-[220px] gap-1 rounded-lg border border-[#ded8ca] bg-white p-2 shadow-[0_18px_60px_rgba(23,33,29,0.12)] transition ${compact ? '' : 'max-[980px]:static max-[980px]:mt-2 max-[980px]:w-full max-[980px]:shadow-none'} ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'}`} role="menu">
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/dashboard">
          <Icon name="home" />
          Dashboard
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/bookings">
          <Icon name="ticket" />
          My trips
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/wishlist">
          <Icon name="heart" />
          Wishlist
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/loyalty">
          <Icon name="star" />
          Rewards
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/invite">
          <Icon name="gift" />
          Invite Friends
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/wallet">
          <Icon name="wallet" />
          Wallet
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/notifications">
          <Icon name="bell" />
          Alerts
        </NavLink>
        <NavLink className={menuItemClass} onClick={closeAfterNavigate} role="menuitem" to="/reviews">
          <Icon name="star" />
          Reviews
        </NavLink>
        <button className="mt-1 inline-flex min-h-11 w-full cursor-pointer items-center justify-start rounded-lg border-0 bg-transparent px-3 py-2.5 text-left font-bold text-[#17211d] hover:bg-[#d6f2ec] hover:text-[#115e59]" onClick={signOut} role="menuitem" type="button">
          Logout
        </button>
      </div>
    </div>
  )
}

export function BottomNav() {
  const { isAuthenticated, openAuthModal } = useCustomerAuth()

  return (
    <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-4 gap-1 border-t border-[#ded8ca] bg-white/95 p-2 pb-[max(8px,env(safe-area-inset-bottom))]">
      <NavLink className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] p-1.5 text-xs font-bold ${isActive ? 'bg-[#d6f2ec] text-[#115e59]' : 'text-[#5f6b64]'}`} end to="/"><Icon name="compass" />Explore</NavLink>
      <NavLink className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] p-1.5 text-xs font-bold ${isActive ? 'bg-[#d6f2ec] text-[#115e59]' : 'text-[#5f6b64]'}`} to="/wishlist"><Icon name="heart" />Saved</NavLink>
      <NavLink className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] p-1.5 text-xs font-bold ${isActive ? 'bg-[#d6f2ec] text-[#115e59]' : 'text-[#5f6b64]'}`} to="/bookings"><Icon name="ticket" />Bookings</NavLink>
      {isAuthenticated ? (
        <NavLink className={({ isActive }) => `flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] p-1.5 text-xs font-bold ${isActive ? 'bg-[#d6f2ec] text-[#115e59]' : 'text-[#5f6b64]'}`} to="/dashboard">
          <Icon name="user" />
          Account
        </NavLink>
      ) : (
        <button className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-0 bg-transparent p-1.5 text-xs font-bold text-[#5f6b64]" onClick={() => openAuthModal('/dashboard')} type="button">
          <Icon name="user" />
          Account
        </button>
      )}
    </nav>
  )
}
