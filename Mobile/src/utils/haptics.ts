import { Vibration, Platform } from 'react-native';

/**
 * Universal tactile haptic feedback helper
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' = 'light') => {
  try {
    if (type === 'light' || type === 'selection') {
      Vibration.vibrate(Platform.OS === 'ios' ? 10 : 8);
    } else if (type === 'medium') {
      Vibration.vibrate(Platform.OS === 'ios' ? 25 : 20);
    } else if (type === 'heavy') {
      Vibration.vibrate(Platform.OS === 'ios' ? 45 : 35);
    } else if (type === 'success') {
      Vibration.vibrate([0, 15, 60, 20]);
    }
  } catch {
    // Ignore haptic errors if platform does not support vibration
  }
};
