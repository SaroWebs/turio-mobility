import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../Icon'

const journeys: Array<{
  title: string
  description: string
  icon: IconName
  color: string
  to: string
  action: string
  steps: string[]
}> = [
  {
    title: 'Point ride (Mobile App)',
    description: 'Instant point-to-point cabs with live driver matching, map tracking, and seamless checkout on the Turiya Mobility app.',
    icon: 'car',
    color: 'bg-[#d8f3eb] text-[#0c6559]',
    to: '/rides',
    action: 'Download App',
    steps: ['Mobile App', 'Driver matching', 'Live route', 'Seamless ride'],
  },
  {
    title: 'Planned tour',
    description: 'Compare real departures, seats, itineraries, inclusions, and protection before checkout.',
    icon: 'ticket',
    color: 'bg-[#fff0d8] text-[#99540e]',
    to: '/tours',
    action: 'Explore tours',
    steps: ['Discover', 'Schedule', 'Guests', 'Itinerary'],
  },
  {
    title: 'Car rental',
    description: 'Choose dates and vehicle first, then keep handover, driver, payment, and return in one record.',
    icon: 'car',
    color: 'bg-[#e7e5ff] text-[#5746a8]',
    to: '/rentals',
    action: 'Find a car',
    steps: ['Dates', 'Vehicle', 'Handover', 'Return'],
  },
]

const systemFeatures: Array<{
  title: string
  description: string
  eyebrow: string
  icon: IconName
  to: string
}> = [
  { eyebrow: 'Before', title: 'Transparent protection', description: 'Review provider, coverage, exclusions, terms version, and claim path before accepting.', icon: 'shield', to: '/insurance' },
  { eyebrow: 'During', title: 'One live journey view', description: 'Driver, vehicle, route, check-in, and the next expected status stay together.', icon: 'compass', to: '/tracking' },
  { eyebrow: 'After', title: 'Receipts and wallet trail', description: 'Payments, refunds, tips, and booking references remain connected and readable.', icon: 'wallet', to: '/wallet' },
  { eyebrow: 'Anytime', title: 'Ticketed human support', description: 'Ask a general question or attach a booking. Every request receives a trackable reference.', icon: 'help', to: '/support' },
]

export function JourneySystem() {
  return (
    <>
      <section aria-labelledby="journey-system-title" className="hm-section">
        <div className="hm-section-heading">
          <div>
            <p className="hm-kicker">One travel system · three clear paths</p>
            <h2 id="journey-system-title">Know what happens next.</h2>
          </div>
          <p>Each service keeps its own booking lifecycle, while payment, support, and account history stay familiar across every journey.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {journeys.map((journey, index) => (
            <article className="hm-journey-card group" key={journey.title}>
              <div className="flex items-start justify-between gap-4">
                <span className={`hm-icon-tile ${journey.color}`}><Icon name={journey.icon} /></span>
                <span className="text-xs font-black tracking-[0.18em] text-[#8b948f]">0{index + 1}</span>
              </div>
              <h3>{journey.title}</h3>
              <p>{journey.description}</p>
              <ol aria-label={`${journey.title} process`} className="hm-progress-line">
                {journey.steps.map((step, stepIndex) => (
                  <li key={step}>
                    <span>{stepIndex + 1}</span>
                    <small>{step}</small>
                  </li>
                ))}
              </ol>
              <Link className="hm-card-action" to={journey.to}>{journey.action}<Icon name="arrow" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="travel-control-title" className="hm-section">
        <div className="hm-control-panel">
          <div className="hm-control-intro">
            <p className="hm-kicker text-[#9cddcf]">Your trip, held together</p>
            <h2 id="travel-control-title">From first idea to final receipt.</h2>
            <p>Turiya Mobility is designed around continuity: the context you provide once should make every later decision easier.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="hm-button hm-button-light" to="/bookings">Open my journeys</Link>
              <Link className="hm-button hm-button-ghost" to="/support">Ask support</Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {systemFeatures.map((feature) => (
              <Link className="hm-system-feature" key={feature.title} to={feature.to}>
                <span className="hm-feature-icon"><Icon name={feature.icon} /></span>
                <span>
                  <small>{feature.eyebrow}</small>
                  <strong>{feature.title}</strong>
                  <span>{feature.description}</span>
                </span>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="confidence-title" className="hm-section">
        <div className="hm-section-heading">
          <div>
            <p className="hm-kicker">Confidence before commitment</p>
            <h2 id="confidence-title">Nothing important should be hidden.</h2>
          </div>
        </div>
        <div className="grid overflow-hidden rounded-[28px] border border-[#dbe1dc] bg-white md:grid-cols-3">
          <Link className="hm-confidence-card" to="/policies/terms-and-conditions"><span>01</span><strong>Readable terms</strong><small>Booking, payment, cancellation, and customer responsibilities.</small></Link>
          <Link className="hm-confidence-card" to="/policies/insurance-policy"><span>02</span><strong>Insurance disclosure</strong><small>Provider identity, policy wording, limits, dates, and exclusions.</small></Link>
          <Link className="hm-confidence-card" to="/support"><span>03</span><strong>Help without booking</strong><small>Open a ticket even when you do not have a ride, tour, or rental.</small></Link>
        </div>
      </section>
    </>
  )
}
