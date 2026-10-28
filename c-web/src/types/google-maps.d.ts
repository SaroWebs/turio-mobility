declare namespace google.maps {
  type LatLngLiteral = { lat: number; lng: number }

  class Map {
    constructor(element: HTMLElement, options: Record<string, unknown>)
    fitBounds(bounds: LatLngBounds, padding?: number): void
    panTo(position: LatLngLiteral): void
    setZoom(zoom: number): void
    addListener(eventName: 'click', callback: (event: MapMouseEvent) => void): MapsEventListener
  }

  class LatLngBounds {
    extend(position: LatLngLiteral): void
  }

  class Polyline {
    setMap(map: Map | null): void
  }

  class Geocoder {
    geocode(
      request: { location: LatLngLiteral },
      callback: (results: Array<{ formatted_address?: string }> | null, status: string) => void,
    ): void
  }

  type MapMouseEvent = { latLng?: { lat(): number; lng(): number } | null }
  type MapsEventListener = { remove(): void }

  const GeocoderStatus: { OK: string }

  namespace marker {
    class AdvancedMarkerElement extends HTMLElement {
      constructor(options?: {
        map?: Map | null
        position?: LatLngLiteral
        title?: string
        gmpDraggable?: boolean
        zIndex?: number
      })
      map: Map | null
      position?: LatLngLiteral
      addListener(eventName: 'dragend', callback: (event: MapMouseEvent) => void): MapsEventListener
    }

    class PinElement extends HTMLElement {
      constructor(options?: {
        background?: string
        borderColor?: string
        glyphColor?: string
        glyphText?: string
        scale?: number
      })
    }
  }

  namespace routes {
    type ComputeRoutesRequest = {
      origin: LatLngLiteral | string
      destination: LatLngLiteral | string
      travelMode?: string
      fields: string[]
    }

    class Route {
      readonly path: LatLngLiteral[]
      static computeRoutes(request: ComputeRoutesRequest): Promise<{ routes: Route[] }>
      createPolylines(options?: {
        polylineOptions?: Record<string, unknown>
      }): Polyline[]
    }
  }

  interface MarkerLibrary {
    AdvancedMarkerElement: typeof marker.AdvancedMarkerElement
    PinElement: typeof marker.PinElement
  }

  interface RoutesLibrary {
    Route: typeof routes.Route
  }

  function importLibrary(name: 'marker'): Promise<MarkerLibrary>
  function importLibrary(name: 'routes'): Promise<RoutesLibrary>
}

interface Window {
  google?: { maps: typeof google.maps }
  __happyMilesGoogleMapsReady?: () => void
}
