import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  type ImageSourcePropType,
} from 'react-native';

const { width } = Dimensions.get('window');

const ANIMATION_CONFIG = {
  initialDelay: 300,
  carZoomDuration: 2000,
  brandingHoldDelay: 600,
  navigationDelay: 500,
} as const;

export interface SplashScreenProps {
  onComplete: () => void;
}

function SplashScreen(props: SplashScreenProps): React.ReactElement {
  const { onComplete } = props;
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [carScale] = useState(() => new Animated.Value(0.6));
  const [carTranslateY] = useState(() => new Animated.Value(30));
  const [shadowOpacity] = useState(() => new Animated.Value(0.1));

  useEffect(() => {
    const start = ANIMATION_CONFIG.initialDelay;
    const navDelay =
      start +
      ANIMATION_CONFIG.carZoomDuration +
      ANIMATION_CONFIG.brandingHoldDelay +
      ANIMATION_CONFIG.navigationDelay;

    const logoAnim = Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 2500,
      useNativeDriver: true,
      delay: start + ANIMATION_CONFIG.brandingHoldDelay,
    });

    const carAnim = Animated.parallel([
      Animated.timing(carScale, {
        toValue: 1,
        duration: ANIMATION_CONFIG.carZoomDuration,
        useNativeDriver: true,
        delay: start,
      }),
      Animated.timing(carTranslateY, {
        toValue: 0,
        duration: ANIMATION_CONFIG.carZoomDuration,
        useNativeDriver: true,
        delay: start,
      }),
      Animated.timing(shadowOpacity, {
        toValue: 0.4,
        duration: ANIMATION_CONFIG.carZoomDuration,
        useNativeDriver: true,
        delay: start,
      }),
    ]);

    Animated.parallel([logoAnim, carAnim]).start();

    const t = setTimeout(onComplete, navDelay);
    return () => clearTimeout(t);
  }, [onComplete, logoOpacity, carScale, carTranslateY, shadowOpacity]);

  return (
    <View style={styles.container}>
      <View style={styles.brandSection}>
        <Image
          source={require('../assets/images/splashScreen_bg.png') as ImageSourcePropType}
          style={styles.bgImage}
          resizeMode="contain"
        />
        <Animated.View style={[styles.logoWrap, { opacity: logoOpacity }]}>
          <Text style={styles.logoText}>GUPIO</Text>
          <Text style={styles.tagline}>Your Vehicle Partner</Text>
        </Animated.View>
      </View>

      <View style={styles.carSection}>
        <Animated.View style={[styles.shadow, { opacity: shadowOpacity }]} />
        <Animated.Image
          source={require('../assets/images/splashScreen_car.png') as ImageSourcePropType}
          style={[
            styles.carImage,
            {
              transform: [
                { scale: carScale },
                { translateY: carTranslateY },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  brandSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgImage: {
    position: 'absolute',
    top: '-5%',
    width: width * 0.9,
    maxWidth: 500,
    height: '60%',
    opacity: 0.8,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: -150,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffbf00',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,191,0,0.8)',
    marginTop: 4,
    letterSpacing: 2,
  },
  carSection: {
    position: 'absolute',
    bottom: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    bottom: -8,
    width: '60%',
    maxWidth: 250,
    height: 24,
    backgroundColor: '#000',
    borderRadius: 999,
  },
  carImage: {
    width: '83%',
    maxWidth: 350,
    height: 180,
  },
});

export default SplashScreen;
