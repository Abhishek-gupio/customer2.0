import { api } from './api';

export interface NearbyPlace {
  name: string;
  address: string | undefined;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceText: string;
  rating: number | undefined;
  ratingCount?: number;
  placeId: string;
  openNow?: boolean;
  priceLevel?: number;
  businessStatus?: string;
  imageUrl?: string;
}

export const NEARBY_PLACE_TYPES = [
  'gas_station',
  'car_wash',
  'electric_charging_station',
  'hospital',
  'police',
  'car_repair',
  'parking',
  'lodging',
  'tourist_attraction',
  'park',
  'museum',
  'restaurant',
  'car_rental',
  'bicycle_store',
  'insurance_agency',
  'local_government_office',
] as const;

export type NearbyPlaceType = typeof NEARBY_PLACE_TYPES[number];

interface NearbyResponse {
  success?: boolean;
  data?: {
    places: NearbyPlace[];
    location: { latitude: number; longitude: number };
  };
}

export interface SearchSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface SearchResponse {
  success?: boolean;
  data?: {
    suggestions: SearchSuggestion[];
  };
}

export const placesService = {
  getNearby: async (
    latitude: number,
    longitude: number,
    type: NearbyPlaceType = "gas_station",
    radiusMeters?: number
  ): Promise<NearbyPlace[]> => {
    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        type,
      });
      if (radiusMeters != null) params.set("radius", String(radiusMeters));
      
      const res = await api.get<NearbyResponse>(
        `/v1/places/nearby?${params.toString()}`
      );
      
      const data = (res as any)?.data ?? res;
      return Array.isArray(data?.places) ? data.places : [];
    } catch (err) {
      console.error("Nearby Places API error:", err);
      return [];
    }
  },

  search: async (query: string): Promise<SearchSuggestion[]> => {
    if (!query || query.length < 3) return [];
    try {
      const res = await api.get<SearchResponse>(
        `/v1/places/search?q=${encodeURIComponent(query)}`
      );
      const data = (res as any)?.data ?? res;
      return Array.isArray(data?.suggestions) ? data.suggestions : [];
    } catch (err) {
      console.error("Search API error:", err);
      return [];
    }
  },

  getNearbyFuelStations: (
    latitude: number,
    longitude: number,
    radiusMeters?: number
  ) => placesService.getNearby(latitude, longitude, "gas_station", radiusMeters),

  getDetails: async (placeId: string): Promise<{ latitude: number; longitude: number; name: string } | null> => {
    try {
      const res = await api.get<{ data?: { latitude: number; longitude: number; name: string } }>(
        `/v1/places/details/${placeId}`,
      );
      const data = (res as any)?.data ?? res;
      return data?.latitude != null ? data : null;
    } catch (err) {
      console.error("Place Details API error:", err);
      return null;
    }
  },
};
