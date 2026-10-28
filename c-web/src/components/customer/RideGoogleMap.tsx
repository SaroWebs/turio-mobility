import { useEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { customerMapId, loadGoogleMaps } from '../../utils/googleMaps'

type CoordinateState = {
  pickupLat: string
  pickupLng: string
  dropoffLat: string
  dropoffLng: string
}

export type NearbyDriverLocation = {
  lat: number
  lng: number
}

type RideGoogleMapProps = {
  coords: CoordinateState
  pickup: string
  dropoff: string
  currentLocation: google.maps.LatLngLiteral | null
  nearbyDrivers: NearbyDriverLocation[]
  onLocate: () => void
  onSelectPoint: (kind: 'pickup' | 'dropoff', position: google.maps.LatLngLiteral, address: string) => void
  searching?: boolean
}

const defaultCenter = { lat: 20.5937, lng: 78.9629 }

function point(lat: string, lng: string): google.maps.LatLngLiteral | null {
  const latitude = Number(lat)
  const longitude = Number(lng)
  return Number.isFinite(latitude) && Number.isFinite(longitude) && lat !== '' && lng !== ''
    ? { lat: latitude, lng: longitude }
    : null
}

function samePoint(a: google.maps.LatLngLiteral | null, b: google.maps.LatLngLiteral | null) {
  return Boolean(a && b && Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001)
}

export function RideGoogleMap({
  coords,
  pickup,
  dropoff,
  currentLocation,
  nearbyDrivers,
  onLocate,
  onSelectPoint,
  searching = false,
}: RideGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Loading Google Maps…')
  const [pinMode, setPinMode] = useState<'pickup' | 'dropoff' | null>(null)

  useEffect(() => {
    let cancelled = false
    let clickListener: google.maps.MapsEventListener | null = null

    void loadGoogleMaps().then(async ({ maps, AdvancedMarkerElement, PinElement, Route }) => {
      if (cancelled || !containerRef.current) return
      if (!mapRef.current) {
        mapRef.current = new maps.Map(containerRef.current, {
          center: defaultCenter,
          zoom: 5,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          mapId: customerMapId(),
        })
      }

      const map = mapRef.current
      clickListener = map.addListener('click', (event) => {
        if (!pinMode || !event.latLng) return
        const position = { lat: event.latLng.lat(), lng: event.latLng.lng() }
        const fallback = `${pinMode === 'pickup' ? 'Pinned pickup' : 'Pinned drop-off'} (${position.lat.toFixed(5)}, ${position.lng.toFixed(5)})`
        new maps.Geocoder().geocode({ location: position }, (results, status) => {
          const address = status === maps.GeocoderStatus.OK ? results?.[0]?.formatted_address || fallback : fallback
          onSelectPoint(pinMode, position, address)
          setMessage(`${pinMode === 'pickup' ? 'Pickup' : 'Drop-off'} pin captured.`)
          setPinMode(null)
        })
      })
      markersRef.current.forEach((marker) => { marker.map = null })
      markersRef.current = []
      polylinesRef.current.forEach((polyline) => polyline.setMap(null))
      polylinesRef.current = []

      const origin = point(coords.pickupLat, coords.pickupLng)
      const destination = point(coords.dropoffLat, coords.dropoffLng)
      const currentPickup = samePoint(origin, currentLocation)

      const addDraggableMarker = (kind: 'pickup' | 'dropoff', position: google.maps.LatLngLiteral, title: string) => {
        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: kind === 'pickup' && currentPickup ? `${title} (your current location)` : title,
          gmpDraggable: !searching,
        })
        marker.append(new PinElement({
          background: kind === 'pickup' ? (currentPickup ? '#2563eb' : '#0f766e') : '#17211d',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          glyphText: kind === 'pickup' ? (currentPickup ? '•' : 'P') : 'D',
          scale: 1.15,
        }))
        marker.style.cursor = searching ? 'default' : 'grab'
        if (!searching) marker.addListener('dragend', (event) => {
          if (!event.latLng) return
          const moved = { lat: event.latLng.lat(), lng: event.latLng.lng() }
          const fallback = `${kind === 'pickup' ? 'Pinned pickup' : 'Pinned drop-off'} (${moved.lat.toFixed(5)}, ${moved.lng.toFixed(5)})`
          setMessage(`Updating ${kind === 'pickup' ? 'pickup' : 'drop-off'} address…`)
          new maps.Geocoder().geocode({ location: moved }, (results, status) => {
            const address = status === maps.GeocoderStatus.OK ? results?.[0]?.formatted_address || fallback : fallback
            onSelectPoint(kind, moved, address)
            setMessage(`${kind === 'pickup' ? 'Pickup' : 'Drop-off'} pin moved. Route updated.`)
          })
        })
        markersRef.current.push(marker)
      }

      if (currentLocation && !currentPickup) {
        const currentMarker = new AdvancedMarkerElement({
          map,
          position: currentLocation,
          title: 'Your current location',
        })
        currentMarker.append(new PinElement({
          background: '#2563eb',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          glyphText: '•',
          scale: 1.05,
        }))
        markersRef.current.push(currentMarker)
      }

      nearbyDrivers.forEach((driver, index) => {
        if (!Number.isFinite(driver.lat) || !Number.isFinite(driver.lng)) return
        const driverMarker = new AdvancedMarkerElement({
          map,
          position: driver,
          title: `Available driver ${index + 1}`,
        })
        driverMarker.append(new PinElement({
          background: '#f2c94c',
          borderColor: '#17211d',
          glyphColor: '#17211d',
          glyphText: '•',
          scale: 0.9,
        }))
        markersRef.current.push(driverMarker)
      })

      if (origin && destination) {
        addDraggableMarker('pickup', origin, pickup || 'Pickup')
        addDraggableMarker('dropoff', destination, dropoff || 'Drop-off')
        try {
          const { routes } = await Route.computeRoutes({
            origin,
            destination,
            travelMode: 'DRIVING',
            fields: ['path'],
          })
          if (cancelled) return

          const route = routes[0]
          if (!route) throw new Error('No route returned.')

          const polylines = route.createPolylines({
            polylineOptions: { strokeColor: '#0f766e', strokeOpacity: 0.92, strokeWeight: 6 },
          })
          polylines.forEach((polyline) => polyline.setMap(map))
          polylinesRef.current = polylines

          const bounds = new maps.LatLngBounds()
          route.path.forEach((position) => bounds.extend(position))
          nearbyDrivers.forEach((driver) => bounds.extend(driver))
          map.fitBounds(bounds, 72)
          setMessage(`${pickup || 'Pickup'} to ${dropoff || 'drop-off'}`)
        } catch {
          const bounds = new maps.LatLngBounds()
          bounds.extend(origin)
          bounds.extend(destination)
          nearbyDrivers.forEach((driver) => bounds.extend(driver))
          map.fitBounds(bounds, 72)
          setMessage('Route preview is temporarily unavailable; showing both locations.')
        }
      } else if (origin) {
        addDraggableMarker('pickup', origin, pickup || 'Pickup')
        map.panTo(origin)
        map.setZoom(currentPickup ? 13 : 15)
        setMessage(currentPickup
          ? 'You are centered on the map. Add a drop-off to preview the route.'
          : 'Pickup selected. Add a drop-off to preview the route.')
      } else if (currentLocation) {
        map.panTo(currentLocation)
        map.setZoom(13)
        setMessage('You are centered on the map. Choose your pickup and drop-off.')
      } else {
        setMessage('Enter pickup and drop-off locations to preview your route.')
      }

      setMapState('ready')
    }).catch((error: unknown) => {
      if (cancelled) return
      setMapState('error')
      setMessage(error instanceof Error ? error.message : 'Google Maps is unavailable.')
    })

    return () => {
      cancelled = true
      clickListener?.remove()
    }
  }, [coords.dropoffLat, coords.dropoffLng, coords.pickupLat, coords.pickupLng, currentLocation, dropoff, nearbyDrivers, onSelectPoint, pickup, pinMode, searching])

  return <div className="ride-map-stage" aria-label="Google Map showing the selected ride route">
    <div className="ride-google-map" ref={containerRef} />
    {mapState !== 'ready' ? <div className={`ride-map-state ${mapState}`} role="status"><Icon name="map" /><strong>{mapState === 'loading' ? 'Loading map' : 'Map unavailable'}</strong><span>{message}</span></div> : null}
    <div className="ride-map-caption" aria-live="polite"><Icon name="map" /><span>{searching ? 'Updating route…' : message}</span></div>
    {(currentLocation || nearbyDrivers.length > 0) ? <div className="ride-map-legend" aria-label="Map marker legend">
      {currentLocation ? <span><i className="current" />You</span> : null}
      {nearbyDrivers.length > 0 ? <span><i className="driver" />Available drivers</span> : null}
    </div> : null}
    <div className="ride-map-pin-tools" aria-label="Choose a location by dropping a map pin">
      <button aria-pressed={pinMode === 'pickup'} onClick={() => setPinMode((current) => current === 'pickup' ? null : 'pickup')} type="button"><span className="route-dot pickup" />Set pickup pin</button>
      <button aria-pressed={pinMode === 'dropoff'} onClick={() => setPinMode((current) => current === 'dropoff' ? null : 'dropoff')} type="button"><span className="route-dot dropoff" />Set drop-off pin</button>
    </div>
    {pinMode ? <div className="ride-map-pin-hint" role="status">Click the map to set the {pinMode === 'pickup' ? 'pickup' : 'drop-off'} point</div> : null}
    {!pinMode && !searching && (point(coords.pickupLat, coords.pickupLng) || point(coords.dropoffLat, coords.dropoffLng)) ? <div className="ride-map-drag-hint">Drag a P or D marker to fine-tune its location</div> : null}
    <button aria-label="Use my current location for pickup" className="ride-location-fab" onClick={onLocate} type="button"><Icon name="compass" /><span>Locate me</span></button>
  </div>
}
