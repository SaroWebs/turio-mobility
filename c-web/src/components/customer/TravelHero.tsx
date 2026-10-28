import type { ReactNode } from 'react'
import { ServiceTabs } from './ServiceTabs'
import './TravelHero.css'

export type TravelService = 'rentals' | 'rides' | 'tours' | 'destinations'

const content: Record<TravelService, { title: string; description: string; image: string }> = {
  rentals: { title: 'Car rentals', description: 'Your itinerary. Your pace. A comfortable car and a local driver for every mile.', image: 'photo-1661030190121-f33d3f245838' },
  rides: { title: 'Fast rides', description: 'Choose your pickup and drop location. Check the fare, then find a driver.', image: 'photo-1732724081252-a0a92895558a' },
  tours: { title: 'Tours & attractions', description: 'Explore top attractions and guided tours to make every trip unforgettable.', image: 'photo-1464822759023-fed622ff2c3b' },
  destinations: { title: 'Discover your next destination', description: 'Beautiful places, local stories and unforgettable views. Find your next escape.', image: 'photo-1470770841072-f978cf4d019e' },
}

/** Shared service navigation and hero; each page owns its optional inputs and body. */
export function TravelHero({ service, title, children }: { service: TravelService; title?: string; children?: ReactNode }) {
  const current = content[service]
  return (
    <section className={`travel-hero travel-hero-${service}`} aria-labelledby="travel-hero-title">
      <img className="travel-hero-image" src={`https://images.unsplash.com/${current.image}?auto=format&fit=crop&w=2000&q=85`} alt="" fetchPriority="high" />
      <div className="travel-hero-content">
        <h1 id="travel-hero-title">{title || current.title}</h1>
        <p>{current.description}</p>
        <div className={`travel-hero-panel${children ? ' travel-hero-panel-with-inputs' : ''}`}>
          <ServiceTabs service={service} />
          {children && <div className="travel-hero-inputs">{children}</div>}
        </div>
      </div>
    </section>
  )
}
