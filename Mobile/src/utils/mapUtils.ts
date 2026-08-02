import { Linking, Platform } from 'react-native';

export interface NavigationTarget {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

/**
 * Opens native Apple Maps (iOS) or Google Maps (Android/iOS fallback) to navigate to a target destination.
 */
export function openMapsNavigation(target: NavigationTarget, label?: string) {
  let destination = '';
  if (target.latitude != null && target.longitude != null) {
    destination = `${target.latitude},${target.longitude}`;
  } else if (target.address) {
    destination = encodeURIComponent(target.address);
  }

  if (!destination) return;

  const encodedLabel = label ? encodeURIComponent(label) : '';

  if (Platform.OS === 'ios') {
    const appleMapsUrl = encodedLabel
      ? `https://maps.apple.com/?daddr=${destination}&q=${encodedLabel}`
      : `https://maps.apple.com/?daddr=${destination}`;
    Linking.openURL(appleMapsUrl).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`).catch(() => {});
    });
  } else {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    Linking.openURL(googleMapsUrl).catch(() => {});
  }
}
