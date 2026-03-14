import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';

type LoginSuccessfullScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'LoginSuccessfull'
>;

const DELAY_MS = 4000;

export default function LoginSuccessfull() {
  const navigation = useNavigation<LoginSuccessfullScreenNavigationProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Main', { screen: 'Home' });
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/success.png') as ImageSourcePropType}
        style={styles.successImage}
        resizeMode="contain"
      />
      <Text style={styles.title}>Login Successful</Text>
      <Text style={styles.subtitle}>Taking you to Home...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  successImage: {
    width: wp(35),
    height: wp(35),
    marginBottom: hp(3),
  },
  title: {
    fontSize: wp(6),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginBottom: hp(1),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});
