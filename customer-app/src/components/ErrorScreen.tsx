import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import Button from './Button';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import RNRestart from 'react-native-restart';
const tryagainbutton = require('../assets/tryagainbutton.png');
type RootStackParamList = {
  Home: undefined;
  TrackVehicle: undefined;
};
interface ErrorScreenProps {
  onTryAgain?: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ onTryAgain }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  // Create animated value for image rotation
  const imageRotateValue = useRef(new Animated.Value(0)).current;
  const handleEmailPress = () => {
    Linking.openURL('mailto:contact@mygupio.com');
  };
  const handleTryAgain = () => {
    imageRotateValue.setValue(0);
    Animated.timing(imageRotateValue, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      if (onTryAgain) {
        onTryAgain();
      } else if (navigation && navigation.reset && navigation.getState) {
        const state = navigation.getState();
        if (state && state.routes && typeof state.index === 'number') {
          const currentRoute = state.routes[state.index]?.name || 'Home';
          navigation.reset({
            index: 0,
            routes: [{ name: currentRoute }],
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        }
      } else {
        RNRestart.Restart();
      }
    }, 1000); // 1 second delay after animation
  };

  const handleGoHome = () => {
    if (navigation && navigation.reset && navigation.getState) {
      const state = navigation.getState();
      if (state && state.routes && typeof state.index === 'number') {
        const currentRoute = state.routes[state.index]?.name;
        if (currentRoute !== 'Home') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        }
        // If already on Home, do nothing
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    } else if (navigation && navigation.navigate) {
      navigation.navigate('Home');
    }
    // Never reload the app
  };
  // Create rotation interpolation for image
  const imageRotate = imageRotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  // Custom animated image component
  const AnimatedTryAgainImage = () => (
    <Animated.Image
      source={tryagainbutton}
      style={[
        {
          width: 20,
          height: 20,
          tintColor: '#FFFFFF',
          transform: [{ rotate: imageRotate }],
        },
      ]}
      resizeMode="contain"
    />
  );
  return (
    <View style={styles.container}>
      {/* Error Icon with round container + drop shadow */}
      <View style={styles.iconWrap}>
        <Image
          source={require('../assets/Error.png')}
          style={styles.errorImage}
        />
      </View>
      {/* Title with explicit line break */}
      <Text style={styles.title}>Oops! Something {'\n'}went wrong</Text>
      {/* Subtitle */}
      <Text style={styles.subtitle}>
        We're sorry for the inconvenience. An unexpected error occurred while
        processing your request.
      </Text>
      {/* Custom Try Again Button with animated image */}
      <TouchableOpacity
        style={[styles.tryAgainButton, styles.tryAgainButtonStyle]}
        onPress={handleTryAgain}
        activeOpacity={0.8}
      >
        <View style={styles.buttonContent}>
          <AnimatedTryAgainImage />
          <Text style={styles.tryAgainText}> Try Again</Text>
        </View>
      </TouchableOpacity>
      <Button
        title=":house:  Go to Home"
        onPress={handleGoHome}
        containerStyle={styles.homeButtonStyle}
        textStyle={{ color: '#3478F6', fontWeight: '600', fontSize: 16 }}
      />
      {/* Email Hyperlink */}
      <TouchableOpacity onPress={handleEmailPress}>
        <Text style={styles.email}>:email: contact@mygupio.com</Text>
      </TouchableOpacity>
    </View>
  );
};
export default ErrorScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  /* Round 75x75 wrapper with red drop shadow (blur ~4) */
  iconWrap: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18, // gap above title
    // iOS shadow
    shadowColor: '#EF0000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2, // ~ blur 4 on iOS ≈ radius 2 (blur/2 guideline)
    // Android shadow
    elevation: 4,
  },
  errorImage: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 22,
    marginTop: 25,
    fontWeight: '800',
    color: '#1A1A40',
    textAlign: 'center',
    marginBottom: 30, // gap between title and subtitle
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 34, // gap before buttons,
    paddingHorizontal: 6,
  },
  // Custom Try Again Button styles
  tryAgainButton: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 50,
    paddingHorizontal: 26,
    paddingVertical: 10,
    minHeight: 38,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tryAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Custom styles for buttons to match original spacing
  tryAgainButtonStyle: {
    backgroundColor: '#3478F6',
    marginBottom: 34, // gap between buttons
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  homeButtonStyle: {
    borderColor: '#3478F6',
    marginBottom: 132, // gap before email
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  email: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
