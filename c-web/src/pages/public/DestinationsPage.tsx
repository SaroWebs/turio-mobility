import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicDestinations, getPublicTours } from '../../utils/customerApi'
import type { Destination } from '../../utils/data'
import { mapDestination, mapTour, attachToursToDestinations } from '../../utils/customerMappers'
import { DestinationCardSkeleton, StatePanel } from '../../components/customer/index'
import { WishlistButton } from '../../components/customer/WishlistButton'
import { Icon } from '../../components/Icon'
import { CatalogHero } from './CatalogHero'

export function DestinationsPage() {
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState('featured')
  const [catalogDestinations, setCatalogDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      const [places, tours] = await Promise.allSettled([getPublicDestinations(), getPublicTours()])
      if (!mounted) return
      if (places.status === 'rejected' || places.value.error) {
        setError(places.status === 'fulfilled' ? places.value.error || 'Could not load destinations.' : 'Could not load destinations. Please try again.')
      } else {
        const destinations = (places.value.data?.data ?? []).map(mapDestination)
        const liveTours = tours.status === 'fulfilled' && !tours.value.error ? (tours.value.data?.data ?? []).map(mapTour) : []
        setCatalogDestinations(liveTours.length ? attachToursToDestinations(destinations, liveTours) : destinations)
        setError('')
      }
      setLoading(false)
    }
    void load()
    return () => { mounted = false }
  }, [retry])

  const regions = [...new Set(catalogDestinations.map(destination => destination.region).filter(Boolean))].sort()
  const visibleDestinations = catalogDestinations.filter(destination => {
    const haystack = `${destination.name} ${destination.region} ${destination.summary} ${destination.tags.join(' ')}`.toLowerCase()
    return (!region || destination.region === region) && haystack.includes(query.trim().toLowerCase())
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'rating' ? b.rating - a.rating : 0)

  function clearFilters() { setQuery(''); setRegion('') }

  return (
    <div className="travel-catalog destinations-catalog">
      <CatalogHero kind="destinations"><div className="hero-search-bar hero-destination-search"><label htmlFor="destination-search"><strong>City, region or interest</strong><input id="destination-search" type="search" placeholder="Where do you want to explore?" value={query} onChange={event => setQuery(event.target.value)} /></label><span className="hero-search-symbol" aria-hidden="true"><Icon name="search" /></span></div></CatalogHero>
      <div className="catalog-container catalog-content">
        <div className="destination-toolbar">
          <div className="catalog-region-tabs" aria-label="Filter destinations by region"><button type="button" aria-pressed={!region} onClick={() => setRegion('')}>All destinations</button>{regions.map(item => <button type="button" key={item} aria-pressed={region === item} onClick={() => setRegion(item)}>{item}</button>)}</div>
          <label className="catalog-sort">Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured</option><option value="name">Name: A to Z</option><option value="rating">Highest rated</option></select></label>
        </div>
        <div className="destination-results-heading"><div><p className="catalog-eyebrow">Your next chapter starts here</p><h2>Places worth the journey</h2><p role="status" aria-live="polite">{loading ? 'Finding beautiful places...' : error ? 'Destinations are temporarily unavailable.' : `${visibleDestinations.length} ${visibleDestinations.length === 1 ? 'destination' : 'destinations'} to explore${region ? ` in ${region}` : ''}`}</p></div>{(query || region) && <button type="button" onClick={clearFilters}>Clear filters <Icon name="x" /></button>}</div>
        {loading ? <div className="destination-grid">{Array.from({ length: 6 }, (_, index) => <DestinationCardSkeleton key={index} />)}</div> : error ? <StatePanel type="error" title="A small detour" description={error} actionLabel="Try again" onAction={() => { setLoading(true); setRetry(value => value + 1) }} /> : visibleDestinations.length ? <div className="destination-grid">{visibleDestinations.map(destination => <article className="catalog-destination-card" key={destination.id}>
          <div className="catalog-destination-photo"><Link to={`/destinations/${destination.id}`} aria-label={`Explore ${destination.name}`}><img src={destination.image || 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80'} alt={destination.name} loading="lazy" /></Link><div className="catalog-destination-wishlist"><WishlistButton id={destination.id} title={destination.name} image={destination.image} serviceType="destination" /></div>{destination.region && <span className="catalog-place-region"><Icon name="map" />{destination.region}</span>}</div>
          <div className="catalog-destination-info"><div className="catalog-destination-title"><h3><Link to={`/destinations/${destination.id}`}>{destination.name}</Link></h3>{destination.rating > 0 && <span><Icon name="star" />{destination.rating.toFixed(1)}</span>}</div><p>{destination.summary || 'Discover local highlights and plan a memorable escape.'}</p><div className="catalog-place-tags">{destination.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div><div className="catalog-destination-bottom"><span><Icon name="compass" />{destination.activeTours.length ? `${destination.activeTours.length} ${destination.activeTours.length === 1 ? 'tour' : 'tours'} to explore` : 'Discover this place'}</span><Link to={`/destinations/${destination.id}`} aria-label={`Explore ${destination.name}`}>Explore <Icon name="arrow" /></Link></div></div>
        </article>)}</div> : <StatePanel title={query || region ? 'No places found this time' : 'New destinations are on their way'} description={query || region ? 'Try another region or a broader search to find your next escape.' : 'Check back soon for more places to explore.'} actionLabel={query || region ? 'Clear filters' : undefined} onAction={clearFilters} />}
        <aside className="catalog-help-banner"><div className="catalog-help-icon"><Icon name="compass" /></div><div><h2>A destination is just the beginning.</h2><p>Find a guided tour and turn a place on your wishlist into your next adventure.</p></div><Link to="/tours">Explore tours <Icon name="arrow" /></Link></aside>
      </div>
    </div>
  )
}
