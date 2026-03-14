import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  type ImageSourcePropType,
  Animated as RNAnimated,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { login as loginApi } from '../../services/authService';

type SigninScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signin'>;

export default function Signin() {
  const navigation = useNavigation<SigninScreenNavigationProp>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buttonScale] = useState(() => new RNAnimated.Value(1));

  const handlePressIn = () => {
    RNAnimated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const phoneNumber = digits.length === 10 ? `+91${digits}` : phone.trim();
      const data = await loginApi(phoneNumber);
      navigation.navigate('OTP', {
        phone: phoneNumber,
        ...(data.otp && { otp: data.otp }),
        ...(typeof data.otpExpiresIn === 'number' && { otpExpiresIn: data.otpExpiresIn }),
      });
      if (data.otp) {
        Alert.alert('Dev OTP', `Use this OTP: ${data.otp}`, [{ text: 'OK' }]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign in failed';
      if (
        message.toLowerCase().includes('please sign up') ||
        message.toLowerCase().includes('sign up')
      ) {
        setError('Please sign up');
        Alert.alert('Not registered', 'This number is not registered. Please sign up.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Up', onPress: () => navigation.navigate('Signup') },
        ]);
      } else if (
        message.toLowerCase().includes('invalid phone') ||
        message.toLowerCase().includes('invalid number') ||
        message.toLowerCase().includes('not a valid')
      ) {
        setError('Invalid number');
        Alert.alert('Invalid number', 'Please enter a valid phone number.');
      } else {
        setError(message);
        Alert.alert('Sign in failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/images/logo.png') as ImageSourcePropType}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeBack}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.inputWrap}>
          <Icon name="phone-alt" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            placeholderTextColor="#AAAAAA"
            value={phone}
            onChangeText={(t) => { setPhone(t); setError(''); }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <RNAnimated.View style={{ width: '100%', transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.submitText}>Submit</Text>
                <Icon name="arrow-right" size={wp(5)} color="#000" />
              </>
            )}
          </TouchableOpacity>
        </RNAnimated.View>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.socialButton}
          onPress={() => { }}
        >
          <Image
            source={require('../../assets/images/google_g.png') as ImageSourcePropType}
            style={styles.googleIcon}
            resizeMode="contain"
          />
          <Text style={styles.socialText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* 
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.socialButton}
          onPress={() => { }}
        >
          <Icon name="apple" size={wp(5.5)} color="#fff" style={styles.socialIcon} />
          <Text style={styles.socialText}>Sign in with Apple</Text>
        </TouchableOpacity>
        */}

        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.signUpButton}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.signUpText}>Sign Up</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    paddingVertical: hp(4),
  },
  logoWrap: {
    marginBottom: hp(4),
    alignItems: 'center',
  },
  logo: {
    width: wp(48),
    height: hp(7),
  },
  welcomeBack: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(8),
    color: '#FFFFFF',
    marginBottom: hp(1.5),
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: wp(4.2),
    color: 'rgba(255,255,255,0.4)',
    marginBottom: hp(5),
    textAlign: 'center',
    lineHeight: wp(6),
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: wp(5),
    height: 62,
    marginBottom: hp(2),
  },
  inputIcon: {
    marginRight: wp(3),
    width: wp(5.5),
    textAlign: 'center',
  },
  input: {
    fontFamily: 'Outfit-Regular',
    flex: 1,
    fontSize: wp(4),
    color: '#fff',
    paddingVertical: 0,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#FFBF00',
    borderRadius: 18,
    height: 62,
    marginBottom: hp(4),
    gap: wp(3),
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  submitText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(4.5),
    color: '#000000',
    letterSpacing: 0,
    fontWeight: '900',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    fontSize: wp(3.5),
    color: '#f66',
    marginBottom: hp(1.5),
    textAlign: 'center',
    width: '100%',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: hp(3.5),
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  orText: {
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.5),
    color: '#888',
    marginHorizontal: wp(3.5),
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 18,
    height: 62,
    marginBottom: hp(1.5),
  },
  googleIcon: {
    width: 15,
    height: 15,
    marginRight: wp(3),
  },
  socialIcon: {
    marginRight: wp(3),
  },
  socialText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(4.5),
    color: '#fff',
    letterSpacing: 0.5,
  },
  footerText: {
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.8),
    color: '#888',
    marginTop: hp(3.5),
    marginBottom: hp(1.2),
    textAlign: 'center',
  },
  signUpButton: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(4.5),
    color: '#fff',
    letterSpacing: 0.5,
  },
});
