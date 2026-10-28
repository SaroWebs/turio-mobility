import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../Icon'

export type LightboxMediaItem = {
  id?: string
  url: string
  caption?: string
  type?: 'image' | 'video' | 'panorama'
}

type LightboxProps = {
  isOpen: boolean
  onClose: () => void
  items: LightboxMediaItem[]
  initialIndex?: number
}

export function Lightbox({ isOpen, onClose, items, initialIndex = 0 }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [prevProps, setPrevProps] = useState({ isOpen, initialIndex })

  if (prevProps.isOpen !== isOpen || prevProps.initialIndex !== initialIndex) {
    setPrevProps({ isOpen, initialIndex })
    if (isOpen) {
      setCurrentIndex(initialIndex)
    }
  }

  const safeIndex = items.length > 0 ? Math.min(Math.max(0, currentIndex), items.length - 1) : 0

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
  }, [items.length])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
  }, [items.length])

  // Keyboard navigation & body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose, handlePrev, handleNext])

  if (typeof document === 'undefined') return null

  const currentItem = items[safeIndex]

  return createPortal(
    <AnimatePresence>
      {isOpen && items.length > 0 && currentItem && (
        <motion.div
          aria-label="Image gallery lightbox"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex flex-col justify-between bg-black/92 p-4 text-white backdrop-blur-md select-none sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          onClick={(e) => {
            // Close when clicking directly on the backdrop/scrim
            if (e.target === e.currentTarget) {
              onClose()
            }
          }}
        >
          {/* Top Bar: Counter, Badges & Close Button */}
          <div className="flex w-full items-center justify-between py-1 px-2 z-10">
            <div className="flex items-center gap-3">
              <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wider uppercase text-white/90">
                {safeIndex + 1} / {items.length}
              </span>
              {currentItem.type === 'video' ? (
                <span className="rounded-md bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                  Video
                </span>
              ) : currentItem.type === 'panorama' ? (
                <span className="rounded-md bg-teal-500/20 border border-teal-400/30 px-2.5 py-0.5 text-xs font-medium text-teal-200">
                  360° Panorama
                </span>
              ) : null}
            </div>

            <button
              aria-label="Close lightbox"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/90 transition-all hover:bg-white/25 hover:text-white cursor-pointer active:scale-95"
              onClick={onClose}
              type="button"
            >
              <span className="text-xl font-light leading-none">✕</span>
            </button>
          </div>

          {/* Center Stage: Interactive Media Viewport + Nav Controls */}
          <div
            className="relative flex flex-1 min-h-0 w-full items-center justify-center my-2 overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose()
              }
            }}
          >
            {/* Prev Button */}
            {items.length > 1 && (
              <button
                aria-label="Previous media"
                className="absolute left-2 sm:left-6 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-xs transition hover:bg-black/80 hover:scale-105 active:scale-95 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrev()
                }}
                type="button"
              >
                <span className="rotate-180 inline-flex items-center justify-center">
                  <Icon name="arrow" />
                </span>
              </button>
            )}

            {/* Media Item Container with Drag / Swipe */}
            <motion.div
              key={safeIndex}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-full w-full items-center justify-center p-2"
              drag={items.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              exit={{ opacity: 0, scale: 0.98 }}
              initial={{ opacity: 0, scale: 0.98 }}
              onDragEnd={(_, { offset, velocity }) => {
                const swipe = Math.abs(offset.x) * velocity.x
                if (swipe < -100 || offset.x < -80) {
                  handleNext()
                } else if (swipe > 100 || offset.x > 80) {
                  handlePrev()
                }
              }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              {currentItem.type === 'video' ? (
                <video
                  autoPlay
                  controls
                  className="max-h-full max-w-full rounded-lg border border-white/10 object-contain shadow-2xl"
                  src={currentItem.url}
                />
              ) : (
                <img
                  alt={currentItem.caption || `Media asset ${safeIndex + 1}`}
                  className="max-h-full max-w-full rounded-lg border border-white/10 object-contain shadow-2xl pointer-events-auto"
                  draggable={false}
                  src={currentItem.url}
                />
              )}
            </motion.div>

            {/* Next Button */}
            {items.length > 1 && (
              <button
                aria-label="Next media"
                className="absolute right-2 sm:right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur-xs transition hover:bg-black/80 hover:scale-105 active:scale-95 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                type="button"
              >
                <Icon name="arrow" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Caption and Thumbnail Strip */}
          <div
            className="flex w-full flex-col items-center gap-2 pb-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {currentItem.caption && (
              <p className="max-w-2xl text-center text-sm font-medium tracking-wide text-white/90 line-clamp-2 px-4">
                {currentItem.caption}
              </p>
            )}

            {items.length > 1 && (
              <div
                className="flex max-w-full gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Thumbnails"
              >
                {items.map((item, index) => (
                  <button
                    key={item.id || index}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-selected={index === safeIndex}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md border transition-all cursor-pointer ${
                      index === safeIndex
                        ? 'border-teal-400 ring-2 ring-teal-400/60 scale-105 opacity-100'
                        : 'border-white/20 opacity-50 hover:opacity-85'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentIndex(index)
                    }}
                    role="tab"
                    type="button"
                  >
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={item.url}
                    />
                    {item.type === 'video' && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] text-white">
                        ▶
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
