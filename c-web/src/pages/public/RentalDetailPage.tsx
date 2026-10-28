import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getPublicCarCategories } from '../../utils/customerApi'
import { type Rental, formatCurrency } from '../../utils/data'
import { asRecord, mapRental, text } from '../../utils/customerMappers'
import {
  InfoBlock,
  PolicyPanel,
  WishlistButton,
  Lightbox,
  PageContainer,
  Button,
  MobileActionBar,
  DetailPageSkeleton,
} from '../../components/customer/index'
import { RecentlyViewed } from '../../components/customer/RecentlyViewed'
import { useRecentlyViewed } from '../../utils/recentlyViewed'
import { Icon } from '../../components/Icon'

export function RentalDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [liveRental, setLiveRental] = useState<Rental | null>(null)
  const [status, setStatus] = useState('Loading rental details…')

  useEffect(() => {
    let mounted = true

    if (!id) {
      return () => {
        mounted = false
      }
    }

    getPublicCarCategories().then((result) => {
      if (!mounted) {
        return
      }

      const liveRental = result.data?.data?.find((item) => text(asRecord(item).id, '') === id)
      if (liveRental) {
        setLiveRental(mapRental(liveRental, 0))
      } else {
        setStatus(result.error ?? 'Rental vehicle not found.')
      }
    })

    return () => {
      mounted = false
    }
  }, [id])

  useRecentlyViewed({
    id: liveRental?.id ?? '',
    title: liveRental?.name ?? '',
    image: liveRental?.image,
    type: 'rental',
  })

  if (!liveRental) {
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

  const rental = liveRental
  const checkoutUrl = `/rentals/${rental.id}/checkout${location.search}`
  const priceFormatted = `${formatCurrency(rental.pricePerDay)} / day`

  return (
    <>
      <DetailPage
        title={rental.name}
        subtitle={`${rental.category} rental`}
        image={rental.image}
        meta={[
          ['Seats', `${rental.seats} seats`],
          ['Luggage', `${rental.luggage} bags`],
          ['Transmission', rental.transmission],
          ['Driver', 'Chauffeur included'],
        ]}
        price={priceFormatted}
        checkoutTo={checkoutUrl}
        rental={rental}
      >
        <InfoBlock title="Vehicle Features & Inclusions" items={rental.features} />
        <PolicyPanel text={rental.policy} />

        <div className="mt-6 flex items-start gap-4 rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-xs">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e4f3ef] text-[#0d7769]">
            <Icon name="car" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#13231f]">
              Chauffeur Assignment & Confirmation
            </h3>
            <p className="mt-1 text-sm text-[#5b6964] leading-relaxed">
              Driver included with every car. Your verified chauffeur and vehicle number will appear in your booking details after operator assignment.
            </p>
          </div>
        </div>
      </DetailPage>

      <PageContainer className="pb-24 md:pb-16">
        <section id="recently-viewed" className="border-t border-[#dbe1dc] pt-10">
          <RecentlyViewed items={[]} />
        </section>
      </PageContainer>

      {/* Mobile Sticky Action Bar */}
      <MobileActionBar
        label="Chauffeur Car Rental"
        price={priceFormatted}
        subtext="Driver included with every car"
        action={
          <Button variant="primary" size="md" to={checkoutUrl} className="min-h-[44px]">
            Start booking
          </Button>
        }
      />
    </>
  )
}

function DetailPage({
  title,
  subtitle,
  image,
  meta,
  price,
  checkoutTo,
  rental,
  children,
}: {
  title: string
  subtitle: string
  image: string
  meta: [string, string][]
  price: string
  checkoutTo: string
  rental?: Rental
  children: ReactNode
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <PageContainer as="main" className="py-8 sm:py-12">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[#5b6964]">
        <Link to="/" className="hover:text-[#0d7769]">Home</Link>
        <span>/</span>
        <Link to="/rentals" className="hover:text-[#0d7769]">Rent a Car</Link>
        <span>/</span>
        <span className="text-[#13231f] font-medium truncate max-w-[240px] sm:max-w-md">{title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
        <div className="min-w-0">
          <div
            className="group relative mb-6 cursor-pointer overflow-hidden rounded-xl border border-[#dbe1dc] bg-[#eeebe2] shadow-xs"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              alt={title}
              className="aspect-[16/10] sm:aspect-[16/9] h-auto w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              src={image}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-200 group-hover:bg-black/20 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-lg border border-white/40 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs">
                <Icon name="search" /> View vehicle photo
              </span>
            </div>
            {rental && (
              <div className="absolute right-4 top-4 z-10" onClick={(e) => e.stopPropagation()}>
                <WishlistButton
                  id={rental.id}
                  title={rental.name}
                  image={rental.image}
                  price={rental.pricePerDay}
                  serviceType="rental"
                />
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a4f16]">
                {subtitle}
              </p>
              {rental && (
                <WishlistButton
                  id={rental.id}
                  title={rental.name}
                  image={rental.image}
                  price={rental.pricePerDay}
                  serviceType="rental"
                />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#13231f] sm:text-3xl lg:text-4xl">
              {title}
            </h1>
          </div>

          <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {meta.map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-[#dbe1dc] bg-white p-3.5 shadow-xs"
              >
                <span className="block text-xs font-medium uppercase tracking-wider text-[#5b6964]">
                  {label}
                </span>
                <strong className="mt-1 block text-sm font-bold text-[#13231f]">{value}</strong>
              </div>
            ))}
          </div>

          {children}
        </div>

        {/* Desktop Sticky Summary */}
        <aside className="hidden lg:block sticky top-[92px] rounded-xl border border-[#dbe1dc] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#f0f3f1] pb-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9a4f16]">
              Rental Rate
            </span>
            {rental && (
              <WishlistButton
                id={rental.id}
                title={rental.name}
                image={rental.image}
                price={rental.pricePerDay}
                serviceType="rental"
              />
            )}
          </div>

          <div className="text-2xl font-bold text-[#0d7769]">{price}</div>
          <p className="mt-1 text-xs text-[#0d7769] font-medium">Driver included with every car</p>
          <p className="mt-2 text-xs leading-relaxed text-[#5b6964]">
            Includes verified chauffeur, vehicle sanitization, and basic insurance. Extra distance and state permits are calculated clearly at checkout.
          </p>

          <div className="mt-6">
            <Button variant="primary" size="lg" fullWidth to={checkoutTo} iconRight={<Icon name="arrow" />}>
              Start booking
            </Button>
          </div>
        </aside>
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        items={[{ url: image, caption: `${title} - ${subtitle}`, type: 'image' }]}
        onClose={() => setLightboxOpen(false)}
      />
    </PageContainer>
  )
}
