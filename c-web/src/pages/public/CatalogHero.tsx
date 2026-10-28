import type { ReactNode } from 'react'
import { TravelHero } from '../../components/customer/TravelHero'
import './Catalog.css'

export function CatalogHero({ kind, children }: { kind: 'tours' | 'destinations'; children?: ReactNode }) {
  return <TravelHero service={kind} title={kind === 'tours' ? 'Find your next tour' : undefined}>{children}</TravelHero>
}
