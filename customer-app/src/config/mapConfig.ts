/**
 * Google Maps Configuration for React Native Maps
 * This configuration uses Google Maps SDK for Android
 */

export const MAP_CONFIG = {
  // Google Maps provider
  provider: 'google' as const,
  
  // Default map type
  mapType: 'standard' as const,
  
  // Default region (Bangalore, India)
  defaultRegion: {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },
  
  // Map styling options (optional custom styling)
  mapStyle: [],
};

export default MAP_CONFIG;
