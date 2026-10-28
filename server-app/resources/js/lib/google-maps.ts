// Simple Google Maps loading using dynamic script injection
declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

let googleMapsPromise: Promise<typeof google> | null = null;

export const loadGoogleMaps = async (): Promise<typeof google> => {
  // If already loaded, return the existing promise
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  // Get API key from environment variables
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Maps API key not found. Please check your environment variables.');
  }

  // Load Google Maps using dynamic script injection
  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if Google Maps is already loaded
    if (window.google) {
      resolve(window.google);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&region=IN&language=en&v=weekly`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      if (window.google) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps API failed to load'));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'));
    };
    
    document.head.appendChild(script);
  });
  
  return googleMapsPromise;
};

export const googleMapsMapId = (): string =>
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

export const createAutocomplete = (
  input: HTMLInputElement,
  options: google.maps.places.AutocompleteOptions = {}
): google.maps.places.Autocomplete => {
  const defaultOptions: google.maps.places.AutocompleteOptions = {
    fields: ['place_id', 'formatted_address', 'name', 'geometry'],
    componentRestrictions: { country: 'IN' }, // Restrict to India
    ...options
  };

  return new window.google.maps.places.Autocomplete(input, defaultOptions);
};

export const getPlaceDetails = async (
  placeId: string,
  fields: string[] = ['place_id', 'formatted_address', 'name', 'geometry']
): Promise<google.maps.places.PlaceResult | null> => {
  const google = await loadGoogleMaps();
  
  return new Promise((resolve, reject) => {
    const service = new google.maps.places.PlacesService(
      document.createElement('div')
    );

    service.getDetails(
      {
        placeId,
        fields
      },
      (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result) {
          resolve(result);
        } else {
          reject(new Error(`Places service failed: ${status}`));
        }
      }
    );
  });
};

export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
