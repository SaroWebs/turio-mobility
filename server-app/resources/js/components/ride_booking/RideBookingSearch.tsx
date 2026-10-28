import React, { useState, useCallback, useRef, useEffect } from 'react'
import { searchLocationsWithDebounce } from '@/lib/nominatim'

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

interface RideBookingSearchProps {
  className?: string
  compact?: boolean
  onLocationsSelected?: (pickup: Location, dropoff?: Location) => void
  initialPickup?: Location | null
  initialDropoff?: Location | null
}

const RideBookingSearch: React.FC<RideBookingSearchProps> = ({ 
  className = "", 
  compact = false,
  onLocationsSelected,
  initialPickup,
  initialDropoff
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

  // Refs to store timeout IDs for cleanup
  const pickupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropoffTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (pickupTimeoutRef.current) {
        clearTimeout(pickupTimeoutRef.current)
      }
      if (dropoffTimeoutRef.current) {
        clearTimeout(dropoffTimeoutRef.current)
      }
    }
  }, []);

  const handlePickupChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPickupQuery(value)
    
    if (value !== selectedPickup?.address) {
      setSelectedPickup(null)
    }

    // Clear previous timeout
    if (pickupTimeoutRef.current) {
      clearTimeout(pickupTimeoutRef.current)
    }

    // Only trigger search if query is long enough
    if (value.length >= 3) {
      setLoading(true)
      pickupTimeoutRef.current = setTimeout(() => {
        searchLocationsWithDebounce(value, (results) => {
          setPickupResults(results)
          setShowPickupResults(results.length > 0)
          setLoading(false)
        }, 500)
      }, 300)
    } else {
      setPickupResults([])
      setShowPickupResults(false)
    }
  }, [selectedPickup])

  const handleDropoffChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDropoffQuery(value)
    
    if (value !== selectedDropoff?.address) {
      setSelectedDropoff(null)
    }

    // Clear previous timeout
    if (dropoffTimeoutRef.current) {
      clearTimeout(dropoffTimeoutRef.current)
    }

    // Only trigger search if query is long enough
    if (value.length >= 3) {
      setLoading(true)
      dropoffTimeoutRef.current = setTimeout(() => {
        searchLocationsWithDebounce(value, (results) => {
          setDropoffResults(results)
          setShowDropoffResults(results.length > 0)
          setLoading(false)
        }, 500)
      }, 300)
    } else {
      setDropoffResults([])
      setShowDropoffResults(false)
    }
  }, [selectedDropoff])

  const selectLocation = (location: SearchResult, type: 'pickup' | 'dropoff') => {
    const fullLocation: Location = {
      lat: location.lat || 0,
      lng: location.lng || 0,
      address: location.address,
      type: location.type,
      id: location.id
    }

    if (type === 'pickup') {
      setSelectedPickup(fullLocation)
      setPickupQuery(fullLocation.address)
      setShowPickupResults(false)
      setPickupResults([])
    } else {
      setSelectedDropoff(fullLocation)
      setDropoffQuery(fullLocation.address)
      setShowDropoffResults(false)
      setDropoffResults([])
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

  const handleSearch = () => {
    if (!selectedPickup) {
      return
    }

    // If callback is provided, use it instead of routing
    if (onLocationsSelected) {
      onLocationsSelected(selectedPickup, selectedDropoff || undefined)
      return
    }

    // Use localStorage to store search data
    const searchData = {
      pickup: selectedPickup,
      dropoff: selectedDropoff
    }
    localStorage.setItem('ride_booking_search', JSON.stringify(searchData))

    // Navigate using standard window.location
    window.location.href = '/ride-booking'
  }

  const swapLocations = () => {
    if (selectedPickup && selectedDropoff) {
      const tempPickup = selectedPickup
      setSelectedPickup(selectedDropoff)
      setSelectedDropoff(tempPickup)
      setPickupQuery(selectedDropoff.address)
      setDropoffQuery(selectedPickup.address)
      
      // Clear search results when swapping
      setPickupResults([])
      setDropoffResults([])
      setShowPickupResults(false)
      setShowDropoffResults(false)
    }
  }

  if (compact) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          {/* Pickup Input */}
          <div className="flex-1 relative">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
              <input
                type="text"
                value={pickupQuery}
                onChange={handlePickupChange}
                placeholder="Pickup location"
                className="w-full px-3 py-2 text-sm border-0 focus:ring-0 focus:outline-none"
              />
            </div>
            
            {showPickupResults && pickupResults.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto top-full">
                {pickupResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => selectLocation(result, 'pickup')}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900">{result.name}</div>
                    <div className="text-xs text-gray-600">{result.address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <button
            onClick={swapLocations}
            disabled={!selectedPickup || !selectedDropoff}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          {/* Dropoff Input */}
          <div className="flex-1 relative">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
              <input
                type="text"
                value={dropoffQuery}
                onChange={handleDropoffChange}
                placeholder="Dropoff location"
                className="w-full px-3 py-2 text-sm border-0 focus:ring-0 focus:outline-none"
              />
            </div>
            
            {showDropoffResults && dropoffResults.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto top-full">
                {dropoffResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => selectLocation(result, 'dropoff')}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900">{result.name}</div>
                    <div className="text-xs text-gray-600">{result.address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={!selectedPickup || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span className="hidden sm:inline">Search</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">Book Your Ride</h3>
      
      <div className="space-y-4">
        {/* Pickup Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Location</label>
          <div className="relative">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0"></div>
              <input
                type="text"
                value={pickupQuery}
                onChange={handlePickupChange}
                placeholder="Enter pickup location"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedPickup && (
                <button
                  onClick={() => clearLocation('pickup')}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
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

        {/* Swap Button */}
        <div className="flex justify-center">
          <button
            onClick={swapLocations}
            disabled={!selectedPickup || !selectedDropoff}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Dropoff Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dropoff Location</label>
          <div className="relative">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0"></div>
              <input
                type="text"
                value={dropoffQuery}
                onChange={handleDropoffChange}
                placeholder="Enter dropoff location"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedDropoff && (
                <button
                  onClick={() => clearLocation('dropoff')}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
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

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!selectedPickup || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? 'Searching...' : 'Continue to Booking'}
        </button>
      </div>
    </div>
  )
}

export default RideBookingSearch