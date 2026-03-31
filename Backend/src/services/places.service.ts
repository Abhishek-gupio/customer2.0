import { Client } from "@googlemaps/google-maps-services-js";

const googleMapsClient = new Client({});

/** Haversine distance in km */
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type NearbyPlaceType = 
  | "gas_station" 
  | "car_wash"
  | "electric_charging_station" 
  | "hospital" 
  | "police" 
  | "car_repair" 
  | "parking" 
  | "lodging"
  | "tourist_attraction"
  | "park"
  | "museum"
  | "restaurant"
  | "car_rental"
  | "bicycle_store"
  | "insurance_agency"
  | "local_government_office";

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
export interface SearchSuggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

const PLACE_TYPE_MAP: Record<string, { type?: string; keyword?: string; keywordFallback?: string }> = {
  // For fuel, we want to explicitly target petrol pumps via keyword only.
  // We do NOT send type=gas_station so that results are purely "petrol pump" matches.
  gas_station: { keyword: "petrol pump" },
  car_wash: { keyword: "car wash" },
  electric_charging_station: { type: "electric_charging_station" },
  hospital: { keyword: "hospital" },
  police: { keyword: "police station" },
  car_repair: { keyword: "car repair" },
  parking: { type: "parking" },
  lodging: { type: "lodging" },
  tourist_attraction: { type: "tourist_attraction" },
  park: { type: "park" },
  museum: { type: "museum" },
  restaurant: { type: "restaurant" },
  car_rental: { type: "car_rental" },
  bicycle_store: { type: "bicycle_store" },
  insurance_agency: { type: "insurance_agency" },
  // In India, RTO offices are best approximated via local government offices.
  local_government_office: { type: "local_government_office", keywordFallback: "RTO office" },
};

function formatDistance(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

export const placesService = {
  getNearbyPlaces: async (
    latitude: number,
    longitude: number,
    placeType: NearbyPlaceType,
    radiusMeters: number = 10000,
  ): Promise<NearbyPlace[]> => {
    const config = PLACE_TYPE_MAP[placeType] || { type: placeType };
    const key = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!key) {
      console.warn("GOOGLE_MAPS_API_KEY not set; nearby places will be empty");
      return [];
    }
    try {
      const baseParams = {
        location: { lat: latitude, lng: longitude },
        radius: radiusMeters,
        key,
      };
      type Params = typeof baseParams & { type?: string; keyword?: string };

      const runSearch = async (params: Params): Promise<NearbyPlace[]> => {
        const response = await googleMapsClient.placesNearby({ params });
        const results = response.data.results || [];
        const status = response.data.status;
        if (status && status !== "OK" && status !== "ZERO_RESULTS") {
          console.warn("Places API status:", status, response.data.error_message || "");
        }
        return results.map((place) => {
          const lat = place.geometry?.location?.lat ?? 0;
          const lng = place.geometry?.location?.lng ?? 0;
          const dist = distanceKm(latitude, longitude, lat, lng);
          
          let imageUrl: string | undefined;
          if (place.photos && place.photos.length > 0) {
            const photoRef = place.photos[0].photo_reference;
            imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${key}`;
          }

          return {
            name: place.name || "Unknown",
            address: place.vicinity,
            latitude: lat,
            longitude: lng,
            distanceKm: dist,
            distanceText: formatDistance(dist),
            rating: place.rating,
            ratingCount: place.user_ratings_total,
            placeId: place.place_id || "",
            openNow: (place as any).opening_hours?.open_now,
            priceLevel: (place as any).price_level,
            businessStatus: (place as any).business_status,
            imageUrl,
          };
        });
      };

      let params: Params = { ...baseParams };
      if (config.type) params.type = config.type;
      if (config.keyword) params.keyword = config.keyword;

      let withDistance = await runSearch(params);

      if (withDistance.length === 0 && config.keywordFallback) {
        params = { ...baseParams, keyword: config.keywordFallback };
        delete (params as any).type;
        const fallback = await runSearch(params);
        const seen = new Set(withDistance.map((p) => p.placeId));
        for (const p of fallback) {
          if (p.placeId && !seen.has(p.placeId)) {
            seen.add(p.placeId);
            withDistance.push(p);
          }
        }
        withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
      } else {
        withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
      }

      return withDistance;
    } catch (err: any) {
      console.error("Places API error:", err?.message || err);
      return [];
    }
  },

  searchPlaces: async (query: string): Promise<SearchSuggestion[]> => {
    const key = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!key || !query) return [];

    try {
      const response = await googleMapsClient.placeAutocomplete({
        params: {
          input: query,
          components: ["country:in"], // Restrict to India
          key,
        },
      });

      const predictions = response.data.predictions || [];
      return predictions.map((p) => ({
        description: p.description,
        placeId: p.place_id,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
      }));
    } catch (err: any) {
      console.error("Places Autocomplete error:", err?.message || err);
      return [];
    }
  },
};
