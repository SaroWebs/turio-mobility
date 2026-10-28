import { TravelHero } from '../../components/customer/TravelHero'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  RentalCard,
  RentalCardSkeleton,
  PageContainer,
  Button,
  StatePanel,
} from '../../components/customer/index'
import { Icon } from '../../components/Icon'
import { getPublicCarCategories } from '../../utils/customerApi'
import { mapRental, tomorrowDate } from '../../utils/customerMappers'
import type { Rental } from '../../utils/data'

function defaultReturnDate() {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  return date.toISOString().slice(0, 10)
}

export function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickup, setPickup] = useState(() => searchParams.get('pickup') ?? '')
  const [dropoff, setDropoff] = useState(() => searchParams.get('dropoff') ?? '')
  const [pickupDate, setPickupDate] = useState(() => searchParams.get('date') ?? tomorrowDate())
  const [returnDate, setReturnDate] = useState(() => searchParams.get('returnDate') ?? defaultReturnDate())
  const mode = 'Driver included'
  const [category, setCategory] = useState('All')
  const [catalogRentals, setCatalogRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Loading rental catalogue…')

  const categories = ['All', ...Array.from(new Set(catalogRentals.map((rental) => rental.category)))]
  const visibleRentals =
    category === 'All'
      ? catalogRentals
      : catalogRentals.filter((rental) => rental.category === category)

  useEffect(() => {
    let mounted = true
    getPublicCarCategories().then((result) => {
      if (!mounted) return
      setLoading(false)
      if (result.error) {
        setCatalogRentals([])
        setStatus(result.error)
        return
      }
      const liveRentals = result.data?.data?.map(mapRental) ?? []
      setCatalogRentals(liveRentals)
      // Distinguish catalogue listings from server-confirmed availability
      setStatus(
        liveRentals.length
          ? 'Browse car categories with verified chauffeurs'
          : 'No rental vehicles are currently available',
      )
    })
    return () => {
      mounted = false
    }
  }, [])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchParams({ pickup, dropoff, date: pickupDate, returnDate, mode })
  }

  return (
    <>
      <TravelHero service="rentals">
        <form
          className="hero-search-bar hero-rental-search"
          onSubmit={submitSearch}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rental-pickup" className="text-sm font-semibold text-[#13231f]">
              Pickup area
            </label>
            <input
              id="rental-pickup"
              name="pickup"
              onChange={(event) => setPickup(event.target.value)}
              placeholder="City, airport, or hotel"
              required
              type="text"
              value={pickup}
              className="min-h-12 rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2.5 text-base text-[#13231f] focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rental-dropoff" className="text-sm font-semibold text-[#13231f]">
              Drop-off area
            </label>
            <input
              id="rental-dropoff"
              name="dropoff"
              onChange={(event) => setDropoff(event.target.value)}
              placeholder="Same place or another city"
              type="text"
              value={dropoff}
              className="min-h-12 rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2.5 text-base text-[#13231f] focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rental-from" className="text-sm font-semibold text-[#13231f]">
              From
            </label>
            <input
              id="rental-from"
              name="date"
              onChange={(event) => setPickupDate(event.target.value)}
              required
              type="date"
              value={pickupDate}
              className="min-h-12 rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2.5 text-base text-[#13231f] focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rental-until" className="text-sm font-semibold text-[#13231f]">
              Until
            </label>
            <input
              id="rental-until"
              min={pickupDate}
              name="returnDate"
              onChange={(event) => setReturnDate(event.target.value)}
              required
              type="date"
              value={returnDate}
              className="min-h-12 rounded-lg border border-[#dbe1dc] bg-white px-3.5 py-2.5 text-base text-[#13231f] focus:border-[#0d7769] focus:outline-3 focus:outline-[#0d7769]/20"
            />
          </div>

          

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            iconRight={<Icon name="arrow" />}
            className="sm:col-span-2 min-h-12"
          >
            Find cars
          </Button>
        </form></TravelHero>
    <PageContainer className="py-8 sm:py-12">
      <div className="mb-6">
        <div>
          <div className="mb-6"><h2 className="text-2xl font-bold text-[#202b3b]">Plan your rental</h2><p className="mt-3 text-sm leading-relaxed text-[#647184]">{status}. Driver included with every car.</p></div>
        </div>

        
      </div>

      {/* Filter and Count Bar */}
      <div className="my-8 flex flex-wrap items-center justify-between gap-4 border-y border-[#dbe1dc] py-4">
        <p className="m-0 text-sm text-[#5b6964]">
          <strong className="text-[#13231f] font-bold">{visibleRentals.length} vehicle categories</strong> · {mode}
        </p>

        <div aria-label="Filter rental cars by category" className="flex flex-wrap gap-2">
          {categories.map((item) => {
            const active = category === item
            return (
              <button
                aria-pressed={active}
                className={`min-h-10 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'border-[#0d7769] bg-[#e4f3ef] text-[#0d7769]'
                    : 'border-[#dbe1dc] bg-white text-[#5b6964] hover:border-[#0d7769]'
                }`}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {item}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <RentalCardSkeleton key={i} />
          ))}
        </div>
      ) : !visibleRentals.length ? (
        <StatePanel
          type="empty"
          title="No vehicles match this category"
          description="Try choosing 'All' categories to view all available car options."
          actionLabel="View all vehicles"
          onAction={() => setCategory('All')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleRentals.map((rental) => (
            <RentalCard key={rental.id} rental={rental} />
          ))}
        </div>
      )}
    </PageContainer>
    </>
  )
}
