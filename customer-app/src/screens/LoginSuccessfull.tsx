import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import WaveLayout from '../components/CommonUI';

const logo = require('../assets/logo.png');
const tick = require('../assets/Tick.png');

const LoginSuccessfull = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('LoginSuccessfull');
  if (error) return ErrorBoundaryUI;
  const navigation = useNavigation();
  const tickScale = useRef(new Animated.Value(0.2)).current; // start smaller
  const tickOpacity = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const textScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // After animation, wait and navigate to Home
    const timeout = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' as never }],
      });
    }, 3000); // 3s for animation, then go Home

    return () => clearTimeout(timeout);
  }, [navigation]);

  // Handle back button - exit app instead of going back to previous screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Exit the app when back button is pressed on login success screen
      BackHandler.exitApp();
      return true; // Prevent default back behavior
    });

    // Prevent navigation back using beforeRemove listener
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Prevent default behavior of going back
      e.preventDefault();
      // Exit app instead
      BackHandler.exitApp();
    });

    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    // Tick animation: grow from small → overshoot → settle
    Animated.parallel([
      Animated.timing(tickOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(tickScale, {
          toValue: 1.2, // overshoot
          duration: 400,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.spring(tickScale, {
          toValue: 1, // settle
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Text animation: very small delay
      const textDelay = 20; // decreased from 50ms

      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          delay: textDelay,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 400,
          delay: textDelay,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(textScale, {
            toValue: 1.05,
            duration: 150,
            delay: textDelay,
            useNativeDriver: true,
          }),
          Animated.timing(textScale, {
            toValue: 0.98,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(textScale, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  return (
    <WaveLayout
      topContent={
        <View style={styles.logoWrapper}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
      }
      topContainerStyle={styles.topContainer}
      topPlatformAdjust={Platform.select({
        ios: { marginTop: 20 },
        android: { marginTop: 40 },
      })}
      bottomPlatformAdjust={Platform.select({
        ios: { marginTop: '-14%', paddingBottom: 0 },
        android: { marginTop: '-9.5%', paddingBottom: 0 },
      })}
      bottomContent={
        <View style={styles.bottomContent}>
          <Animated.View
            style={[
              styles.tickWrapper,
              { transform: [{ scale: tickScale }], opacity: tickOpacity },
            ]}
          >
            <Image source={tick} style={styles.tick} resizeMode="contain" />
          </Animated.View>

          <Animated.Text
            style={[
              styles.textStyle,
              {
                opacity: textOpacity,
                transform: [
                  { translateY: textTranslateY },
                  { scale: textScale },
                ],
              },
            ]}
          >
            Successfully Logged in
          </Animated.Text>
        </View>
      }
    />
  );
};

export default LoginSuccessfull;

const styles = StyleSheet.create({
  logoWrapper: {
    width: 150,
    height: 33,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  topContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  bottomContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 30,
  },
  tickWrapper: {
    width: '50%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tick: {
    width: '100%',
    height: '100%',
  },
  textStyle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#433BC9',
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
});
