interface NominatimResult {
  place_id: number;
  osm_id: number;
  place_rank: number;
  central_angle: number;
  importance: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  display_name: string;
  name: string;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

interface Location {
  lat: number;
  lng: number;
  address: string;
  type?: string;
  id?: string | number;
}

interface SearchResult {
  id: string;
  name: string;
  address: string;
  type: string;
  lat: number;
  lng: number;
}

let searchTimeout: NodeJS.Timeout | null = null;

export const searchLocations = async (query: string): Promise<SearchResult[]> => {
  if (query.length < 3) {
    return [];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&` +
      `format=json&` +
      `addressdetails=1&` +
      `limit=5&` +
      `countrycodes=in&` + // Restrict to India
      `dedupe=1&` +
      `extratags=0`,
      {
        headers: {
          'User-Agent': 'RideBookingApp/1.0' // Required by Nominatim usage policy
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();

    return data.map(result => ({
      id: result.place_id.toString(),
      name: result.name || result.display_name.split(',')[0],
      address: result.display_name,
      type: result.type,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
};

export const searchLocationsWithDebounce = (
  query: string,
  callback: (results: SearchResult[]) => void,
  delay: number = 300
) => {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Set new timeout
  searchTimeout = setTimeout(async () => {
    const results = await searchLocations(query);
    callback(results);
  }, delay);
};

export const getPlaceDetails = async (placeId: string): Promise<Location | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/details?` +
      `place_ids=${encodeURIComponent(placeId)}&` +
      `format=json&` +
      `addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RideBookingApp/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const place = data[0];
      return {
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        address: place.display_name,
        type: place.type,
        id: place.place_id
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<Location | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      `lat=${lat}&` +
      `lon=${lng}&` +
      `format=json&` +
      `addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RideBookingApp/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data) {
      return {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        address: data.display_name,
        type: data.type,
        id: data.place_id
      };
    }

    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
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