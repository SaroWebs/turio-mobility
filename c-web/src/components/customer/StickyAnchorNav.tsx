import { useEffect, useRef, useState } from 'react'

export interface AnchorNavItem {
  id: string
  label: string
}

export function StickyAnchorNav({ items }: { items: AnchorNavItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!items.length) return

    // Clean up any previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const headingOffset = 80 // approx sticky nav height

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        rootMargin: `-${headingOffset}px 0px -60% 0px`,
        threshold: 0,
      },
    )

    const targets = items
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    targets.forEach((el) => observerRef.current!.observe(el))

    return () => {
      observerRef.current?.disconnect()
    }
  }, [items])

  const handleClick = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return

    const stickyOffset = 64 + 48 + 8 // main nav + anchor nav + breathing room
    const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset

    window.scrollTo({ top, behavior: 'smooth' })
    setActiveId(id)
  }

  if (!items.length) return null

  return (
    <nav
      aria-label="Page sections"
      className="hidden md:flex sticky top-[64px] z-30 bg-white border-b border-[#dbe1dc] shadow-xs px-4 overflow-x-auto gap-1 mb-6"
    >
      {items.map(({ id, label }) => {
        const active = activeId === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active
                ? 'border-[#0d7769] text-[#0d7769]'
                : 'border-transparent text-[#5b6964] hover:text-[#13231f]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
