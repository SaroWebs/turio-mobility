import { useEffect, useId, useRef, useState } from 'react'
import { searchPublicLocations, type LocationSearchResult } from '../../utils/customerApi'

type RideLocationInputProps = {
  kind: 'pickup' | 'dropoff'
  value: string
  onChange: (value: string) => void
  onSelect: (place: LocationSearchResult) => void
}

export function RideLocationInput({ kind, value, onChange, onSelect }: RideLocationInputProps) {
  const listId = useId()
  const requestSequence = useRef(0)
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = value.trim()
    if (!open || query.length < 3) return

    const sequence = ++requestSequence.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const response = await searchPublicLocations(query)
      if (sequence !== requestSequence.current) return
      setLoading(false)
      setResults((response.data?.results ?? []).filter((place) => place.lat !== null && place.lng !== null).slice(0, 6))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [open, value])

  const label = kind === 'pickup' ? 'Pickup' : 'Drop-off'

  return <label className="ride-location-field">
    <small>{kind === 'pickup' ? 'Pickup now' : 'Drop-off'}</small>
    <input
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={open && (loading || results.length > 0)}
      aria-label={label}
      autoComplete="off"
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onChange={(event) => { setResults([]); setLoading(false); onChange(event.target.value); setOpen(true) }}
      onFocus={() => setOpen(true)}
      placeholder={`Search ${label.toLowerCase()}`}
      role="combobox"
      value={value}
    />
    {open && value.trim().length >= 3 ? <div className="ride-location-results" id={listId} role="listbox">
      {loading ? <div className="ride-location-result-state" role="status">Searching places…</div> : null}
      {!loading && results.map((place) => <button
        key={place.id}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { onSelect(place); setOpen(false); setResults([]) }}
        role="option"
        type="button"
      >
        <strong>{place.name}</strong>
        <span>{place.address || place.type}</span>
      </button>)}
      {!loading && results.length === 0 ? <div className="ride-location-result-state">No matching places. Try a more specific search.</div> : null}
    </div> : null}
  </label>
}
