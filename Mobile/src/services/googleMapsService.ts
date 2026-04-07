import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBsSrCp8Icp5h2vnyd7J1Ob99Nk4sxschU';

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
};
