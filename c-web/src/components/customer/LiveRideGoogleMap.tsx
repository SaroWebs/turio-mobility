import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { customerMapId, loadGoogleMaps } from '../../utils/googleMaps'
import type { TrackingPoint } from '../../utils/customerApi'

type LiveRideGoogleMapProps = {
  currentLocation?: TrackingPoint | null
  pickup?: TrackingPoint | null
  dropoff?: TrackingPoint | null
  status: string
  nearbyDrivers?: Array<{ lat: number; lng: number }>
}

const noNearbyDrivers: Array<{ lat: number; lng: number }> = []

function coordinate(point?: TrackingPoint | null): google.maps.LatLngLiteral | null {
  const lat = Number(point?.latitude)
  const lng = Number(point?.longitude)
  return point?.latitude !== null && point?.latitude !== undefined
    && point?.longitude !== null && point?.longitude !== undefined
    && Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null
}

export function LiveRideGoogleMap({ currentLocation, pickup, dropoff, status, nearbyDrivers = noNearbyDrivers }: LiveRideGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Loading live route…')

  useEffect(() => {
    let cancelled = false

    void loadGoogleMaps().then(async ({ maps, AdvancedMarkerElement, PinElement, Route }) => {
      if (cancelled || !containerRef.current) return

      const pickupPoint = coordinate(pickup)
      const dropoffPoint = coordinate(dropoff)
      const driverPoint = coordinate(currentLocation)
      const fallbackCenter = pickupPoint ?? dropoffPoint ?? driverPoint ?? { lat: 20.5937, lng: 78.9629 }

      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          center: fallbackCenter,
          zoom: pickupPoint || dropoffPoint || driverPoint ? 14 : 5,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          mapId: customerMapId(),
        })
      }

      const map = mapRef.current
      markersRef.current.forEach((marker) => { marker.map = null })
      markersRef.current = []
      polylinesRef.current.forEach((polyline) => polyline.setMap(null))
      polylinesRef.current = []

      const addMarker = (position: google.maps.LatLngLiteral, label: string, title: string, color: string) => {
        const marker = new AdvancedMarkerElement({
          map,
          position,
          title,
          zIndex: label === 'CAR' ? 2 : 1,
        })
        marker.append(new PinElement({
          background: color,
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          glyphText: label,
          scale: label === 'CAR' ? 1.25 : 1.1,
        }))
        markersRef.current.push(marker)
      }

      if (pickupPoint) addMarker(pickupPoint, 'P', pickup?.address || 'Pickup', '#0f766e')
      if (dropoffPoint) addMarker(dropoffPoint, 'D', dropoff?.address || 'Drop-off', '#17211d')
      if (driverPoint) addMarker(driverPoint, 'CAR', 'Driver live location', '#9a4f16')
      nearbyDrivers.forEach((position) => addMarker(position, 'CAR', 'Available car', '#9a4f16'))

      const bounds = new maps.LatLngBounds()
      ;[pickupPoint, dropoffPoint, driverPoint].forEach((position) => { if (position) bounds.extend(position) })
      nearbyDrivers.forEach((position) => bounds.extend(position))

      if (pickupPoint && dropoffPoint) {
        try {
          const { routes } = await Route.computeRoutes({
            origin: pickupPoint,
            destination: dropoffPoint,
            travelMode: 'DRIVING',
            fields: ['path'],
          })
          if (cancelled) return

          const route = routes[0]
          if (route) {
            const polylines = route.createPolylines({
              polylineOptions: { strokeColor: '#0f766e', strokeOpacity: 0.9, strokeWeight: 6 },
            })
            polylines.forEach((polyline) => polyline.setMap(map))
            polylinesRef.current = polylines
          }
        } catch {
          // Keep location markers visible if the Routes API is unavailable.
        }
      }

      if (pickupPoint || dropoffPoint || driverPoint) map.fitBounds(bounds, 72)
      setMessage(driverPoint ? 'Driver location is updating live.' : 'Route ready. Waiting for the driver’s first location update.')
      setMapState('ready')
    }).catch((error: unknown) => {
      if (cancelled) return
      setMapState('error')
      setMessage(error instanceof Error ? error.message : 'Google Maps is unavailable.')
    })

    return () => { cancelled = true }
  }, [currentLocation, dropoff, pickup, nearbyDrivers])

  return <div className="tracking-map live-google-map" aria-label="Live map showing the driver, pickup, and drop-off locations">
    <div className="live-google-map-canvas" ref={containerRef} />
    {mapState !== 'ready' ? <div className={`live-map-state ${mapState}`} role="status"><Icon name="map" /><strong>{mapState === 'loading' ? 'Loading live map' : 'Map unavailable'}</strong><span>{message}</span></div> : null}
    <div className="live-map-status" aria-live="polite"><span className={currentLocation ? 'live-map-pulse active' : 'live-map-pulse'} /><span><strong>{status}</strong><small>{message}</small></span></div>
    <div className="live-map-legend" aria-label="Map marker legend"><span><b className="pickup">P</b>Pickup</span><span><b className="driver">CAR</b>Driver</span><span><b className="dropoff">D</b>Drop-off</span></div>
  </div>
}
