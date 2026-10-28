import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../Icon'
import { getRecentlyViewedUrl, type RecentlyViewedItem } from '../../utils/recentlyViewed'

export type { RecentlyViewedItem }

/**
 * Recently viewed tours/rentals/destinations component.
 * Stores up to 10 items in sessionStorage, deduped by ID.
 *
 * Props:
 *  - items: Array of items — if omitted or empty, loads from sessionStorage
 *  - currentId: ID of currently active page/item to exclude from display
 *  - title: Optional section heading (default: "Recently Viewed")
 *  - subtitle: Optional helper text
 *  - onRemove: Optional callback when user removes an item
 */
export function RecentlyViewed({
  items,
  currentId,
  title = 'Recently Viewed',
  subtitle,
  onRemove,
}: {
  items?: RecentlyViewedItem[]
  currentId?: string
  title?: string
  subtitle?: string
  onRemove?: (id: string) => void
}) {
  const [storedItems, setStoredItems] = useState<RecentlyViewedItem[]>(() => {
    try {
      const stored = sessionStorage.getItem('recently_viewed')
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedItem[]
        const seen = new Set<string>()
        const deduped = parsed.filter((item) => {
          if (!item?.id || seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        return deduped
      }
    } catch {
      // sessionStorage not available or invalid JSON
    }
    return []
  })

  // Keep state in sync if sessionStorage changes externally
  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = sessionStorage.getItem('recently_viewed')
        if (stored) {
          setStoredItems(JSON.parse(stored))
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const rawList = items && items.length > 0 ? items : storedItems
  const displayItems = currentId ? rawList.filter((item) => item.id !== currentId) : rawList

  if (displayItems.length === 0) {
    return null
  }

  const handleRemove = (e: MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const next = storedItems.filter((x) => x.id !== id)
    setStoredItems(next)
    try {
      sessionStorage.setItem('recently_viewed', JSON.stringify(next))
    } catch {
      // ignore
    }
    onRemove?.(id)
  }

  return (
    <section className="recently-viewed-section">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#a4541d]">Your History</p>
          <h2 className="m-0 text-xl font-medium text-[#1c2723]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs font-light text-[#5f6b64]">{subtitle}</p> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {displayItems.map((item) => {
          const itemUrl = getRecentlyViewedUrl(item)
          const typeLabel = item.type === 'rental' ? 'Rental' : item.type === 'destination' ? 'Destination' : 'Tour'

          return (
            <div
              key={`${item.type || 'tour'}-${item.id}`}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-[#e5dfd2] bg-[#faf8f5] shadow-xs transition duration-300 hover:-translate-y-0.5 hover:border-[#0f766e] hover:shadow-sm"
            >
              <Link aria-label={`View ${item.title}`} className="relative block aspect-[16/10] overflow-hidden bg-[#eeebe2]" to={itemUrl}>
                {item.image ? (
                  <img
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                    src={item.image}
                  />
                ) : (
                  <div
                    aria-label={item.title}
                    className="flex h-full w-full items-center justify-center bg-[#e9ece7] p-2 text-center text-xs font-light text-[#65716a]"
                    role="img"
                  >
                    {typeLabel} image
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-normal tracking-wide text-[#0b615a] shadow-xs backdrop-blur-xs">
                  {typeLabel}
                </span>
                <button
                  aria-label={`Remove ${item.title} from recently viewed`}
                  className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-xs text-white opacity-0 backdrop-blur-xs transition group-hover:opacity-100 hover:bg-black/70"
                  onClick={(e) => handleRemove(e, item.id)}
                  title="Remove"
                  type="button"
                >
                  ✕
                </button>
              </Link>

              <div className="flex flex-1 flex-col justify-between p-3">
                <Link className="no-underline" to={itemUrl}>
                  <strong className="block text-xs font-medium leading-snug text-[#1c2723] transition-colors group-hover:text-[#0f766e] line-clamp-1">
                    {item.title}
                  </strong>
                </Link>
                <div className="mt-2 flex items-center justify-between border-t border-[#eee9df] pt-2 text-[11px]">
                  <span className="font-light text-[#65716a] capitalize">{item.type || 'Tour'}</span>
                  <Link className="inline-flex items-center gap-1 font-medium text-[#0f766e] no-underline hover:underline" to={itemUrl}>
                    View <Icon name="arrow" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}