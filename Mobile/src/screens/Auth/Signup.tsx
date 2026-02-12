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
import { ArrowLeft, User, Mail, Phone, ArrowRight } from 'lucide-react-native';
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
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.titlePill}>
          <Text style={styles.titleText}>Create Account</Text>
        </View>
        <View style={styles.subtitlePill}>
          <Text style={styles.subtitleText}>Join Gupio today</Text>
        </View>

        <View style={styles.inputWrap}>
          <User size={20} color="#AAAAAA" style={styles.inputIcon} />
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
          <Mail size={20} color="#AAAAAA" style={styles.inputIcon} />
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
          <Phone size={20} color="#AAAAAA" style={styles.inputIcon} />
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
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitText}>Submit</Text>
              <ArrowRight size={20} color="#fff" />
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
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 24,
    top: 52,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titlePill: {
    width: '100%',
    backgroundColor: '#202020',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  subtitlePill: {
    width: '100%',
    backgroundColor: '#202020',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#282828',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 0,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#202020',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 52,
    marginTop: 8,
    marginBottom: 28,
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    fontSize: 14,
    color: '#f66',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 15,
    color: '#888',
    marginBottom: 10,
  },
  signInButton: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
