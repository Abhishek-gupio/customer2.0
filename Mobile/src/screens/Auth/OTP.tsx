import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { verifyOtp } from '../../services/authService';
import { useAppDispatch } from '../../store/hooks';
import { setUser } from '../../store/slices/authSlice';

const OTP_LENGTH = 6;

export default function OTP() {
  const route = useRoute<RouteProp<RootStackParamList, 'OTP'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'OTP'>>();
  const dispatch = useAppDispatch();
  const phoneFromParams = route.params?.phone ?? '';
  const otpFromParams = route.params?.otp ?? '';

  const [otp, setOtp] = useState<string[]>(() => {
    if (otpFromParams && /^\d{6}$/.test(otpFromParams)) {
      return otpFromParams.split('');
    }
    return Array(OTP_LENGTH).fill('');
  });
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (otpFromParams && /^\d{6}$/.test(otpFromParams)) {
      setOtp(otpFromParams.split(''));
    }
  }, [otpFromParams]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;
    if (!phoneFromParams) {
      Alert.alert('Error', 'Phone number missing. Please go back and sign up again.');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyOtp(phoneFromParams, code);
      dispatch(setUser({ id: result.userId ?? '', email: undefined }));
      navigation.replace('Main', { screen: 'Home' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid OTP';
      Alert.alert('Verification failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>ENTER OTP</Text>
        {otpFromParams ? (
          <Text style={styles.devOtpText}>Dev OTP: {otpFromParams}</Text>
        ) : null}

        <View style={styles.otpRow}>
          {Array.from({ length: OTP_LENGTH }, (_, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              style={styles.otpBox}
              value={otp[i]}
              onChangeText={(v) => handleChange(v, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              placeholder=""
            />
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>CONFIRM</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: 1,
  },
  devOtpText: {
    fontSize: 18,
    color: '#FFBF00',
    marginBottom: 24,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 48,
  },
  otpBox: {
    width: 44,
    height: 52,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    fontSize: 22,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
    padding: 0,
  },
  confirmButton: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#243b32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
});
