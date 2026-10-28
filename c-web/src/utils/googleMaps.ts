export type GoogleMapsRuntime = {
  maps: typeof google.maps
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement
  PinElement: typeof google.maps.marker.PinElement
  Route: typeof google.maps.routes.Route
}

let mapsPromise: Promise<GoogleMapsRuntime> | null = null

async function loadModernLibraries(maps: typeof google.maps): Promise<GoogleMapsRuntime> {
  const [markerLibrary, routesLibrary] = await Promise.all([
    maps.importLibrary('marker'),
    maps.importLibrary('routes'),
  ])

  return {
    maps,
    AdvancedMarkerElement: markerLibrary.AdvancedMarkerElement,
    PinElement: markerLibrary.PinElement,
    Route: routesLibrary.Route,
  }
}

export function loadGoogleMaps(): Promise<GoogleMapsRuntime> {
  if (window.google?.maps) return loadModernLibraries(window.google.maps)
  if (mapsPromise) return mapsPromise

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps is not configured for the customer website.'))
  }

  mapsPromise = new Promise((resolve, reject) => {
    const callbackName = '__happyMilesGoogleMapsReady'
    window[callbackName] = () => {
      if (window.google?.maps) {
        void loadModernLibraries(window.google.maps).then(resolve, reject)
      } else reject(new Error('Google Maps loaded without the Maps library.'))
      delete window[callbackName]
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-turiya-mobility-google-maps]')
    if (existing) {
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.dataset.turiyaMobilityGoogleMaps = 'true'
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places,geometry&callback=${callbackName}&loading=async`
    script.onerror = () => reject(new Error('Google Maps failed to load. Check the API key and allowed website origins.'))
    document.head.appendChild(script)
  })

  return mapsPromise
}

export function customerMapId(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
}
