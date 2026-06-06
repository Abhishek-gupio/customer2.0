import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBsSrCp8Icp5h2vnyd7J1Ob99Nk4sxschU';

type AddressDetails = {
  full: string;
  parts: {
    City?: string;
    District?: string;
    State?: string;
    Country?: string;
    CountryCode?: string;
  };
  latitude: number;
  longitude: number;
};

function fallbackAddressDetails(lat: number, lng: number): AddressDetails {
  return {
    full: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    parts: {
      City: 'Unknown',
      Country: 'Unknown',
    },
    latitude: lat,
    longitude: lng,
  };
}

function pickAddressComponent(
  components: any[],
  ...types: string[]
): { long_name?: string; short_name?: string } | undefined {
  return components.find((component: any) =>
    Array.isArray(component?.types) &&
    types.some((type) => component.types.includes(type)),
  );
}

export const googleMapsService = {
  getCurrentLocation: async () => {
    try {
      const response = await axios.post(
        `https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_MAPS_API_KEY}`
      );
      return {
        latitude: response.data.location.lat,
        longitude: response.data.location.lng,
        accuracy: response.data.accuracy,
      };
    } catch (error) {
      console.error('Google Maps Geolocation Error:', error);
      throw error;
    }
  },

  getAddress: async (lat: number, lng: number) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error('Google Maps Geocoding Error:', error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  },

  getAddressDetails: async (lat: number, lng: number): Promise<AddressDetails> => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const result = response.data?.results?.[0];
      if (!result) {
        return fallbackAddressDetails(lat, lng);
      }

      const components = Array.isArray(result.address_components)
        ? result.address_components
        : [];
      const city =
        pickAddressComponent(components, 'locality', 'postal_town', 'sublocality', 'administrative_area_level_3')?.long_name ||
        pickAddressComponent(components, 'administrative_area_level_2')?.long_name;
      const district = pickAddressComponent(components, 'administrative_area_level_2')?.long_name;
      const state = pickAddressComponent(components, 'administrative_area_level_1')?.long_name;
      const countryComponent = pickAddressComponent(components, 'country');

      return {
        full: result.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        parts: {
          City: city || 'Unknown',
          District: district,
          State: state,
          Country: countryComponent?.long_name || 'Unknown',
          CountryCode: countryComponent?.short_name,
        },
        latitude: lat,
        longitude: lng,
      };
    } catch (error) {
      console.error('Google Maps Geocoding Error:', error);
      return fallbackAddressDetails(lat, lng);
    }
  },
};
