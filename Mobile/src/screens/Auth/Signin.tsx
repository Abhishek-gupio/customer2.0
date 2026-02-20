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
          <Icon name="phone" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
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
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.socialButton}
          onPress={() => {}}
        >
          <Icon name="google" size={wp(5)} color="#fff" style={styles.socialIcon} />
          <Text style={styles.socialText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.socialButton}
          onPress={() => {}}
        >
          <Icon name="apple" size={wp(5.5)} color="#fff" style={styles.socialIcon} />
          <Text style={styles.socialText}>Sign in with Apple</Text>
        </TouchableOpacity>

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
    marginBottom: hp(3),
    alignItems: 'center',
  },
  logo: {
    width: wp(45),
    height: hp(7),
  },
  welcomeBack: {
    fontSize: wp(7),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(0.8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: wp(4),
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: hp(4),
    textAlign: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#282828',
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: wp(4),
    height: hp(6.5),
    marginBottom: hp(1.8),
  },
  inputIcon: {
    marginRight: wp(3),
  },
  input: {
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
    borderRadius: wp(3.5),
    height: hp(6.5),
    marginBottom: hp(3.5),
    gap: wp(2),
  },
  submitText: {
    fontSize: wp(4),
    fontWeight: '700',
    color: '#000',
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
    fontSize: wp(3.5),
    color: '#888',
    marginHorizontal: wp(3.5),
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#202020',
    borderRadius: wp(3.5),
    height: hp(6.5),
    marginBottom: hp(1.5),
  },
  socialIcon: {
    marginRight: wp(3),
  },
  socialText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#fff',
  },
  footerText: {
    fontSize: wp(3.8),
    color: '#888',
    marginTop: hp(3),
    marginBottom: hp(1.2),
    textAlign: 'center',
  },
  signUpButton: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: hp(6.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#fff',
  },
});
