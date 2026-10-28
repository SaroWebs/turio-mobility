import React, { useState, useEffect, useCallback, useRef } from 'react'
import { notificationService } from '@/services/notification'
import { useRideTracking, trackingApi, RideLocationEvent, RideStatusEvent } from '@/lib/useWebSocket'

interface RideBooking {
  id: number
  booking_number: string
  status: string
  pickup_location: string
  pickup_lat?: number
  pickup_lng?: number
  dropoff_location?: string
  dropoff_lat?: number
  dropoff_lng?: number
  scheduled_at: string
  total_fare: number
  driver?: {
    id?: number
    name: string
    phone: string
  }
  current_lat?: number
  current_lng?: number
  start_ride_pin?: string
  start_pin_verified_at?: string
}

interface RideTrackerProps {
  booking: RideBooking
  onBookingCancelled: () => void
  onStatusChange?: (status: string) => void
}

const statusConfig = {
  pending: {
    label: 'Finding Driver',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    progress: 10,
    icon: (
      <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  confirmed: {
    label: 'Booking Confirmed',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    progress: 25,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  driver_assigned: {
    label: 'Driver Assigned',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    progress: 35,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  driver_arriving: {
    label: 'Driver On The Way',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-300',
    progress: 50,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  pickup: {
    label: 'Pickup Started',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    progress: 65,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  in_transit: {
    label: 'Ride In Progress',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    progress: 80,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  on_the_way: {
    label: 'Driver On The Way',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-300',
    progress: 50,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  arrived: {
    label: 'Pickup Started',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    progress: 65,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  started: {
    label: 'Ride In Progress',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    progress: 80,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  completed: {
    label: 'Ride Completed',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    progress: 100,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  cancelled: {
    label: 'Booking Cancelled',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    progress: 0,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }
}

const RideTracker: React.FC<RideTrackerProps> = ({ booking, onBookingCancelled, onStatusChange }) => {
  const [currentStatus, setCurrentStatus] = useState(booking.status)
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(
    booking.current_lat && booking.current_lng 
      ? { lat: booking.current_lat, lng: booking.current_lng }
      : null
  )
  const [eta, setEta] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const lastLocationToastAt = useRef<number>(0)

  // Handle real-time location updates
  const handleLocationUpdate = useCallback((data: RideLocationEvent) => {
    setDriverLocation({ lat: data.latitude, lng: data.longitude })
    if (data.eta) setEta(data.eta)
    setLastUpdate(new Date())

    // Avoid notification spam from frequent GPS updates.
    const now = Date.now()
    if (now - lastLocationToastAt.current > 60000) {
      notificationService.info('Live location updated')
      lastLocationToastAt.current = now
    }
  }, [])

  // Handle real-time status updates
  const handleStatusUpdate = useCallback((data: RideStatusEvent) => {
    setCurrentStatus(data.status)
    setLastUpdate(new Date())
    onStatusChange?.(data.status)
    
    const statusInfo = statusConfig[data.status as keyof typeof statusConfig]
    if (statusInfo) {
      notificationService.success(`Ride status: ${statusInfo.label}`)
    }
  }, [onStatusChange])

  // Subscribe to real-time updates
  useRideTracking(
    booking.id,
    handleLocationUpdate,
    handleStatusUpdate
  )

  const fetchBookingUpdate = useCallback(async () => {
    try {
      const data = await trackingApi.getTrackingInfo(booking.id)

      if (data.success) {
        setCurrentStatus(data.data.booking.status)

        if (data.data.current_location) {
          setDriverLocation({
            lat: data.data.current_location.latitude,
            lng: data.data.current_location.longitude
          })
        }
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching booking update:', error)
    }
  }, [booking.id])

  // Check WebSocket connection status
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Echo) {
      setIsConnected(true)
    }
  }, [])

  // Fallback polling when WebSocket is not available
  useEffect(() => {
    if (isConnected) return // Don't poll if WebSocket is connected

    const interval = setInterval(fetchBookingUpdate, 15000) // Poll every 15 seconds
    return () => clearInterval(interval)
  }, [fetchBookingUpdate, isConnected])

  const handleCancelBooking = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return
    }

    try {
      const response = await fetch(`/ride-bookings/${booking.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        }
      })

      if (response.ok) {
        notificationService.success('Booking cancelled successfully')
        onBookingCancelled()
      } else {
        const payload = await response.json().catch(() => ({}))
        notificationService.error(payload?.message || 'Failed to cancel booking')
      }
    } catch (error) {
      notificationService.error('Failed to cancel booking')
    }
  }

  const statusInfo = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.pending
  const canCancel = ['pending', 'confirmed', 'driver_assigned', 'driver_arriving'].includes(currentStatus)
  const mapQuery = driverLocation
    ? `${driverLocation.lat},${driverLocation.lng}`
    : booking.pickup_lat && booking.pickup_lng
      ? `${booking.pickup_lat},${booking.pickup_lng}`
      : ''
  const shouldShowStartPin =
    Boolean(booking.start_ride_pin) &&
    ['driver_assigned', 'driver_arriving', 'pickup'].includes(currentStatus) &&
    !booking.start_pin_verified_at

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Track Your Ride</h2>
              <p className="text-orange-100">Booking #{booking.booking_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className="text-xs text-orange-100">
                {isConnected ? 'Live' : 'Polling'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              {Object.entries(statusConfig).slice(0, -1).map(([key, config], index) => (
                <div 
                  key={key} 
                  className={`flex flex-col items-center ${
                    index === 0 ? '' : 'flex-1'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statusConfig[currentStatus as keyof typeof statusConfig]?.progress >= config.progress
                      ? config.bgColor
                      : 'bg-gray-200'
                  }`}>
                    {React.cloneElement(config.icon, { 
                      className: `w-4 h-4 ${
                        statusConfig[currentStatus as keyof typeof statusConfig]?.progress >= config.progress
                          ? config.color
                          : 'text-gray-400'
                      }`
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
                style={{ width: `${statusInfo.progress}%` }}
              />
            </div>
          </div>

          {/* Status Card */}
          <div className={`rounded-lg p-4 mb-6 border-2 ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                {statusInfo.icon}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold text-lg ${statusInfo.color}`}>{statusInfo.label}</h3>
                {eta && ['driver_arriving', 'driver_assigned'].includes(currentStatus) && (
                  <p className="text-sm text-gray-600">ETA: {Math.ceil(eta / 60)} minutes</p>
                )}
              </div>
              {lastUpdate && (
                <div className="text-xs text-gray-500">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* Driver Info */}
          {booking.driver && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Your Driver</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{booking.driver.name}</p>
                    <p className="text-sm text-gray-600">{booking.driver.phone}</p>
                  </div>
                </div>
                <a 
                  href={`tel:${booking.driver.phone}`}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call
                </a>
              </div>
            </div>
          )}

          {/* Trip Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Trip Details</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">PICKUP</span>
                  <p className="text-gray-900">{booking.pickup_location}</p>
                </div>
              </div>
              
              {booking.dropoff_location && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">DROP-OFF</span>
                    <p className="text-gray-900">{booking.dropoff_location}</p>
                  </div>
                </div>
              )}

              <div className="border-t pt-3 mt-3 flex justify-between">
                <span className="text-gray-600">Scheduled:</span>
                <span className="text-gray-900">
                  {new Date(booking.scheduled_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span className="text-gray-600">Total Fare:</span>
                <span className="text-orange-600">₹{Number(booking.total_fare).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {shouldShowStartPin && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-amber-900 mb-1">Ride Start PIN</h4>
              <p className="text-sm text-amber-800 mb-2">Tell this PIN to your driver to start the ride.</p>
              <div className="inline-flex rounded bg-white px-3 py-1 text-xl font-bold tracking-[0.35em] text-amber-900">
                {booking.start_ride_pin}
              </div>
            </div>
          )}

          {/* Live Location Display */}
          {driverLocation && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Driver Location</h4>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Live</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>Latitude: {driverLocation.lat.toFixed(6)}</p>
                <p>Longitude: {driverLocation.lng.toFixed(6)}</p>
              </div>
              {mapQuery && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Open Live Location in Maps
                </a>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {canCancel && (
              <button
                onClick={handleCancelBooking}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Cancel Booking
              </button>
            )}

            <button
              onClick={fetchBookingUpdate}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RideTracker
