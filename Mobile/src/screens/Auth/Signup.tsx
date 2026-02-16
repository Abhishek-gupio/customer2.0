import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { signup as signupApi } from '../../services/authService';

type SignupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function Signup() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
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
      const data = await signupApi({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber,
      });
      navigation.navigate('OTP', {
        phone: phoneNumber,
        ...(data.otp && { otp: data.otp }),
      });
      if (data.otp) {
        Alert.alert('Dev OTP', `Use this OTP: ${data.otp}`, [{ text: 'OK' }]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Signup failed';
      setError(message);
      Alert.alert('Signup failed', message);
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
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => navigation.navigate('Signin')}
        >
          <Icon name="arrow-left" size={wp(5.5)} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.titleText}>Create Account</Text>
        <Text style={styles.subtitleText}>Join Gupio today</Text>

        <View style={styles.inputWrap}>
          <Icon name="user" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            placeholderTextColor="#AAAAAA"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputWrap}>
          <Icon name="envelope" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter email"
            placeholderTextColor="#AAAAAA"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputWrap}>
          <Icon name="phone" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            placeholderTextColor="#AAAAAA"
            value={phone}
            onChangeText={setPhone}
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

        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.signInButton}
          onPress={() => navigation.navigate('Signin')}
        >
          <Text style={styles.signInText}>Sign In</Text>
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
    paddingTop: hp(10),
  },
  backButton: {
    position: 'absolute',
    left: wp(6),
    top: hp(6),
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleText: {
    fontSize: wp(7.5),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: hp(1),
  },
  subtitleText: {
    fontSize: wp(3.8),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: hp(3.5),
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
    marginTop: hp(1),
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
    marginBottom: hp(1),
  },
  footerText: {
    fontSize: wp(3.8),
    color: '#888',
    marginBottom: hp(1.2),
  },
  signInButton: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: hp(6.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#fff',
  },
});
