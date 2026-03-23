import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

export interface ResponsiveState {
  screenWidth: number;
  screenHeight: number;
  isSmallScreen: boolean;
  isMediumScreen: boolean;
  isLargeScreen: boolean;
}

/**
 * Centralized hook for responsive design utilities
 * Provides screen size detection and responsive state
 * 
 * @returns ResponsiveState object with screen dimensions and breakpoint flags
 * 
 * Breakpoints:
 * - Small: width <= 360 OR height < 640
 * - Medium: 360 < width < 400
 * - Large: width >= 400
 */
export const useResponsive = (): ResponsiveState => {
  const [dimensions, setDimensions] = useState<ScaledSize>(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;

  // Standard breakpoints used across most components
  const isSmallScreen = screenWidth <= 360 || screenHeight < 640;
  const isMediumScreen = screenWidth > 360 && screenWidth < 400;
  const isLargeScreen = screenWidth >= 400;

  return {
    screenWidth,
    screenHeight,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
  };
};

