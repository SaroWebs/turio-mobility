import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../Icon'
import type { TravelService } from './TravelHero'

const services: { key: TravelService; label: string; to: string; icon: IconName }[] = [
  { key: 'rentals', label: 'Car rentals', to: '/rentals', icon: 'car' },
  { key: 'rides', label: 'Fast rides', to: '/rides', icon: 'map' },
  { key: 'tours', label: 'Tours & attractions', to: '/tours', icon: 'compass' },
  { key: 'destinations', label: 'Destinations', to: '/destinations', icon: 'grid' },
]

export function ServiceTabs({
  service,
  compact = false,
}: {
  service?: TravelService
  compact?: boolean
}) {
  return (
    <nav
      aria-label="Explore travel services"
      className={`travel-service-tabs${compact ? ' travel-service-tabs-compact' : ''}`}
    >
      {services.map((item) => (
        <Link
          aria-current={service === item.key ? 'page' : undefined}
          key={item.key}
          to={item.to}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
