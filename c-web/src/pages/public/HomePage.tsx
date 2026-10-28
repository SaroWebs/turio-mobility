import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../../components/Icon'
import { TourCardSkeleton } from '../../components/customer/index'
import { getPublicBootstrap } from '../../utils/customerApi'
import { mapDestination, mapTour } from '../../utils/customerMappers'
import { formatCurrency, type Destination, type Tour } from '../../utils/data'
import './HomePage.css'
import { TravelHero } from '../../components/customer/TravelHero'

const photo = (id: string, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
const mountain = photo('photo-1464822759023-fed622ff2c3b', 2000)
const escapes = [
  { name: 'bali', region: 'ISLAND LIFE', image: photo('photo-1537996194471-e657df975ab4'), query: 'Bali' },
  { name: 'istanbul', region: 'TURKEY', image: photo('photo-1524231757912-21f4fe3a7200'), query: 'Istanbul' },
  { name: 'tokyo', region: 'JAPAN', image: photo('photo-1493976040374-85c8e12f0c0e'), query: 'Tokyo' },
]
const inspiration = [
  { name: 'Bali', region: 'Island escapes', image: escapes[0].image },
  { name: 'The Himalayas', region: 'Mountain adventures', image: mountain },
  { name: 'Japan', region: 'Culture & discovery', image: escapes[2].image },
  { name: 'Turkey', region: 'Timeless journeys', image: escapes[1].image },
  { name: 'Alpine lakes', region: 'Into the outdoors', image: photo('photo-1470770841072-f978cf4d019e') },
]
const benefits: { icon: IconName; title: string; copy: string }[] = [
  { icon: 'search', title: 'Explore attractions', copy: 'Find a little adventure in every destination, with tours, attractions and more.' },
  { icon: 'ticket', title: 'Simple and flexible', copy: 'Compare trips, choose your dates and find a journey that feels like you.' },
  { icon: 'help', title: 'Here to help you', copy: 'From your first question to your next adventure, our support team is here.' },
]

export function HomePage() {
  const navigate = useNavigate()
  const [tours, setTours] = useState<Tour[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')
  const [guests, setGuests] = useState('')
  const [activeDestination, setActiveDestination] = useState('All')

  useEffect(() => {
    let active = true
    getPublicBootstrap().then((response) => {
      if (!active) return
      setTours((response.data?.data?.featured_tours ?? []).map(mapTour))
      setDestinations((response.data?.data?.featured_destinations ?? []).map(mapDestination))
      setError(response.error || '')
    }).catch(() => {
      if (active) setError('We could not load tours right now. Please try again shortly.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function search(event: FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (date) params.set('date', date)
    if (guests) params.set('guests', guests)
    navigate(`/tours${params.size ? `?${params}` : ''}`)
  }

  const tabs = ['All', ...new Set(tours.map(tour => tour.destination).filter(Boolean))].slice(0, 5)
  const visibleTours = tours.filter(tour => activeDestination === 'All' || tour.destination === activeDestination).slice(0, 2)
  const places = destinations.length ? destinations.slice(0, 5).map(destination => ({
    name: destination.name, region: destination.region, image: destination.image || mountain, to: `/destinations/${destination.id}`,
  })) : inspiration.map(place => ({ ...place, to: `/tours?q=${encodeURIComponent(place.name)}` }))

  return (
    <div className="tour-home">
      <TravelHero service="tours">
            <form className="tour-search" onSubmit={search}>
              <label className="tour-search-place"><Icon name="map" /><span><strong>City or region</strong><input aria-label="City or region" placeholder="Where do you want to go?" value={query} onChange={event => setQuery(event.target.value)} /></span></label>
              <label><span><strong>Departure date</strong><input aria-label="Departure date" type="date" value={date} onChange={event => setDate(event.target.value)} /></span></label>
              <label><span><strong>Travelers</strong><input aria-label="Travelers" type="number" min="1" placeholder="Add guests" value={guests} onChange={event => setGuests(event.target.value)} /></span></label>
              <button type="submit" aria-label="Find tours"><Icon name="search" /><span>Find tours</span></button>
            </form>
      </TravelHero>

      <section className="tour-benefits tour-container" aria-label="Travel with Turiya Mobility">
        {benefits.map(benefit => <article key={benefit.title}><div className="tour-benefit-icon"><Icon name={benefit.icon} /></div><h2>{benefit.title}</h2><p>{benefit.copy}</p></article>)}
      </section>

      <section className="tour-offers tour-section">
        <div className="tour-container">
          <div className="tour-section-heading"><h2>Extraordinary escapes</h2><p>A little inspiration for your next great adventure.</p></div>
          <div className="tour-escape-grid">{escapes.map(place => <Link className="tour-escape" to={`/tours?q=${encodeURIComponent(place.query)}`} key={place.name}>
            <img src={place.image} alt={`${place.query} travel inspiration`} loading="lazy" />
            <div><h3>{place.name}</h3><p>{place.region}</p><span>Explore place <Icon name="arrow" /></span></div>
          </Link>)}</div>
        </div>
      </section>

      <section className="tour-featured tour-container tour-section" aria-labelledby="featured-title">
        <h2 id="featured-title">Featured Attractions</h2>
        <div className="tour-tabs" aria-label="Filter attractions by destination">{tabs.map(tab => <button type="button" key={tab} aria-pressed={activeDestination === tab} onClick={() => setActiveDestination(tab)}>{tab === 'All' ? 'All attractions' : tab}</button>)}</div>
        <div className="tour-feature-grid">
          {loading ? <><TourCardSkeleton /><TourCardSkeleton /></> : visibleTours.length ? visibleTours.map(tour => <Link className="tour-attraction" to={`/tours/${tour.id}`} key={tour.id}>
            <div className="tour-attraction-image"><img src={tour.image || mountain} alt={tour.title} loading="lazy" />{tour.rating > 0 && <span><Icon name="star" />{tour.rating.toFixed(1)}</span>}</div>
            <div className="tour-attraction-copy"><h3>{tour.title}</h3><p><Icon name="map" />{tour.destination}</p><div><strong>{formatCurrency(tour.price)}</strong>{Boolean(tour.originalPrice && tour.originalPrice > tour.price) && <del>{formatCurrency(tour.originalPrice!)}</del>}<small> / person</small></div></div>
          </Link>) : <div className="tour-empty" role="status"><Icon name="compass" /><h3>{error ? 'A small detour' : 'Your next adventure is on its way'}</h3><p>{error || 'New attractions will appear here as they become available.'}</p><Link to="/tours">Browse all tours <Icon name="arrow" /></Link></div>}
          <Link className="tour-discover" to="/tours"><img src={photo('photo-1507699622108-4be3abd695ad')} alt="Hot air balloons floating over a scenic valley" loading="lazy" /><div><h3>Explore more<br />Featured Attractions</h3><p>Find a new perspective. Discover experiences that make your trip memorable.</p><span>Explore now <Icon name="arrow" /></span></div></Link>
        </div>
        <div className="tour-banner"><img src={photo('photo-1493238792000-8113da705763', 1400)} alt="A peaceful camping escape in the mountains" loading="lazy" /><div><h2>A little planning.<br />A lot to look forward to.</h2><p>Find your next escape and make more of every mile.</p><Link to="/deals">Explore offers <Icon name="arrow" /></Link></div></div>
      </section>

      <section className="tour-popular tour-section" aria-labelledby="popular-title"><div className="tour-section-heading tour-container"><h2 id="popular-title">Most Popular Destinations</h2><p>From mountain mornings to island sunsets, discover your kind of getaway.</p></div>
        <div className="tour-destination-row">{places.map(place => <Link className="tour-destination" to={place.to} key={place.name}><img src={place.image} alt={place.name} loading="lazy" /><div><h3>{place.name}</h3><p>{place.region}</p></div></Link>)}</div>
        <Link className="tour-all-destinations" to="/destinations">Discover all destinations <Icon name="arrow" /></Link>
      </section>
    </div>
  )
}
