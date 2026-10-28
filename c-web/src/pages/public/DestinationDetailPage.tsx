import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicDestination, getPublicTours, uploadPlaceMedia } from '../../utils/customerApi'
import type { Destination, Tour } from '../../utils/data'
import { mapDestination, mapTour, relatedToursForDestination } from '../../utils/customerMappers'
import {
  ConnectedTourCard,
  MediaGallery,
  AuthActionLink,
  WishlistButton,
  Lightbox,
  type LightboxMediaItem,
  PageContainer,
  Button,
  DetailPageSkeleton,
} from '../../components/customer/index'
import { RecentlyViewed } from '../../components/customer/RecentlyViewed'
import { useRecentlyViewed } from '../../utils/recentlyViewed'
import { Icon } from '../../components/Icon'
import { useCustomerAuth } from '../../contexts/customerAuth'

export function DestinationDetailPage() {
  const { id } = useParams()
  const [liveDestination, setLiveDestination] = useState<Destination | null>(null)
  const [liveTours, setLiveTours] = useState<Tour[]>([])
  const [status, setStatus] = useState('Loading destination details…')
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [lightboxItems, setLightboxItems] = useState<LightboxMediaItem[]>([])
  const { isAuthenticated } = useCustomerAuth()

  async function submitPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id || !isAuthenticated) return
    const form = new FormData(event.currentTarget)
    const image = form.get('image')
    if (!(image instanceof File) || image.size === 0) {
      setUploadStatus('Choose an image before submitting.')
      return
    }
    setUploading(true)
    setUploadStatus('')
    const result = await uploadPlaceMedia(id, image, String(form.get('caption') ?? ''), form.get('is360') === 'on')
    setUploading(false)
    if (result.error) {
      setUploadStatus(result.error)
      return
    }
    event.currentTarget.reset()
    setUploadStatus(result.data?.message ?? 'Photo sent for admin approval.')
  }

  useEffect(() => {
    let mounted = true

    if (!id) {
      return () => {
        mounted = false
      }
    }

    getPublicDestination(id).then((result) => {
      if (!mounted) return

      if (result.error) {
        setStatus(result.error)
        return
      }

      if (result.data?.data) {
        setLiveDestination(mapDestination(result.data.data, 0))
        setStatus('Loaded live place details, media, reviews, and related tours.')
      }
    })

    getPublicTours().then((result) => {
      if (mounted && !result.error) {
        setLiveTours(result.data?.data?.map(mapTour) ?? [])
      }
    })

    return () => {
      mounted = false
    }
  }, [id])

  useRecentlyViewed({
    id: liveDestination?.id ?? '',
    title: liveDestination?.name ?? '',
    image: liveDestination?.image,
    type: 'destination',
  })

  if (!liveDestination) {
    if (status && (status.toLowerCase().includes('not found') || status.toLowerCase().includes('error'))) {
      return (
        <PageContainer className="py-16 text-center">
          <p className="text-base text-[#5b6964]" role="status">
            {status}
          </p>
        </PageContainer>
      )
    }
    return (
      <PageContainer className="py-8 sm:py-12">
        <DetailPageSkeleton />
      </PageContainer>
    )
  }

  const destination = liveDestination
  const activeTours = destination.activeTours.length
    ? destination.activeTours
    : relatedToursForDestination(destination, liveTours)
  const google = destination.google
  const mapQuery =
    google?.latitude !== undefined && google?.longitude !== undefined
      ? `${google.latitude},${google.longitude}`
      : destination.region
  const mapsUrl =
    google?.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}${
      google?.placeId ? `&query_place_id=${encodeURIComponent(google.placeId)}` : ''
    }`

  return (
    <>
      <PageContainer as="main" className="py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[#5b6964]">
          <Link to="/" className="hover:text-[#0d7769]">Home</Link>
          <span>/</span>
          <Link to="/destinations" className="hover:text-[#0d7769]">Destinations</Link>
          <span>/</span>
          <span className="text-[#13231f] font-medium truncate max-w-xs">{destination.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
          <div className="min-w-0">
            {/* Main Destination Hero Image */}
            <div
              className="group relative mb-6 cursor-pointer overflow-hidden rounded-xl border border-[#dbe1dc] bg-[#eeebe2] shadow-xs"
              onClick={() => {
                const allItems: LightboxMediaItem[] = [
                  {
                    url: destination.image,
                    caption: `${destination.name} - ${destination.region}`,
                    type: 'image',
                  },
                  ...destination.media.map((m) => ({
                    url: m.url,
                    caption: m.caption,
                    type: m.type,
                  })),
                ]
                setLightboxItems(allItems)
                setLightboxIdx(0)
                setLightboxOpen(true)
              }}
            >
              <img
                alt={`${destination.name} destination`}
                className="aspect-[16/10] sm:aspect-[16/9] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                src={destination.image}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-200 group-hover:bg-black/20 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs">
                  <Icon name="search" /> View photos
                </span>
              </div>
              <div className="absolute right-4 top-4 z-10" onClick={(e) => e.stopPropagation()}>
                <WishlistButton
                  id={destination.id}
                  title={destination.name}
                  image={destination.image}
                  serviceType="destination"
                />
              </div>
            </div>

            {/* Heading Block */}
            <div className="mb-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a4f16]">
                {destination.region}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[#13231f] sm:text-3xl lg:text-4xl">
                {destination.name}
              </h1>
              <p className="mt-2 text-base leading-relaxed text-[#5b6964]">{destination.summary}</p>
            </div>

            {/* Trip Facts */}
            <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-[#dbe1dc] bg-white p-3.5 shadow-xs">
                <span className="block text-xs font-medium uppercase tracking-wider text-[#5b6964]">Rating</span>
                <strong className="mt-1 block text-sm font-bold text-[#13231f]">{destination.rating}/5</strong>
              </div>
              <div className="rounded-lg border border-[#dbe1dc] bg-white p-3.5 shadow-xs">
                <span className="block text-xs font-medium uppercase tracking-wider text-[#5b6964]">Active tours</span>
                <strong className="mt-1 block text-sm font-bold text-[#13231f]">{activeTours.length}</strong>
              </div>
              <div className="rounded-lg border border-[#dbe1dc] bg-white p-3.5 shadow-xs">
                <span className="block text-xs font-medium uppercase tracking-wider text-[#5b6964]">Photos</span>
                <strong className="mt-1 block text-sm font-bold text-[#13231f]">{destination.media.length} items</strong>
              </div>
              <div className="rounded-lg border border-[#dbe1dc] bg-white p-3.5 shadow-xs">
                <span className="block text-xs font-medium uppercase tracking-wider text-[#5b6964]">Support</span>
                <strong className="mt-1 block text-sm font-bold text-[#0d7769]">Trip-guided</strong>
              </div>
            </div>

            <MediaGallery media={destination.media} title={destination.name} />

            {/* Google place integration */}
            {google && (
              <section className="mt-8 rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f0f3f1] pb-4 mb-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
                      Google Maps Information
                    </span>
                    <h2 className="text-xl font-bold text-[#13231f]">Live Visitor Essentials</h2>
                    {google.editorialSummary && (
                      <p className="mt-1 text-sm text-[#5b6964]">{google.editorialSummary}</p>
                    )}
                  </div>
                  {google.openNow !== undefined && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        google.openNow
                          ? 'bg-[#e7f7ed] text-[#137333]'
                          : 'bg-[#fdeeed] text-[#b42318]'
                      }`}
                    >
                      {google.openNow ? 'Open now' : 'Closed now'}
                    </span>
                  )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <iframe
                    className="h-72 w-full rounded-xl border border-[#dbe1dc]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`}
                    title={`Map of ${destination.name}`}
                  />
                  <div className="space-y-3 text-sm">
                    {google.address && (
                      <div>
                        <strong className="block text-xs font-semibold text-[#5b6964]">Address</strong>
                        <span className="text-[#13231f]">{google.address}</span>
                      </div>
                    )}
                    {google.phone && (
                      <div>
                        <strong className="block text-xs font-semibold text-[#5b6964]">Phone</strong>
                        <a className="text-[#0d7769] font-medium hover:underline" href={`tel:${google.phone}`}>
                          {google.phone}
                        </a>
                      </div>
                    )}
                    {google.businessStatus && (
                      <div>
                        <strong className="block text-xs font-semibold text-[#5b6964]">Status</strong>
                        <span className="text-[#13231f]">{google.businessStatus}</span>
                      </div>
                    )}
                    <div className="pt-2 flex flex-col gap-2">
                      <Button variant="primary" size="md" href={mapsUrl} iconRight={<Icon name="arrow" />}>
                        Directions on Google Maps
                      </Button>
                      {google.website && (
                        <Button variant="secondary" size="md" href={google.website}>
                          Official website
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {google.openingHours.length > 0 && (
                  <div className="mt-6 border-t border-[#f0f3f1] pt-4">
                    <h3 className="text-sm font-bold text-[#13231f] mb-3">Opening hours</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {google.openingHours.map((line) => (
                        <p className="m-0 rounded-lg bg-[#fafbf8] border border-[#f0f3f1] px-3 py-2 text-xs text-[#5b6964]" key={line}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Traveller Photo Upload */}
            <section className="mt-8 rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
                Community Contribution
              </span>
              <h2 className="text-xl font-bold text-[#13231f] mb-2">Share a Travel Photo</h2>
              <p className="text-sm text-[#5b6964] mb-4">
                Help other travellers discover this destination by sharing recent scenic photography.
              </p>

              {isAuthenticated ? (
                <form onSubmit={submitPhoto} className="space-y-4 max-w-md">
                  <div>
                    <label htmlFor="photo-file" className="block text-xs font-semibold text-[#13231f] mb-1">
                      Choose photo
                    </label>
                    <input
                      id="photo-file"
                      name="image"
                      type="file"
                      accept="image/*"
                      required
                      className="block w-full text-xs text-[#5b6964] file:mr-4 file:rounded-lg file:border-0 file:bg-[#e4f3ef] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0d7769] hover:file:bg-[#d0ece4]"
                    />
                  </div>
                  <div>
                    <label htmlFor="photo-caption" className="block text-xs font-semibold text-[#13231f] mb-1">
                      Caption or viewpoint
                    </label>
                    <input
                      id="photo-caption"
                      name="caption"
                      type="text"
                      placeholder="e.g. Sunrise view from North Ridge"
                      className="min-h-[44px] w-full rounded-lg border border-[#dbe1dc] bg-white px-3 py-2 text-sm text-[#13231f] focus:border-[#0d7769]"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[#5b6964]">
                    <input name="is360" type="checkbox" className="rounded" />
                    <span>This is a 360° panoramic photograph</span>
                  </label>
                  <Button variant="primary" size="md" type="submit" loading={uploading} disabled={uploading}>
                    Submit photo
                  </Button>
                  {uploadStatus && <p className="text-xs text-[#0d7769]" role="status">{uploadStatus}</p>}
                </form>
              ) : (
                <AuthActionLink to={`/destinations/${destination.id}`} className="text-sm font-semibold text-[#0d7769] hover:underline">
                  Login to share your trip photography
                </AuthActionLink>
              )}
            </section>
          </div>

          {/* Right Column: Tours Passing Through */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
                Trip Discovery
              </span>
              <h2 className="text-lg font-bold text-[#13231f] mt-1 mb-2">
                Tours featuring {destination.name}
              </h2>
              <p className="text-xs leading-relaxed text-[#5b6964] mb-4">
                Explore guided multi-day holidays that include this destination in their itinerary.
              </p>

              {activeTours.length > 0 ? (
                <div className="space-y-4">
                  {activeTours.slice(0, 3).map((tour) => (
                    <ConnectedTourCard key={tour.id} tour={tour} destinationName={destination.name} />
                  ))}
                  <Button variant="outline" size="md" fullWidth to={`/tours?q=${encodeURIComponent(destination.name)}`}>
                    Browse all matching tours
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-[#5b6964]">
                  <p>No packaged tours currently match this location directly.</p>
                  <div className="mt-3">
                    <Button variant="secondary" size="sm" to="/tours">
                      Explore all tours
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#dbe1dc] bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[#13231f] mb-1">Need a custom chauffeur trip?</h3>
              <p className="text-xs leading-relaxed text-[#5b6964] mb-3">
                Hire a car with an experienced local driver to explore {destination.name} on your own schedule.
              </p>
              <Button variant="secondary" size="md" fullWidth to={`/rentals?destination=${encodeURIComponent(destination.name)}`}>
                Rent a Car with driver
              </Button>
            </div>
          </aside>
        </div>
      </PageContainer>

      <PageContainer className="pb-16">
        <section id="recently-viewed" className="border-t border-[#dbe1dc] pt-10">
          <RecentlyViewed items={[]} />
        </section>
      </PageContainer>

      <Lightbox
        isOpen={lightboxOpen}
        items={lightboxItems}
        initialIndex={lightboxIdx}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}
