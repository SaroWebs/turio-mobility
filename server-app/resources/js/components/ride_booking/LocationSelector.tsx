import React, { useState, useEffect } from 'react'
import { notificationService } from '@/services/notification'
import { searchLocationsWithDebounce, getPlaceDetails } from '@/lib/nominatim'

interface Location {
  lat: number
  lng: number
  address: string
  type?: string
  id?: string | number
}

interface SearchResult {
  id: string
  name: string
  address: string
  type: string
  lat?: number
  lng?: number
}

interface LocationSelectorProps {
  onLocationSelected: (pickup: Location, dropoff?: Location) => void
  initialPickup?: Location | null
  initialDropoff?: Location | null
  selectType: 'pickup' | 'dropoff'
  onBack?: () => void
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  onLocationSelected,
  initialPickup,
  initialDropoff,
  selectType,
  onBack
}) => {
  const [pickupQuery, setPickupQuery] = useState('')
  const [dropoffQuery, setDropoffQuery] = useState('')
  const [pickupResults, setPickupResults] = useState<SearchResult[]>([])
  const [dropoffResults, setDropoffResults] = useState<SearchResult[]>([])
  const [showPickupResults, setShowPickupResults] = useState(false)
  const [showDropoffResults, setShowDropoffResults] = useState(false)
  const [selectedPickup, setSelectedPickup] = useState<Location | null>(initialPickup || null)
  const [selectedDropoff, setSelectedDropoff] = useState<Location | null>(initialDropoff || null)
  const [loading, setLoading] = useState(false)
  const [popularLocations, setPopularLocations] = useState<SearchResult[]>([])

  useEffect(() => {
    if (initialPickup) {
      setPickupQuery(initialPickup.address)
      setSelectedPickup(initialPickup)
    }
    if (initialDropoff) {
      setDropoffQuery(initialDropoff.address)
      setSelectedDropoff(initialDropoff)
    }
    fetchPopularLocations()
  }, [initialPickup, initialDropoff])

  const fetchPopularLocations = async () => {
    try {
      const response = await fetch('/api/locations/popular')
      if (response.ok) {
        const data = await response.json()
        setPopularLocations(data.destinations || [])
      }
    } catch (error) {
      console.error('Error fetching popular locations:', error)
    }
  }

  const handlePickupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPickupQuery(value)
    
    // Clear selected location if user is typing manually
    if (value !== selectedPickup?.address) {
      setSelectedPickup(null)
    }

    // Search with debounce
    searchLocationsWithDebounce(value, (results) => {
      setPickupResults(results)
      setShowPickupResults(results.length > 0 && value.length >= 3)
    })
  }

  const handleDropoffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDropoffQuery(value)
    
    // Clear selected location if user is typing manually
    if (value !== selectedDropoff?.address) {
      setSelectedDropoff(null)
    }

    // Search with debounce
    searchLocationsWithDebounce(value, (results) => {
      setDropoffResults(results)
      setShowDropoffResults(results.length > 0 && value.length >= 3)
    })
  }

  const selectLocation = async (location: SearchResult, type: 'pickup' | 'dropoff') => {
    let fullLocation: Location

    if (location.lat && location.lng) {
      // Use provided coordinates directly
      fullLocation = {
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        type: location.type,
        id: location.id
      }
    } else {
      // Fetch place details if coordinates not provided
      try {
        const placeDetails = await getPlaceDetails(location.id)
        if (!placeDetails) {
          notificationService.error('Failed to get location details')
          return
        }
        fullLocation = placeDetails
      } catch (error) {
        notificationService.error('Failed to get location details')
        return
      }
    }

    if (type === 'pickup') {
      setSelectedPickup(fullLocation)
      setPickupQuery(fullLocation.address)
      setShowPickupResults(false)
    } else {
      setSelectedDropoff(fullLocation)
      setDropoffQuery(fullLocation.address)
      setShowDropoffResults(false)
    }
  }

  const handleConfirmLocations = async () => {
    if (!selectedPickup) {
      notificationService.error('Please select a pickup location')
      return
    }

    // Validate locations are within service area
    setLoading(true)
    try {
      const pickupValidation = await fetch('/api/locations/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({
          lat: selectedPickup.lat,
          lng: selectedPickup.lng
        })
      })

      if (pickupValidation.ok) {
        const pickupData = await pickupValidation.json()
        if (!pickupData.valid) {
          notificationService.error('Pickup location is outside our service area')
          return
        }
      }

      if (selectedDropoff) {
        const dropoffValidation = await fetch('/api/locations/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          },
          body: JSON.stringify({
            lat: selectedDropoff.lat,
            lng: selectedDropoff.lng
          })
        })

        if (dropoffValidation.ok) {
          const dropoffData = await dropoffValidation.json()
          if (!dropoffData.valid) {
            notificationService.error('Dropoff location is outside our service area')
            return
          }
        }
      }

      onLocationSelected(selectedPickup, selectedDropoff || undefined)
    } catch (error) {
      notificationService.error('Failed to validate locations')
    } finally {
      setLoading(false)
    }
  }

  const clearLocation = (type: 'pickup' | 'dropoff') => {
    if (type === 'pickup') {
      setSelectedPickup(null)
      setPickupQuery('')
      setPickupResults([])
      setShowPickupResults(false)
    } else {
      setSelectedDropoff(null)
      setDropoffQuery('')
      setDropoffResults([])
      setShowDropoffResults(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Where are you going?</h2>

        {/* Pickup Location */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Location</label>
          <div className="relative">
            <input
              type="text"
              value={pickupQuery}
              onChange={handlePickupChange}
              placeholder="Enter pickup location"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {selectedPickup && (
              <button
                onClick={() => clearLocation('pickup')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Pickup Results */}
            {showPickupResults && pickupResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                {pickupResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => selectLocation(result, 'pickup')}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{result.name}</div>
                    <div className="text-sm text-gray-600">{result.address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dropoff Location */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Dropoff Location (Optional)</label>
          <div className="relative">
            <input
              type="text"
              value={dropoffQuery}
              onChange={handleDropoffChange}
              placeholder="Enter dropoff location"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {selectedDropoff && (
              <button
                onClick={() => clearLocation('dropoff')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Dropoff Results */}
            {showDropoffResults && dropoffResults.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                {dropoffResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => selectLocation(result, 'dropoff')}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{result.name}</div>
                    <div className="text-sm text-gray-600">{result.address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Popular Locations */}
        {popularLocations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Popular Destinations</h3>
            <div className="grid grid-cols-2 gap-2">
              {popularLocations.slice(0, 6).map((location) => (
                <button
                  key={location.id}
                  onClick={() => selectLocation(location, selectedPickup ? 'dropoff' : 'pickup')}
                  className="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{location.address.split(',')[0]}</div>
                  <div className="text-xs text-gray-600">{location.address}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={handleConfirmLocations}
          disabled={!selectedPickup || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Validating...' : 'Continue to Booking'}
        </button>
      </div>
    </div>
  )
}

export default LocationSelector