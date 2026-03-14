import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
  type ImageSourcePropType,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import type { NativeStackScreenProps } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SigninFirst'>;

const { width } = Dimensions.get('window');

export default function SigninFirst({ navigation }: Props) {
  const [carTranslateX] = useState(
    () => new Animated.Value(width * 0.8),
  );
  const [buttonScale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(carTranslateX, {
      toValue: 0,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [carTranslateX]);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleSigninPress = () => {
    Animated.timing(carTranslateX, {
      toValue: -width,
      duration: 950,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      navigation.navigate('Signin');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.centeredContent}>
        <Text style={styles.welcomeSmall}>Welcome to</Text>
        <Image
          source={require('../../assets/images/logo.png') as ImageSourcePropType}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <View style={styles.carSection}>
          <Animated.Image
            source={
              require('../../assets/images/signin_car.png') as ImageSourcePropType
            }
            style={[
              styles.carImage,
              {
                transform: [{ translateX: carTranslateX }],
              },
            ]}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.buttonSection}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.signinButton}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleSigninPress}
          >
            <Text style={styles.signinText}>Sign in</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeSmall: {
    fontFamily: 'Outfit-Bold',
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  logoImage: {
    width: width * 0.48,
    maxWidth: 200,
    height: 64,
    marginBottom: 10,
  },
  tagline: {
    marginTop: 2,
    marginBottom: 20,
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  carSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImage: {
    width: width * 1.14,
    maxWidth: 760,
    height: width * 0.8,
  },
  buttonSection: {
    paddingBottom: 8,
    justifyContent: 'flex-end',
  },
  signinButton: {
    backgroundColor: '#FFBF00',
    borderRadius: 18,
    width: '100%',
    height: 62,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signinText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(4.5),
    color: '#000000',
    letterSpacing: 0,
    fontWeight: '900',
  },
});

