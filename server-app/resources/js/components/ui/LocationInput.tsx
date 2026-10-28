import React, { useState, useRef, useEffect, useId } from 'react'
import { searchLocationsWithDebounce } from '@/lib/nominatim'
import { createAutocomplete, loadGoogleMaps } from '@/lib/google-maps'

interface SearchResult {
  id: string
  name: string
  address: string
  type: string
  lat?: number
  lng?: number
  city?: string
  state?: string
  country?: string
  rating?: number
  reviewCount?: number
}

interface LocationInputProps {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onLocationSelect?: (location: SearchResult) => void
  error?: string
  required?: boolean
}

const LocationInput: React.FC<LocationInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onLocationSelect,
  error,
  required = false
}) => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const onChangeRef = useRef(onChange)
  const onLocationSelectRef = useRef(onLocationSelect)
  const valueRef = useRef(value)
  onChangeRef.current = onChange
  onLocationSelectRef.current = onLocationSelect
  valueRef.current = value

  useEffect(() => {
    let listener: google.maps.MapsEventListener | undefined
    let active = true

    void loadGoogleMaps().then(() => {
      if (!active || !inputRef.current) return
      const autocomplete = createAutocomplete(inputRef.current, {
        fields: ['place_id', 'formatted_address', 'name', 'geometry', 'address_components', 'rating', 'user_ratings_total'],
        componentRestrictions: { country: 'IN' },
      })
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const lat = place.geometry?.location?.lat()
        const lng = place.geometry?.location?.lng()
        if (!place.place_id || lat === undefined || lng === undefined) return
        const component = (type: string) => place.address_components?.find((item) => item.types.includes(type))?.long_name
        const location: SearchResult = {
          id: place.place_id,
          name: place.name || place.formatted_address || valueRef.current,
          address: place.formatted_address || place.name || valueRef.current,
          type: place.types?.[0] || 'place',
          lat,
          lng,
          city: component('locality') || component('administrative_area_level_2'),
          state: component('administrative_area_level_1'),
          country: component('country'),
          rating: place.rating,
          reviewCount: place.user_ratings_total,
        }
        onChangeRef.current(location.name)
        onLocationSelectRef.current?.(location)
        setSearchResults([])
        setShowResults(false)
      })
    }).catch(() => {
      // Nominatim search below remains available when Google Maps is not configured.
    })

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      active = false
      listener?.remove()
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    onChange(inputValue)

    // Search with debounce
    searchLocationsWithDebounce(inputValue, (results) => {
      setSearchResults(results)
      setShowResults(results.length > 0 && inputValue.length >= 3)
    })
  }

  const handleLocationSelect = (location: SearchResult) => {
    onChange(location.address)
    setShowResults(false)
    setSearchResults([])
    
    if (onLocationSelect) {
      onLocationSelect(location)
    }
  }

  const clearSearch = () => {
    onChange('')
    setSearchResults([])
    setShowResults(false)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label htmlFor={inputId} className="block text-sm font-medium text-white/70">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="mt-1 relative">
        <input
          ref={inputRef}
          type="text"
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (searchResults.length > 0 && value.length >= 3) {
              setShowResults(true)
            }
          }}
          className={`block min-h-11 w-full rounded-md border border-white/10 bg-white/[0.045] px-3 text-white shadow-sm placeholder:text-white/35 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 ${
            error ? 'border-red-400' : ''
          }`}
          required={required}
        />
        {value && (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Clear location search"
            className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-white/45 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {error && (
        <div className="text-red-600 text-sm mt-1">{error}</div>
      )}

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#111] shadow-2xl">
          {searchResults.map((result, index) => (
            <div
              key={index}
              onClick={() => handleLocationSelect(result)}
              className="cursor-pointer border-b border-white/5 px-4 py-3 hover:bg-amber-400/10 last:border-b-0"
            >
              <div className="text-sm font-medium text-white">{result.name}</div>
              <div className="text-xs text-white/60">{result.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LocationInput
