import { useEffect } from 'react'

export interface RecentlyViewedItem {
  id: string
  title: string
  image?: string
  type?: 'tour' | 'rental' | 'destination'
  subtitle?: string
}

export function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === 'rental') return `/rentals/${item.id}`
  if (item.type === 'destination') return `/destinations/${item.id}`
  return `/tours/${item.id}`
}

/**
 * Function to record viewed items into sessionStorage directly.
 */
export function recordRecentlyViewed(item: {
  id: string
  title: string
  image?: string
  type?: 'tour' | 'rental' | 'destination'
}) {
  if (!item.id) return

  try {
    const stored = sessionStorage.getItem('recently_viewed')
    const arr: Array<{ id: string; title: string; image?: string; type?: string }> = stored ? JSON.parse(stored) : []

    // Dedup: remove existing entry if id already exists, then add to front
    const existingIndex = arr.findIndex((x) => x.id === item.id)
    if (existingIndex >= 0) {
      arr.splice(existingIndex, 1)
    }

    arr.unshift(item)

    // Keep max 10 items
    const limited = arr.slice(0, 10)
    sessionStorage.setItem('recently_viewed', JSON.stringify(limited))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook to automatically track viewed items on page mount.
 * Usage: In tour/rental/destination detail pages:
 *   useRecentlyViewed({ id, title, image, type })
 */
export function useRecentlyViewed(item: {
  id: string
  title: string
  image?: string
  type?: 'tour' | 'rental' | 'destination'
}) {
  const { id, title, image, type } = item
  useEffect(() => {
    recordRecentlyViewed({ id, title, image, type })
  }, [id, title, image, type])
}
