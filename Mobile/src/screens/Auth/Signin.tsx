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
  type ImageSourcePropType,
} from 'react-native';
import { Phone, ArrowRight } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';

type SigninScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signin'>;

export default function Signin() {
  const navigation = useNavigation<SigninScreenNavigationProp>();
  const [phone, setPhone] = useState('');

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

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.submitButton}
          onPress={() => {}}
        >
          <Text style={styles.submitText}>Submit</Text>
          <ArrowRight size={20} color="#fff" />
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
          <Icon name="google" size={20} color="#fff" style={styles.socialIcon} />
          <Text style={styles.socialText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.socialButton}
          onPress={() => {}}
        >
          <Icon name="apple" size={22} color="#fff" style={styles.socialIcon} />
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 56,
  },
  welcomeBack: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 32,
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
    marginBottom: 28,
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  orText: {
    fontSize: 14,
    color: '#888',
    marginHorizontal: 14,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#202020',
    borderRadius: 14,
    height: 52,
    marginBottom: 12,
  },
  socialIcon: {
    marginRight: 12,
  },
  socialText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  footerText: {
    fontSize: 15,
    color: '#888',
    marginTop: 24,
    marginBottom: 10,
  },
  signUpButton: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
