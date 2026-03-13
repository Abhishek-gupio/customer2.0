import { api } from './api';

export interface NearbyPlace {
  name: string;
  address: string | undefined;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceText: string;
  rating: number | undefined;
  placeId: string;
  openNow?: boolean;
}

export type NearbyPlaceType =
  | 'gas_station'
  | 'electric_charging_station'
  | 'hospital'
  | 'police'
  | 'car_repair'
  | 'parking'
  | 'lodging';

interface NearbyResponse {
  success?: boolean;
  data?: {
    places: NearbyPlace[];
    location: { latitude: number; longitude: number };
  };
}

export const placesService = {
  getNearby: async (
    latitude: number,
    longitude: number,
    type: NearbyPlaceType = 'gas_station',
    radiusMeters?: number,
  ): Promise<NearbyPlace[]> => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      type,
    });
    if (radiusMeters != null) params.set('radius', String(radiusMeters));
    const res = await api.get<NearbyResponse>(`/v1/places/nearby?${params.toString()}`);
    const data = (res as any)?.data ?? res;
    const places = Array.isArray(data?.places) ? data.places : [];
    return places;
  },

  getNearbyFuelStations: (latitude: number, longitude: number, radiusMeters?: number) =>
    placesService.getNearby(latitude, longitude, 'gas_station', radiusMeters),
};
