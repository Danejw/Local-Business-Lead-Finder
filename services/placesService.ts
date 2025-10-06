// Google Places API (New) service for business discovery and research

export interface PlaceSearchResult {
  id: string;
  displayName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  primaryType: string;
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: {
    openNow: boolean;
    periods: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
}

export interface SearchArea {
  type: 'circle' | 'rectangle';
  circle?: {
    center: { latitude: number; longitude: number };
    radius: number; // in meters
  };
  rectangle?: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
}

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://places.googleapis.com/v1';

// Place Types mapping for better search precision
// Using official Google Place Types: https://developers.google.com/maps/documentation/places/web-service/place-types
const PLACE_TYPES: Record<string, string[]> = {
  'coffee shop': ['cafe'],
  'coffee': ['cafe'],
  'cafe': ['cafe'],
  'restaurant': ['restaurant'],
  'food': ['restaurant', 'meal_takeaway', 'meal_delivery'],
  'gym': ['gym'],
  'fitness': ['gym'],
  'bar': ['bar'],
  'pub': ['bar'],
  'hotel': ['lodging'],
  'retail': ['store'],
  'shop': ['store'],
  'pharmacy': ['pharmacy'],
  'bank': ['bank'],
  'gas station': ['gas_station'],
  'hospital': ['hospital'],
  'clinic': ['hospital'],
  'school': ['school'],
  'university': ['university'],
  'library': ['library'],
  'park': ['park'],
  'museum': ['museum'],
  'theater': ['movie_theater'],
  'cinema': ['movie_theater'],
  'beauty salon': ['beauty_salon'],
  'hair salon': ['beauty_salon'],
  'salon': ['beauty_salon'],
  'salons': ['beauty_salon'],
  'spa': ['spa'],
  'car repair': ['car_repair'],
  'auto repair': ['car_repair'],
  'dentist': ['dentist'],
  'doctor': ['doctor'],
  'lawyer': ['lawyer'],
  'accountant': ['accountant'],
  'real estate': ['real_estate_agency'],
  'insurance': ['insurance_agency'],
  'bakery': ['bakery'],
  'book store': ['book_store'],
  'clothing store': ['clothing_store'],
  'electronics store': ['electronics_store'],
  'furniture store': ['furniture_store'],
  'hardware store': ['hardware_store'],
  'jewelry store': ['jewelry_store'],
  'shoe store': ['shoe_store'],
  'sporting goods store': ['sporting_goods_store'],
  'supermarket': ['supermarket'],
  'department store': ['department_store'],
  'convenience store': ['convenience_store'],
  'florist': ['florist'],
  'pet store': ['pet_store'],
  'toy store': ['toy_store'],
  'travel agency': ['travel_agency'],
  'veterinary care': ['veterinary_care'],
};

function getPlaceTypes(businessType: string): string[] {
  const normalized = businessType.toLowerCase().trim();
  const mappedTypes = PLACE_TYPES[normalized];
  
  if (mappedTypes) {
    return mappedTypes;
  }
  
  // If no mapping found, try to find a close match or use a generic type
  console.warn(`No mapping found for business type: "${businessType}". Using generic search.`);
  
  // For unknown types, use text search without strict type filtering
  return [];
}

async function makePlacesRequest(endpoint: string, body: any, fieldMask: string): Promise<any> {
  if (!API_KEY) {
    throw new Error('Google Maps API key is not configured');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Places API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function makePlaceDetailsRequest(placeId: string, fieldMask: string): Promise<any> {
  if (!API_KEY) {
    throw new Error('Google Maps API key is not configured');
  }

  const response = await fetch(`${BASE_URL}/places/${placeId}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Place Details API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Step 1: Discovery - Fast, minimal data for map pins
export async function searchPlacesInArea(
  businessType: string,
  searchArea: SearchArea,
  maxResults: number = 20
): Promise<PlaceSearchResult[]> {
  const placeTypes = getPlaceTypes(businessType);
  const fieldMask = 'places.id,places.displayName,places.location,places.primaryType,places.formattedAddress';

  let results: PlaceSearchResult[] = [];

  if (searchArea.type === 'circle' && searchArea.circle) {
    // Use Nearby Search for circle areas
    if (placeTypes.length === 0) {
      throw new Error(`Business type "${businessType}" is not supported. Please use a supported business type like "coffee shop", "restaurant", "gym", etc.`);
    }

    const body = {
      includedTypes: placeTypes,
      locationRestriction: {
        circle: {
          center: searchArea.circle.center,
          radius: searchArea.circle.radius,
        },
      },
      maxResultCount: Math.min(maxResults, 20), // API limit
    };

    const response = await makePlacesRequest('/places:searchNearby', body, fieldMask);
    
    if (response.places) {
      results = response.places.map((place: any) => ({
        id: place.id,
        displayName: place.displayName?.text || '',
        location: place.location,
        primaryType: place.primaryType || '',
        formattedAddress: place.formattedAddress || '',
      }));
    }
  } else if (searchArea.type === 'rectangle' && searchArea.rectangle) {
    // Use Text Search for rectangle areas
    const body: any = {
      textQuery: businessType,
      locationRestriction: {
        rectangle: {
          low: searchArea.rectangle.low,
          high: searchArea.rectangle.high,
        },
      },
      pageSize: Math.min(maxResults, 20), // API limit
    };

    // Only add type filtering if we have valid place types
    if (placeTypes.length > 0) {
      body.includedType = placeTypes[0];
      body.strictTypeFiltering = true;
    }

    const response = await makePlacesRequest('/places:searchText', body, fieldMask);
    
    if (response.places) {
      results = response.places.map((place: any) => ({
        id: place.id,
        displayName: place.displayName?.text || '',
        location: place.location,
        primaryType: place.primaryType || '',
        formattedAddress: place.formattedAddress || '',
      }));
    }
  }

  return results;
}

// Step 2: Research - Rich data for selected places
export async function getPlaceDetails(placeId: string): Promise<PlaceSearchResult> {
  const fieldMask = 'displayName,formattedAddress,websiteUri,nationalPhoneNumber,rating,userRatingCount,currentOpeningHours,location,primaryType';
  
  const response = await makePlaceDetailsRequest(placeId, fieldMask);
  
  return {
    id: placeId,
    displayName: response.displayName?.text || '',
    location: response.location,
    primaryType: response.primaryType || '',
    formattedAddress: response.formattedAddress || '',
    websiteUri: response.websiteUri || '',
    nationalPhoneNumber: response.nationalPhoneNumber || '',
    rating: response.rating || 0,
    userRatingCount: response.userRatingCount || 0,
    currentOpeningHours: response.currentOpeningHours,
  };
}

// Helper function to create search area from map bounds
export function createSearchAreaFromBounds(bounds: google.maps.LatLngBounds, type: 'rectangle' = 'rectangle'): SearchArea {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  return {
    type,
    rectangle: {
      low: { latitude: sw.lat(), longitude: sw.lng() },
      high: { latitude: ne.lat(), longitude: ne.lng() },
    },
  };
}

// Helper function to create search area from center point and radius
export function createSearchAreaFromCenter(
  center: { latitude: number; longitude: number },
  radiusMeters: number
): SearchArea {
  return {
    type: 'circle',
    circle: {
      center,
      radius: radiusMeters,
    },
  };
}