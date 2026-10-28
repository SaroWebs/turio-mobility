export interface GuestWishlistItem {
  id: string
  service_type: 'tour' | 'rental' | 'destination'
  title: string
  image?: string
  duration?: string
  price?: number
}

const GUEST_WISHLIST_KEY = 'hm_guest_wishlist'

export function getGuestWishlist(): GuestWishlistItem[] {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGuestWishlistItem(item: GuestWishlistItem): void {
  try {
    const items = getGuestWishlist()
    const index = items.findIndex(
      (i) => i.id === item.id && i.service_type === item.service_type
    )
    if (index === -1) {
      items.unshift(item)
      localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items))
      window.dispatchEvent(new Event('wishlist-updated'))
    }
  } catch {
    // ignore storage error
  }
}

export function removeGuestWishlistItem(id: string, service_type?: 'tour' | 'rental' | 'destination'): void {
  try {
    const items = getGuestWishlist()
    const filtered = items.filter((i) => {
      if (service_type) {
        return !(i.id === id && i.service_type === service_type)
      }
      return i.id !== id
    })
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(filtered))
    window.dispatchEvent(new Event('wishlist-updated'))
  } catch {
    // ignore storage error
  }
}

export function isGuestWishlisted(id: string, service_type?: 'tour' | 'rental' | 'destination'): boolean {
  const items = getGuestWishlist()
  return items.some((i) => {
    if (service_type) {
      return i.id === id && i.service_type === service_type
    }
    return i.id === id
  })
}

export function clearGuestWishlist(): void {
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY)
    window.dispatchEvent(new Event('wishlist-updated'))
  } catch {
    // ignore storage error
  }
}
