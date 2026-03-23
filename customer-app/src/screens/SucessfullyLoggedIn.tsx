import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';

const successImage = require('../assets/SucessLog.png');

const NAV_DELAY_MS = 3000; // wait this long before navigating to Home

const SucessfullyLoggedIn: React.FC = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('SucessfullyLoggedIn');
  const navigation = useNavigation();

  // Track if navigation is in progress to prevent multiple navigations
  const isNavigatingRef = useRef(false);

  // Animated values
  const tickScale = useRef(new Animated.Value(0.2)).current; // start small
  const tickOpacity = useRef(new Animated.Value(0)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const textScale = useRef(new Animated.Value(0.8)).current;

  // Helper function to navigate to Home and reset navigation stack
  const navigateToHome = React.useCallback(() => {
    // Prevent multiple simultaneous navigation calls
    if (isNavigatingRef.current) {
      return;
    }
    
    isNavigatingRef.current = true;
    
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' as never }],
      });
    } catch (err) {
      // Fallback: try regular navigation if reset fails
      console.warn('Navigation reset failed, trying regular navigate:', err);
      try {
        (navigation as any).navigate('Home' as never);
      } catch (fallbackErr) {
        console.error('Navigation to Home failed:', fallbackErr);
        // Reset the flag on error so user can try again
        isNavigatingRef.current = false;
      }
    }
  }, [navigation]);

  useEffect(() => {
    if (error) return;

    // Start tick animation (opacity + scale with overshoot)
    Animated.parallel([
      Animated.timing(tickOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(tickScale, {
          toValue: 1.2, // overshoot
          duration: 420,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.spring(tickScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // After tick animation completes, animate text
      const textDelay = 30;
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 420,
          delay: textDelay,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 420,
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

    // Navigate to Home after NAV_DELAY_MS
    const navTimeout = setTimeout(() => {
      navigateToHome();
    }, NAV_DELAY_MS);

    return () => {
      // cleanup: stop animations and clear timeout
      tickOpacity.stopAnimation?.();
      tickScale.stopAnimation?.();
      textOpacity.stopAnimation?.();
      textTranslateY.stopAnimation?.();
      textScale.stopAnimation?.();
      clearTimeout(navTimeout);
    };
  }, [navigateToHome]); // include navigateToHome in dependencies

  // Handle back button - navigate to Home instead of going back to previous screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate to Home when back button is pressed on login success screen
      navigateToHome();
      return true; // Prevent default back behavior
    });

    // Handle swipe back gesture - navigate to Home instead of going back to OTP
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Check if this is a user-initiated back action (not programmatic navigation)
      const action = e.data?.action;
      const actionType = action?.type;
      const payload = action?.payload as any;
      const isUserInitiated = 
        actionType === 'GO_BACK' || 
        actionType === 'POP' ||
        (actionType === 'NAVIGATE' && payload?.name && payload.name !== 'Home');
      
      // Only intercept user-initiated back actions
      if (isUserInitiated) {
        // Prevent default behavior of going back to previous screen
        e.preventDefault();
        // Navigate to Home instead
        navigateToHome();
      }
      // If it's already navigating to Home, allow it to proceed
    });

    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [navigation, navigateToHome]);

  if (error) return ErrorBoundaryUI;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={Platform.OS === 'android'}
      />

      <View style={styles.content}>
        {/* Animated tick */}
        <Animated.View
          style={[
            styles.animatedTick,
            {
              transform: [{ scale: tickScale }],
              opacity: tickOpacity,
            },
          ]}
        >
          <Image source={successImage} style={styles.image} resizeMode="contain" />
        </Animated.View>

        {/* Animated Text */}
        <Animated.Text
          style={[
            styles.text,
            {
              opacity: textOpacity,
              transform: [
                { translateY: textTranslateY },
                { scale: textScale },
              ],
            },
          ]}
        >
          Successfully Logged in!
        </Animated.Text>
      </View>
    </View>
  );
};

export default SucessfullyLoggedIn;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },

  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('6%'),
  },

  /* Animated tick wrapper — keep image responsive */
  animatedTick: {
    width: wp('30%'),
    height: hp('18%'),
    marginBottom: hp('4%'),
    justifyContent: 'center',
    alignItems: 'center',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  text: {
    fontSize: hp('2.5%'),
    fontWeight: '700',
    color: '#000000',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-Bold',
    }),
    textAlign: 'center',
    maxWidth: wp('80%'),
  },
});

