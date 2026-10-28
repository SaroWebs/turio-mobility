import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getWishlist, toggleWishlist, toggleWishlistService, syncWishlist } from '../utils/customerApi'
import {
  getGuestWishlist,
  removeGuestWishlistItem,
  saveGuestWishlistItem,
} from '../utils/wishlistStorage'
import { useCustomerAuth } from '../contexts/customerAuth'
import { formatCurrency } from '../utils/data'
import { Icon } from '../components/Icon'
import { EmptyState, TourCardSkeleton } from '../components/customer'

interface WishlistItem {
  id: string
  wishlist_id?: number
  service_type: 'tour' | 'rental' | 'destination'
  title: string
  image?: string
  duration?: string
  price?: number
}

export function WishlistPage() {
  const { isAuthenticated, openAuthModal } = useCustomerAuth()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<WishlistItem[]>(() =>
    getGuestWishlist().map((item) => ({
      id: item.id,
      service_type: item.service_type,
      title: item.title,
      image: item.image,
      duration: item.duration,
      price: item.price,
    }))
  )
  const [activeTab, setActiveTab] = useState<'all' | 'tour' | 'rental' | 'destination'>('all')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function fetchServerWishlist() {
      const localItems: WishlistItem[] = getGuestWishlist().map((item) => ({
        id: item.id,
        service_type: item.service_type,
        title: item.title,
        image: item.image,
        duration: item.duration,
        price: item.price,
      }))

      if (isAuthenticated) {
        setLoading(true)
        try {
          // If we have local items, attempt to sync them to the backend first
          if (localItems.length > 0) {
            await syncWishlist(
              localItems.map((i) => ({ service_type: i.service_type, service_id: i.id }))
            ).catch(() => {})
          }

          const res = await getWishlist()
          if (!active) return

          if (res.data?.data) {
            const serverTours = (res.data.data.tours || []).map((t) => ({
              ...t,
              service_type: 'tour' as const,
            }))
            const serverRentals = (res.data.data.rentals || []).map((r) => ({
              ...r,
              service_type: 'rental' as const,
            }))
            const serverPlaces = (res.data.data.places || []).map((p) => ({
              ...p,
              service_type: 'destination' as const,
            }))

            // Merge server items with local items (deduplicated by service_type and id)
            const merged = new Map<string, WishlistItem>()
            for (const item of [...serverTours, ...serverRentals, ...serverPlaces, ...localItems]) {
              const key = `${item.service_type}-${item.id}`
              if (!merged.has(key)) {
                merged.set(key, item)
              }
            }

            const finalItems = Array.from(merged.values())
            setItems(finalItems)

            // Update local mirror
            finalItems.forEach((it) => {
              saveGuestWishlistItem({
                id: it.id,
                service_type: it.service_type,
                title: it.title,
                image: it.image,
                duration: it.duration,
                price: it.price,
              })
            })
            setLoading(false)
            return
          }
        } catch (err) {
          console.error('Failed to fetch wishlist from server', err)
        } finally {
          if (active) setLoading(false)
        }
      }

      if (!active) return
      setItems(localItems)
      setLoading(false)
    }

    void fetchServerWishlist()
    return () => { active = false }
  }, [isAuthenticated])

  const handleRemove = async (item: WishlistItem) => {
    // 1. Immediately remove from local state and storage
    removeGuestWishlistItem(item.id, item.service_type)
    setItems((prev) => prev.filter((i) => !(i.id === item.id && i.service_type === item.service_type)))

    // 2. If authenticated, remove from server
    if (isAuthenticated) {
      try {
        if (item.service_type === 'tour') {
          await toggleWishlist({ tourId: item.id, action: 'remove' })
        } else {
          await toggleWishlistService({
            service_type: item.service_type,
            service_id: item.id,
            action: 'remove',
          })
        }
      } catch (error) {
        console.error('Error removing wishlist item from server', error)
      }
    }
  }

  const tours = items.filter((i) => i.service_type === 'tour')
  const rentals = items.filter((i) => i.service_type === 'rental')
  const places = items.filter((i) => i.service_type === 'destination')

  const visibleItems = items.filter((item) => {
    if (activeTab === 'all') return true
    return item.service_type === activeTab
  })

  return (
    <section className="page-section max-w-6xl mx-auto px-4 py-8">
      {!isAuthenticated && items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d6e5e0] bg-[#f0fdf9] p-4 text-sm text-[#0f766e]">
          <div className="flex items-center gap-2.5">
            <Icon name="user" />
            <span>
              <strong>Guest mode:</strong> Your wishlist is currently saved on this device. Sign in to sync your saved items across your phone and tablet.
            </span>
          </div>
          <button
            onClick={() => openAuthModal('/wishlist')}
            className="rounded-lg bg-[#0f766e] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#115e59] transition"
          >
            Sign in to sync
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0f766e]">Saved Items</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2d27]">My Wishlist</h1>
          <span className="text-sm font-semibold text-[#65716a] bg-[#f0ede6] px-3 py-1 rounded-full">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <p className="text-sm text-[#5a6760]">Saved tours, rentals, and places you want to experience next.</p>
      </div>

      <div className="flex gap-2 border-b border-[#e8e2d4] pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
            activeTab === 'all' ? 'bg-[#0f766e] text-white' : 'bg-[#f4f2eb] text-[#55615a] hover:bg-[#e8e4d8]'
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('tour')}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
            activeTab === 'tour' ? 'bg-[#0f766e] text-white' : 'bg-[#f4f2eb] text-[#55615a] hover:bg-[#e8e4d8]'
          }`}
        >
          Tours ({tours.length})
        </button>
        <button
          onClick={() => setActiveTab('rental')}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
            activeTab === 'rental' ? 'bg-[#0f766e] text-white' : 'bg-[#f4f2eb] text-[#55615a] hover:bg-[#e8e4d8]'
          }`}
        >
          Rentals ({rentals.length})
        </button>
        <button
          onClick={() => setActiveTab('destination')}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
            activeTab === 'destination' ? 'bg-[#0f766e] text-white' : 'bg-[#f4f2eb] text-[#55615a] hover:bg-[#e8e4d8]'
          }`}
        >
          Places ({places.length})
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <TourCardSkeleton key={i} />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Your wishlist is empty" : `No ${activeTab} items saved`}
          text="Save memorable tours, flexible car rentals, and scenic destinations to revisit later."
          actionLabel="Explore Tours"
          onAction={() => navigate('/tours')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleItems.map((item) => {
            const linkPath =
              item.service_type === 'tour'
                ? `/tours/${item.id}`
                : item.service_type === 'rental'
                ? `/rentals/${item.id}`
                : `/destinations/${item.id}`

            return (
              <div
                key={`${item.service_type}-${item.id}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-[#ded8ca] bg-white transition-all hover:border-[#0f766e] hover:shadow-md"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#e9ece7]">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-[#65716a]">
                      No preview photo
                    </div>
                  )}
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#102824] backdrop-blur-sm shadow-sm">
                    {item.service_type === 'destination' ? 'place' : item.service_type}
                  </span>
                  <button
                    onClick={() => handleRemove(item)}
                    className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#b91c1c] hover:bg-white shadow-sm transition"
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
                  >
                    <Icon name="trash" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-base font-bold text-[#1f2d27] line-clamp-1 mb-1">{item.title}</h3>
                  {item.duration && <p className="text-xs text-[#65716a] mb-2">{item.duration}</p>}

                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-[#f0ede6]">
                    <div>
                      {item.price !== undefined && item.price > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-[11px] text-[#65716a]">
                            {item.service_type === 'rental' ? 'Daily rate' : 'Starting from'}
                          </span>
                          <span className="text-sm font-bold text-[#0f766e]">{formatCurrency(item.price)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#65716a]">Free exploration</span>
                      )}
                    </div>
                    <Link
                      to={linkPath}
                      className="rounded-full bg-[#102824] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1a3d37] transition"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
