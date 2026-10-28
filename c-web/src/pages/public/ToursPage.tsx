import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  TourCard,
  PageContainer,
  Button,
  StatePanel,
  FilterSheet,
  FilterToggleButton,
  TourCardSkeleton,
} from '../../components/customer/index'
import { Icon } from '../../components/Icon'
import { getPublicTours } from '../../utils/customerApi'
import { mapTour } from '../../utils/customerMappers'
import type { Tour } from '../../utils/data'
import { formatCurrency } from '../../utils/data'
import { Link } from 'react-router-dom'
import { CatalogHero } from './CatalogHero'

// ─── Inline List-Row Component ───────────────────────────────────────────────

function TourListRow({ tour }: { tour: Tour }) {
  const location = useLocation()
  return (
    <Link
      to={`/tours/${tour.id}${location.search}`}
      className="catalog-list-card group flex min-h-[140px] overflow-hidden rounded-xl border border-[#dfe6ef] bg-white transition-shadow hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative w-[220px] shrink-0 overflow-hidden">
        <img
          src={tour.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80'}
          loading="lazy"
          alt={tour.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {tour.tourType === 'private' && (
          <span className="absolute left-2 top-2 rounded-full bg-[#9a4f16] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Private
          </span>
        )}
      </div>

      {/* Middle – info */}
      <div className="flex flex-1 flex-col justify-between gap-2 px-5 py-4">
        <div>
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-[#07499c]">
            {tour.category}
          </p>
          <h3 className="text-base font-semibold leading-snug text-[#202b3b] line-clamp-2 group-hover:text-[#07499c] transition-colors">
            {tour.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#647184]">
            <span className="flex items-center gap-1">
              <Icon name="map" />
              {tour.destination}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="clock" />
              {tour.duration}
            </span>
          </div>
        </div>

        {tour.highlights.length > 0 && (
          <p className="text-xs text-[#647184] line-clamp-2">
            {tour.highlights.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>

      {/* Right – price + CTA */}
      <div className="flex w-[180px] shrink-0 flex-col items-end justify-between border-l border-[#dfe6ef] px-4 py-4">
        <div className="text-right">
          {tour.originalPrice && (
            <p className="text-xs text-[#647184] line-through">
              {formatCurrency(tour.originalPrice)}
            </p>
          )}
          <p className="text-lg font-bold text-[#202b3b]">
            {formatCurrency(tour.price)}
          </p>
          <p className="text-[11px] text-[#647184]">per person</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {tour.rating > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[#e9f1ff] px-2 py-0.5 text-xs font-semibold text-[#07499c]">
              <Icon name="star" />
              {tour.rating.toFixed(1)}
            </span>
          )}
          <span className="rounded-lg bg-[#07499c] px-3 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-[#063776]">
            View Tour
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Difficulty Quick-Filter config ─────────────────────────────────────────

const DIFFICULTIES = [
  { label: 'All levels', icon: 'compass', value: '' },
  { label: 'Easy', icon: 'map', value: 'easy' },
  { label: 'Moderate', icon: 'shield', value: 'moderate' },
  { label: 'Challenging', icon: 'info', value: 'challenging' },
  { label: 'Extreme', icon: 'star', value: 'extreme' },
] as const

const DURATION_OPTIONS = [
  { label: 'Any duration', value: '' },
  { label: 'Day trip', value: 'day_trip' },
  { label: '2–3 days', value: '2_3_days' },
  { label: '4+ days', value: '4_plus_days' },
] as const

const PRICE_OPTIONS = [
  { label: 'Any price', value: '' },
  { label: 'Under ₹5,000', value: 'under_5k' },
  { label: '₹5,000–₹15,000', value: '5k_to_15k' },
  { label: 'Above ₹15,000', value: 'above_15k' },
] as const

const SORT_OPTIONS = [
  { label: 'Recommended', value: '' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Duration: Short to Long', value: 'duration' },
] as const

// ─── Active filter label helpers ─────────────────────────────────────────────

function getFilterLabel(key: string, value: string): string {
  if (key === 'q') return `Destination: ${value}`
  if (key === 'date') return `Date: ${value}`
  if (key === 'guests') return `Guests: ${value}`
  if (key === 'difficulty') {
    const found = DIFFICULTIES.find((option) => option.value === value)
    return `Difficulty: ${found ? found.label : value}`
  }
  if (key === 'duration') {
    const found = DURATION_OPTIONS.find((option) => option.value === value)
    return `Duration: ${found ? found.label : value}`
  }
  if (key === 'price_range') {
    const found = PRICE_OPTIONS.find((option) => option.value === value)
    return `Price: ${found ? found.label : value}`
  }
  return `${key}: ${value}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ToursPage() {
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const [result, setResult] = useState<{
    query: string
    tours: Tour[]
    total: number
    last: number
    error: string | null
  } | null>(null)
  const [retry, setRetry] = useState(0)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [mobileDifficulty, setMobileDifficulty] = useState(params.get('difficulty') || '')
  const [mobileDuration, setMobileDuration] = useState(params.get('duration') || '')
  const [mobilePriceRange, setMobilePriceRange] = useState(params.get('price_range') || '')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const sortBy = params.get('sort') || ''

  const loading = !result || result.query !== query

  useEffect(() => {
    const next = new URLSearchParams(query)
    if (!next.has('travel_style')) return
    next.delete('travel_style')
    setParams(next, { replace: true })
  }, [query, setParams])

  useEffect(() => {
    const controller = new AbortController()
    const filters = new URLSearchParams(query)
    filters.set('page', filters.get('page') || '1')
    filters.set('per_page', '20')
    filters.set('pagination', 'offset')

    getPublicTours(filters, controller.signal).then((response) => {
      if (controller.signal.aborted) return
      setResult({
        query,
        tours: response.data?.data?.map(mapTour) ?? [],
        total: response.data?.pagination?.total ?? 0,
        last: response.data?.pagination?.last_page ?? 1,
        error: response.error,
      })
    }).catch(() => {
      if (!controller.signal.aborted) {
        setResult({ query, tours: [], total: 0, last: 1, error: 'Could not load tours. Please try again.' })
      }
    })

    return () => controller.abort()
  }, [query, retry])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = new URLSearchParams()
    if (sortBy) next.set('sort', sortBy)
    for (const key of ['q', 'date', 'guests', 'difficulty', 'duration', 'price_range', 'category']) {
      const value = String(data.get(key) ?? '').trim()
      if (value) next.set(key, value)
    }
    const category = params.get('category')
    if (category) next.set('category', category)
    setParams(next)
  }

  const page = Number(params.get('page') || 1)

  function changePage(value: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(value))
    setParams(next)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  function handleClearFilters() {
    setParams({})
    setMobileDifficulty('')
    setMobileDuration('')
    setMobilePriceRange('')
    setFilterSheetOpen(false)
  }

  function handleApplyMobileFilters() {
    const next = new URLSearchParams(params)
    if (mobileDifficulty) next.set('difficulty', mobileDifficulty)
    else next.delete('difficulty')
    if (mobileDuration) next.set('duration', mobileDuration)
    else next.delete('duration')
    if (mobilePriceRange) next.set('price_range', mobilePriceRange)
    else next.delete('price_range')
    next.set('page', '1')
    setParams(next)
    setFilterSheetOpen(false)
  }

  function removeFilter(key: string) {
    const next = new URLSearchParams(params)
    next.delete(key)
    next.delete('page')
    setParams(next)
  }

  function setFilterParam(key: 'difficulty' | 'duration' | 'price_range', value: string) {
    const next = new URLSearchParams(params)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setParams(next)
  }

  const activeFilterCount = ['difficulty', 'duration', 'price_range'].filter((key) => Boolean(params.get(key))).length

  // Build active filter chips list (exclude 'page' and 'per_page')
  const CHIP_KEYS = ['q', 'date', 'guests', 'difficulty', 'duration', 'price_range']
  const activeChips = CHIP_KEYS.flatMap((key) => {
    const val = params.get(key)
    return val ? [{ key, value: val }] : []
  })

  const currentDifficulty = params.get('difficulty') || ''

  return (
    <div className="travel-catalog tours-catalog">
      <CatalogHero kind="tours"><form
          key={query}
          onSubmit={search}
          className="hero-search-bar hero-tour-search"
        >
          <div className="hero-search-fields">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tours-q" className="text-sm font-semibold text-[#202b3b]">
                Where would you like to go?
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3.5 text-[#647184]">
                  <Icon name="search" />
                </span>
                <input
                  id="tours-q"
                  name="q"
                  type="search"
                  defaultValue={params.get('q') || ''}
                  placeholder="Tawang, Shillong, Kaziranga..."
                  maxLength={120}
                  className="min-h-[48px] w-full rounded-lg border border-[#dfe6ef] bg-white pl-10 pr-3.5 py-2.5 text-base text-[#202b3b] placeholder:text-[#8a9893] transition-colors focus:border-[#07499c] focus:outline-3 focus:outline-[#07499c]/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="tours-date" className="text-sm font-semibold text-[#202b3b]">
                  Travel date
                </label>
                <span className="text-xs text-[#647184]">Optional</span>
              </div>
              <input
                id="tours-date"
                name="date"
                type="date"
                defaultValue={params.get('date') || ''}
                className="min-h-[48px] w-full rounded-lg border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-base text-[#202b3b] transition-colors focus:border-[#07499c] focus:outline-3 focus:outline-[#07499c]/20"
              />
              
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tours-guests" className="text-sm font-semibold text-[#202b3b]">
                Travellers
              </label>
              <input
                id="tours-guests"
                name="guests"
                type="number"
                min="1"
                max="200"
                defaultValue={params.get('guests') || '1'}
                required
                className="min-h-[48px] w-full rounded-lg border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-base text-[#202b3b] transition-colors focus:border-[#07499c] focus:outline-3 focus:outline-[#07499c]/20"
              />
            </div>

            <div className="flex items-end pt-1">
              <Button
                type="submit"
                size="lg"
                fullWidth
                icon={<Icon name="search" />}
                className="min-h-[48px]"
              >
                Find tours
              </Button>
            </div>
          </div>

          <details className="mt-4 border-t border-[#f0f3f1] pt-3 group">
            <summary className="cursor-pointer text-xs font-semibold text-[#647184] hover:text-[#07499c] transition-colors py-1 inline-flex items-center gap-1.5">
              <span>More choices</span>
              <span className="transform transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 max-w-sm">
              <label htmlFor="tours-difficulty" className="block text-xs font-medium text-[#647184] mb-1.5">
                Tour difficulty
              </label>
              <select
                id="tours-difficulty"
                name="difficulty"
                defaultValue={params.get('difficulty') || ''}
                className="min-h-[44px] w-full rounded-lg border border-[#dfe6ef] bg-white px-3 py-2 text-sm text-[#202b3b] focus:border-[#07499c] focus:outline-3 focus:outline-[#07499c]/20"
              >
                <option value="">All difficulty levels</option>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="challenging">Challenging</option>
                <option value="extreme">Extreme</option>
              </select>
              <label htmlFor="tours-duration" className="mt-3 block text-xs font-medium text-[#647184] mb-1.5">
                Tour duration
              </label>
              <select
                id="tours-duration"
                name="duration"
                defaultValue={params.get('duration') || ''}
                className="min-h-[44px] w-full rounded-lg border border-[#dfe6ef] bg-white px-3 py-2 text-sm text-[#202b3b] focus:border-[#07499c] focus:outline-3 focus:outline-[#07499c]/20"
              >
                {DURATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <label htmlFor="tours-price-range" className="mt-3 block text-xs font-medium text-[#647184] mb-1.5">
                Price per person
              </label>
              <select
                id="tours-price-range"
                name="price_range"
                defaultValue={params.get('price_range') || ''}
                className="min-h-[44px] w-full rounded-lg border border-[#dfe6ef] bg-white px-3 py-2 text-sm text-[#202b3b] focus:border-[#07499c] focus:outline-3 focus:outline-[#07499c]/20"
              >
                {PRICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </details>
        </form></CatalogHero>

      <PageContainer className="catalog-content py-8 sm:py-10">

        {/* Mobile filter toggle – visible on small screens */}
        <div className="mb-4 flex items-center justify-end md:hidden">
          <FilterToggleButton
            onClick={() => {
              setMobileDifficulty(params.get('difficulty') || '')
              setMobileDuration(params.get('duration') || '')
              setMobilePriceRange(params.get('price_range') || '')
              setFilterSheetOpen(true)
            }}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* ── Difficulty Quick-Filter Chips ───────────────────────────────── */}
        <div className="mb-5 mt-2">
          <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
            {DIFFICULTIES.map((difficulty) => {
              const isActive = currentDifficulty === difficulty.value
              return (
                <button
                  key={difficulty.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilterParam('difficulty', difficulty.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-[#07499c] bg-[#07499c] text-white'
                      : 'border-[#dfe6ef] bg-white text-[#647184] hover:border-[#07499c] hover:text-[#07499c]'
                  }`}
                >
                  <Icon name={difficulty.icon} />
                  <span>{difficulty.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Active Filter Chips Row + Sort + View Toggle ─────────────────── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: active chips */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {activeChips.length === 0 ? (
              <span className="inline-flex items-center rounded-full bg-[#e9f1ff] px-3 py-1 text-xs font-semibold text-[#07499c]">
                All Tours
              </span>
            ) : (
              activeChips.map(({ key, value }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe6ef] bg-white px-3 py-1 text-xs font-medium text-[#202b3b]"
                >
                  {getFilterLabel(key, value)}
                  <button
                    type="button"
                    aria-label={`Remove ${key} filter`}
                    onClick={() => removeFilter(key)}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#647184] transition-colors hover:bg-[#f0f3f1] hover:text-[#202b3b]"
                  >
                    <Icon name="x" />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Right: sort + view toggle */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Sort dropdown */}
            <select
              value={sortBy}
              aria-label="Sort tours"
              onChange={(event) => {
                const next = new URLSearchParams(params)
                if (event.target.value) next.set('sort', event.target.value)
                else next.delete('sort')
                next.delete('page')
                setParams(next)
              }}
              className="rounded-lg border border-[#dfe6ef] bg-white px-3 py-1.5 text-xs font-medium text-[#202b3b] focus:border-[#07499c] focus:outline-2 focus:outline-[#07499c]/20"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Grid / List toggle */}
            <div className="flex overflow-hidden rounded-lg border border-[#dfe6ef] bg-white">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`flex h-11 w-11 items-center justify-center transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#07499c] text-white'
                    : 'text-[#647184] hover:bg-[#f0f3f1]'
                }`}
              >
                <Icon name="grid" />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={`flex h-11 w-11 items-center justify-center transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#07499c] text-white'
                    : 'text-[#647184] hover:bg-[#f0f3f1]'
                }`}
              >
                <Icon name="list" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Result feedback ──────────────────────────────────────────────── */}
        <div className="mb-5 flex items-center justify-between text-sm text-[#647184]" role="status" aria-live="polite">
          <span>
            {loading
              ? 'Finding available tours...'
              : result?.error
                ? result.error
                : `${result?.total ?? 0} tours match your plans`}
          </span>
          {activeChips.length > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-[#07499c] hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* ── Loading State ────────────────────────────────────────────────── */}
        {loading && (
          <div className="catalog-tour-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <TourCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Error State ──────────────────────────────────────────────────── */}
        {!loading && result?.error && (
          <StatePanel
            type="error"
            title="Could not load tours"
            description={result.error}
            actionLabel="Try again"
            onAction={() => { setResult(null); setRetry((value) => value + 1) }}
          />
        )}

        {/* ── Enhanced Empty State ─────────────────────────────────────────── */}
        {!loading && !result?.error && !result?.tours.length && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="catalog-empty-icon"><Icon name="map" /></span>
            <h2 className="text-xl font-bold text-[#202b3b]">No tours match your search</h2>
            <p className="mt-2 max-w-sm text-sm text-[#647184]">
              Try removing some filters or search a different destination
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" size="md" onClick={handleClearFilters}>
                Clear All Filters
              </Button>
              <Button
                size="md"
                onClick={() => {
                  setParams({})
                  setMobileDifficulty('')
                  setMobileDuration('')
                  setMobilePriceRange('')
                }}
              >
                Browse All Tours
              </Button>
            </div>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {!loading && !result?.error && Boolean(result?.tours.length) && (
          viewMode === 'grid' ? (
            <div className="catalog-tour-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {result?.tours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {result?.tours.map((tour) => (
                <TourListRow key={tour.id} tour={tour} />
              ))}
            </div>
          )
        )}

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {!loading && !result?.error && (result?.last ?? 0) > 1 && (
          <nav aria-label="Tour result pages" className="mt-12 flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="md"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-medium text-[#647184]">
              Page {page} of {result?.last}
            </span>
            <Button
              variant="secondary"
              size="md"
              disabled={page >= (result?.last ?? 1)}
              onClick={() => changePage(page + 1)}
            >
              Next
            </Button>
          </nav>
        )}

        {/* ── Mobile Filter Sheet ──────────────────────────────────────────── */}
        <FilterSheet
          isOpen={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          onApply={handleApplyMobileFilters}
          onClear={() => {
            setMobileDifficulty('')
            setMobileDuration('')
            setMobilePriceRange('')
            handleClearFilters()
          }}
          totalResults={result?.total}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="mobile-difficulty" className="text-sm font-semibold text-[#202b3b]">
              Tour difficulty
            </label>
            <select
              id="mobile-difficulty"
              value={mobileDifficulty}
              onChange={(e) => setMobileDifficulty(e.target.value)}
              className="min-h-[48px] rounded-lg border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-base text-[#202b3b]"
            >
              <option value="">All difficulty levels</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="challenging">Challenging</option>
              <option value="extreme">Extreme</option>
            </select>
            <label htmlFor="mobile-duration" className="mt-3 text-sm font-semibold text-[#202b3b]">
              Tour duration
            </label>
            <select
              id="mobile-duration"
              value={mobileDuration}
              onChange={(event) => setMobileDuration(event.target.value)}
              className="min-h-[48px] rounded-lg border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-base text-[#202b3b]"
            >
              {DURATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label htmlFor="mobile-price-range" className="mt-3 text-sm font-semibold text-[#202b3b]">
              Price per person
            </label>
            <select
              id="mobile-price-range"
              value={mobilePriceRange}
              onChange={(event) => setMobilePriceRange(event.target.value)}
              className="min-h-[48px] rounded-lg border border-[#dfe6ef] bg-white px-3.5 py-2.5 text-base text-[#202b3b]"
            >
              {PRICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </FilterSheet>
      </PageContainer>
    </div>
  )
}
