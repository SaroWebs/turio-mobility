import { useState } from 'react'
import { type MediaAsset } from '../../utils/data'
import { Lightbox, type LightboxMediaItem } from './Lightbox'
import { Icon } from '../Icon'

export function MediaGallery({ media, title }: { media: MediaAsset[]; title: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (!media.length) return null

  const lightboxItems: LightboxMediaItem[] = media.map((item) => ({
    id: item.id,
    url: item.url,
    caption: item.caption,
    type: item.type,
  }))

  const handleOpen = (index: number) => {
    setSelectedIndex(index)
    setLightboxOpen(true)
  }

  return (
    <>
      <section
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
        aria-label={`${title} media gallery`}
      >
        {media.map((item, index) => (
          <figure
            key={item.id || index}
            tabIndex={0}
            role="button"
            aria-label={`View ${item.caption || `${title} photo ${index + 1}`}`}
            className="group m-0 cursor-pointer overflow-hidden rounded-xl border border-[#dbe1dc] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b2d5cc] hover:shadow-md focus-visible:outline-3 focus-visible:outline-[#0d7769]"
            onClick={() => handleOpen(index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleOpen(index)
              }
            }}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#eeebe2]">
              {item.type === 'video' ? (
                <>
                  <video
                    aria-label={item.caption}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    muted
                    preload="metadata"
                    src={item.url}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-black/40 text-lg text-white backdrop-blur-xs transition-transform group-hover:scale-110">
                      ▶
                    </span>
                  </span>
                  <span className="absolute bottom-2.5 right-2.5 rounded-md bg-[#13231f]/80 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-xs">
                    Video · Click to play
                  </span>
                </>
              ) : (
                <>
                  <img
                    alt={item.caption || `${title} photo ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                    src={item.url}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs">
                      <Icon name="search" /> Expand
                    </span>
                  </div>
                  {item.type === 'panorama' ? (
                    <span className="absolute left-3 top-3 rounded-md bg-[#13231f]/80 px-2 py-0.5 text-xs font-semibold text-[#d8f3eb] backdrop-blur-xs">
                      360° view
                    </span>
                  ) : null}
                </>
              )}
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-[#5b6964]">
              <span className="line-clamp-1 font-medium text-[#13231f]">
                {item.caption || `${title} view`}
              </span>
              <span className="shrink-0 text-xs text-[#8a9893]">
                {item.type === 'video' ? 'Video' : 'Photo'}
              </span>
            </figcaption>
          </figure>
        ))}
      </section>

      <Lightbox
        isOpen={lightboxOpen}
        items={lightboxItems}
        initialIndex={selectedIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
