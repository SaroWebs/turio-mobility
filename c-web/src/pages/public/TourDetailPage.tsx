import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  InfoBlock,
  ItineraryTimeline,
  PackageDetailsPanel,
  PolicyPanel,
  RelatedPlacesPanel,
  SchedulePanel,
  TourCard,
  WishlistButton,
  Lightbox,
  type LightboxMediaItem,
  PageContainer,
  Button,
  MobileActionBar,
  DetailPageSkeleton,
} from '../../components/customer/index'
import { Icon } from '../../components/Icon'
import { getPublicTour, getPublicTours } from '../../utils/customerApi'
import { mapTour } from '../../utils/customerMappers'
import { type MediaAsset, type Tour, formatCurrency } from '../../utils/data'
import { RecentlyViewed } from '../../components/customer/RecentlyViewed'
import { recordRecentlyViewed } from '../../utils/recentlyViewed'
import { StickyAnchorNav } from '../../components/customer/StickyAnchorNav'
import { TourSpecsStrip } from '../../components/customer/TourSpecsStrip'

export function TourDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [liveTour, setLiveTour] = useState<Tour | null>(null)
  const [allTours, setAllTours] = useState<Tour[]>([])
  const [status, setStatus] = useState('Loading tour details...')

  useEffect(() => {
    let mounted = true

    if (!id) {
      return () => {
        mounted = false
      }
    }

    // Load active tour details and record recently viewed
    getPublicTour(id).then((result) => {
      if (!mounted) return
      if (result.error || !result.data?.data) {
        setStatus(result.error ?? 'Tour not found.')
        return
      }
      const tour = mapTour(result.data.data, 0)
      setLiveTour(tour)
      recordRecentlyViewed({
        id: tour.id,
        title: tour.title,
        image: tour.image,
        type: 'tour',
      })
    })

    // Load all tours to discover similar experiences
    getPublicTours().then((result) => {
      if (!mounted || result.error || !result.data?.data) return
      const tours = (result.data.data as Record<string, unknown>[]).map((item, idx) =>
        mapTour(item, idx),
      )
      setAllTours(tours)
    })

    return () => {
      mounted = false
    }
  }, [id])

  const tour = liveTour

  // Compute similar tours matching destination or category
  const similarTours = useMemo(() => {
    if (!tour || !allTours.length) return []
    const others = allTours.filter((t) => t.id !== tour.id)
    const destMatches = others.filter((t) => {
      const tDest = (t.destination || '').toLowerCase()
      const currDest = (tour.destination || '').toLowerCase()
      return Boolean(tDest && currDest && (tDest.includes(currDest) || currDest.includes(tDest)))
    })
    const catMatches = others.filter((t) => {
      if (destMatches.includes(t)) return false
      const tCat = (t.category || '').toLowerCase()
      const currCat = (tour.category || '').toLowerCase()
      return Boolean(tCat && currCat && tCat === currCat)
    })
    const remaining = others.filter((t) => !destMatches.includes(t) && !catMatches.includes(t))
    return [...destMatches, ...catMatches, ...remaining].slice(0, 3)
  }, [tour, allTours])

  if (!tour) {
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

  const isPlanned = tour.tourType === 'planned'
  const deposit = Math.round(tour.price * (tour.depositPercent / 100))
  const hasDeposit = tour.depositPercent > 0
  const route = [tour.startLocation, tour.endLocation].filter(Boolean).join(' to ')
  const group = tour.groupSizeLabel || (tour.maxGroupSize ? `Up to ${tour.maxGroupSize} guests` : 'Hosted group')
  const heroMedia = tour.gallery?.length
    ? tour.gallery
    : tour.image
      ? [{ id: `${tour.id}-cover`, type: 'image' as const, url: tour.image, caption: tour.title }]
      : []

  const priceFormatted = hasDeposit
    ? `${formatCurrency(deposit)} to reserve`
    : `${formatCurrency(tour.price)} per person`
  const actionLabel = isPlanned ? 'Choose a departure' : 'Choose your dates'
  const checkoutUrl = `/tours/${tour.id}/checkout${location.search}`

  const anchorItems = [
    { id: 'tour-highlights', label: 'Highlights' },
    { id: 'tour-itinerary', label: 'Day-by-Day' },
    { id: 'tour-inclusions', label: "What's Included" },
    { id: 'departures-section', label: 'Departures' },
    { id: 'tour-map', label: 'Route Map' },
    { id: 'similar-tours', label: 'Similar Tours' },
  ]

  return (
    <>
      <StickyAnchorNav items={anchorItems} />
      <DetailPage
        actionLabel={actionLabel}
        checkoutTo={checkoutUrl}
        checklist={[
          `${tour.duration}${tour.nights ? ` / ${tour.nights} nights` : ''}`,
          route || tour.destination,
          'Itinerary, inclusions, and terms before payment',
        ]}
        media={heroMedia}
        meta={[
          ['Duration', tour.nights ? `${tour.duration} / ${tour.nights} nights` : tour.duration],
          ['Route', route || tour.destination],
          ['Trip level', tour.difficulty || tour.category],
          [isPlanned ? 'Next departure' : 'Travel dates', isPlanned ? tour.nextSchedule : 'Choose at booking'],
          [isPlanned ? 'Seats left' : 'Trip style', isPlanned ? `${tour.seatsLeft}` : 'Private group'],
          ['Group', group],
        ]}
        price={priceFormatted}
        priceNote={
          hasDeposit
            ? `${tour.depositPercent}% deposit — ${formatCurrency(tour.price)} total per person`
            : 'Final availability and payment timing are confirmed at checkout'
        }
        subtitle={tour.destination}
        summary={tour.summary}
        title={tour.title}
        tour={tour}
        similarCount={similarTours.length}
      >
        {tour.brochureUrl && <section className="rounded-xl border border-[#dbe1dc] bg-white p-5 sm:p-6" aria-labelledby="tour-brochure-title">
          <h2 id="tour-brochure-title" className="text-xl font-semibold text-[#13231f]">Take the tour details with you</h2>
          <p className="mt-2 text-base text-[#5b6964]">Save the PDF brochure to read the itinerary, inclusions and travel information before booking.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={tour.brochureUrl} className="inline-flex min-h-12 items-center rounded-lg bg-[#0d7769] px-5 py-3 font-semibold text-white hover:bg-[#0a5d54] focus-visible:outline-2 focus-visible:outline-offset-2">Download brochure (PDF)</a>
            {tour.hasUploadedBrochure && tour.generatedBrochureUrl && <a href={tour.generatedBrochureUrl} className="inline-flex min-h-12 items-center rounded-lg border border-[#dbe1dc] px-5 py-3 font-semibold text-[#0d7769] hover:bg-[#f7f8f5]">Download latest tour details (PDF)</a>}
          </div>
          <p className="mt-3 text-sm text-[#5b6964]">Check the selected departure for current prices and availability.</p>
        </section>}
        <div id="tour-highlights"><InfoBlock title="Highlights" items={tour.highlights} /></div>
        <div id="tour-itinerary"><ItineraryTimeline stops={tour.itineraryStops} /></div>
        <div id="tour-inclusions"><PackageDetailsPanel inclusions={tour.inclusions ?? []} exclusions={tour.exclusions ?? []} /></div>
        <div id="departures-section">
          <SchedulePanel schedules={tour.schedules} tourType={tour.tourType} />
        </div>
        <div id="tour-map"><RelatedPlacesPanel places={tour.relatedPlaces} tour={tour} /></div>
        {tour.policy ? <PolicyPanel text={tour.policy} /> : null}
      </DetailPage>

      {/* Full-width bottom exploration: Similar Tours & Recently Viewed */}
      <PageContainer className="pb-24 md:pb-16 space-y-12">
        {similarTours.length > 0 && (
          <section id="similar-tours" className="border-t border-[#dbe1dc] pt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a4f16]">
                  Recommended For You
                </p>
                <h2 className="text-2xl font-bold text-[#13231f]">Similar Tours You Might Like</h2>
                <p className="mt-1 text-sm text-[#5b6964]">
                  Alternative itineraries and departures matching {tour.destination || tour.category}.
                </p>
              </div>
              <Link
                to={`/tours?category=${encodeURIComponent(tour.category)}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0d7769] hover:underline"
              >
                Browse more {tour.category} tours <Icon name="arrow" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similarTours.map((simTour) => (
                <TourCard key={simTour.id} tour={simTour} />
              ))}
            </div>
          </section>
        )}

        <section id="recently-viewed" className="border-t border-[#dbe1dc] pt-10">
          <RecentlyViewed
            currentId={tour.id}
            title="Recently Viewed"
            subtitle="Other tours, rentals, and destinations you checked during this session"
          />
        </section>
      </PageContainer>

      {/* Mobile Sticky Action Bar */}
      <MobileActionBar
        price={priceFormatted}
        subtext={hasDeposit ? `${tour.depositPercent}% deposit` : 'Per person rate'}
        action={
          <Button variant="primary" size="md" to={checkoutUrl} className="min-h-[44px]">
            {isPlanned ? 'Book departure' : 'Book tour'}
          </Button>
        }
      />
    </>
  )
}

function HeroGallery({ media, title }: { media: MediaAsset[]; title: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  const visible = media.filter((item) => item.url).slice(0, 3)
  const lightboxItems: LightboxMediaItem[] = media.map((item) => ({
    id: item.id,
    url: item.url,
    caption: item.caption,
    type: item.type,
  }))

  if (!visible.length) {
    return (
      <div
        aria-label={`${title} image unavailable`}
        className="mb-8 grid aspect-[16/10] place-items-center rounded-xl border border-[#dbe1dc] bg-[#eeebe2] text-sm text-[#5b6964]"
        role="img"
      >
        Tour images coming soon
      </div>
    )
  }

  const handleOpen = (idx: number) => {
    setActiveIdx(idx)
    setLightboxOpen(true)
  }

  return (
    <>
      <section
        aria-label={`${title} gallery`}
        className={`group relative mb-8 overflow-hidden rounded-xl border border-[#dbe1dc] bg-[#eeebe2] shadow-xs ${
          visible.length > 1
            ? 'grid grid-cols-1 sm:grid-cols-[1.5fr_0.8fr] sm:grid-rows-2 gap-2'
            : ''
        }`}
      >
        {visible.map((item, index) => (
          <figure
            key={item.id}
            className={`group/fig relative m-0 cursor-pointer overflow-hidden ${
              index === 0 && visible.length > 1
                ? 'sm:row-span-2 min-h-[320px] sm:min-h-[440px]'
                : 'min-h-[210px] hidden sm:block'
            }`}
            onClick={() => handleOpen(index)}
          >
            <img
              alt={item.caption || `${title} view ${index + 1}`}
              className="h-full min-h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
              src={item.url}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-200 group-hover/fig:bg-black/20 group-hover/fig:opacity-100">
              <span className="flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs">
                <Icon name="search" /> View photo
              </span>
            </div>
          </figure>
        ))}

        {media.length > 1 && (
          <button
            type="button"
            onClick={() => handleOpen(0)}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-black/90 cursor-pointer"
          >
            <Icon name="search" />
            <span>Show all {media.length} photos</span>
          </button>
        )}
      </section>

      <Lightbox
        isOpen={lightboxOpen}
        items={lightboxItems}
        initialIndex={activeIdx}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}

function getSpecIcon(label: string): string {
  const map: Record<string, string> = {
    Duration: '⏱️',
    Route: '📍',
    'Trip level': '🧗',
    'Next departure': '📅',
    'Travel dates': '📅',
    'Seats left': '👥',
    Group: '👥',
  }
  return map[label] ?? 'ℹ️'
}

function DetailPage({
  title,
  subtitle,
  summary,
  media,
  meta,
  price,
  priceNote,
  actionLabel,
  checkoutTo,
  checklist,
  tour,
  similarCount = 0,
  children,
}: {
  title: string
  subtitle: string
  summary?: string
  media: MediaAsset[]
  meta: [string, string][]
  price: string
  priceNote: string
  actionLabel: string
  checkoutTo: string
  checklist: string[]
  tour?: Tour
  similarCount?: number
  children: ReactNode
}) {
  return (
    <PageContainer as="main" className="py-8 sm:py-12">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[#5b6964]">
        <Link to="/" className="hover:text-[#0d7769]">Home</Link>
        <span>/</span>
        <Link to="/tours" className="hover:text-[#0d7769]">Tours</Link>
        <span>/</span>
        <span className="text-[#13231f] font-medium truncate max-w-[240px] sm:max-w-md">{title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
        <div className="min-w-0">
          <HeroGallery media={media} title={title} />

          {/* Heading Block */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a4f16]">
                {subtitle}
              </p>
              {tour && (
                <WishlistButton
                  id={tour.id}
                  title={tour.title}
                  image={tour.image}
                  duration={tour.duration}
                  price={tour.price}
                  serviceType="tour"
                />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#13231f] sm:text-3xl lg:text-4xl">
              {title}
            </h1>

            {/* Quick in-page anchor links */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href="#departures-section"
                className="inline-flex items-center gap-1 rounded-md bg-[#e4f3ef] px-2.5 py-1 text-xs font-semibold text-[#0d7769] hover:bg-[#d0ece4] transition-colors"
              >
                <span>Dates & departures</span>
                <span className="text-[11px]">↓</span>
              </a>
              {similarCount > 0 && (
                <a
                  href="#similar-tours"
                  className="inline-flex items-center gap-1 rounded-md border border-[#dbe1dc] bg-white px-2.5 py-1 text-xs font-medium text-[#5b6964] hover:text-[#0d7769] hover:border-[#0d7769] transition-colors"
                >
                  <span>Similar tours ({similarCount})</span>
                  <span className="text-[11px]">↓</span>
                </a>
              )}
            </div>

            {summary ? (
              <p className="mt-4 text-base leading-relaxed text-[#5b6964]">{summary}</p>
            ) : null}
          </div>

          {/* Trip Specs Strip */}
          <TourSpecsStrip
            specs={meta
              .filter(([, value]) => value && value !== 'To be confirmed')
              .map(([label, value]) => ({ icon: getSpecIcon(label), label, value }))}
          />

          {children}
        </div>

        {/* Desktop Sticky Summary Sidebar */}
        <aside className="hidden lg:block sticky top-[92px] rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#f0f3f1] pb-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
              Trip Reservation
            </span>
            {tour && (
              <WishlistButton
                id={tour.id}
                title={tour.title}
                image={tour.image}
                duration={tour.duration}
                price={tour.price}
                serviceType="tour"
              />
            )}
          </div>

          <div className="text-2xl font-bold text-[#0d7769]">{price}</div>
          <p className="mt-1 text-xs leading-relaxed text-[#5b6964]">{priceNote}</p>

          <ul className="my-5 space-y-2.5 border-y border-[#f0f3f1] py-4 text-xs text-[#5b6964]">
            {checklist.map((item) => (
              <li className="flex items-start gap-2" key={item}>
                <span className="text-[#0d7769] mt-0.5 font-bold">
                  <Icon name="check" />
                </span>
                <span className="font-medium text-[#13231f]">{item}</span>
              </li>
            ))}
          </ul>

          <Button variant="primary" size="lg" fullWidth to={checkoutTo} iconRight={<Icon name="arrow" />}>
            {actionLabel}
          </Button>

          <div className="mt-4 flex flex-col gap-1 border-t border-[#f0f3f1] pt-3 text-xs">
            {similarCount > 0 && (
              <a
                href="#similar-tours"
                className="inline-flex items-center justify-between rounded-md px-2 py-1.5 font-medium text-[#5b6964] hover:text-[#0d7769] hover:bg-[#f7f8f5]"
              >
                <span>Similar tours ({similarCount})</span>
                <Icon name="arrow" />
              </a>
            )}
            <a
              href="#recently-viewed"
              className="inline-flex items-center justify-between rounded-md px-2 py-1.5 font-medium text-[#5b6964] hover:text-[#0d7769] hover:bg-[#f7f8f5]"
            >
              <span>Recently viewed items</span>
              <Icon name="arrow" />
            </a>
          </div>
        </aside>
      </div>
    </PageContainer>
  )
}
