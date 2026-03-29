import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions, Text } from 'react-native';
import { DotLottie } from '@lottiefiles/dotlottie-react-native';

const { width, height } = Dimensions.get('window');
// Use the high-quality .lottie URL provided (12KB vs 65KB JSON)
const REMOTE_LOTTIE = "https://lottie.host/8d394a27-991c-42ea-a32e-b4936b4271ce/rdPBpsOtXE.lottie";

interface LoadingSpinnerProps {
  visible?: boolean;
  overlay?: boolean;
  source?: any;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  visible = true, 
  overlay = true,
  source = REMOTE_LOTTIE 
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setIsMounted(true), 200);
      return () => clearTimeout(timer);
    } else {
      setIsMounted(false);
    }
  }, [visible]);

  if (!visible) return null;

  // Use { uri: string } for remote or string-based paths
  const lottieSource = typeof source === 'string' ? { uri: source } : source;

  return (
    <View 
      style={[styles.container, overlay && styles.overlay]} 
      pointerEvents="auto"
    >
      <View style={styles.animationContainer}>
        {isMounted && (
          <DotLottie
            source={lottieSource}
            loop
            autoplay
            style={styles.lottie}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: 300,
    height: 300,
  },
});

export default LoadingSpinner;
