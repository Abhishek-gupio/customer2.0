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
import type { NativeStackScreenProps } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SigninFirst'>;

const { width } = Dimensions.get('window');

export default function SigninFirst({ navigation }: Props) {
  const [carTranslateX] = useState(
    () => new Animated.Value(width * 0.8),
  );

  useEffect(() => {
    Animated.timing(carTranslateX, {
      toValue: 0,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [carTranslateX]);

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
              require('../../assets/images/car_hummar.png') as ImageSourcePropType
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
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.signinButton}
          onPress={handleSigninPress}
        >
          <Text style={styles.signinText}>Sign in</Text>
        </TouchableOpacity>
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
    fontSize: 36,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
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
    width: width * 1,
    // maxWidth: 700,
    height: width * 0.8,
  },
  buttonSection: {
    paddingBottom: 8,
    justifyContent: 'flex-end',
  },
  signinButton: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  signinText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});

