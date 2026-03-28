import React, { useState, useRef, useEffect } from 'react';
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
  Keyboard,
  type ImageSourcePropType,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import BackButton from '../../components/BackButton';
import { useRoute, useNavigation, type RouteProp } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { sendOtp, verifyOtp } from '../../services/authService';
import { useAppDispatch } from '../../store/hooks';
import { setUser } from '../../store/slices/authSlice';


const OTP_LENGTH = 6;

export default function OTP() {
  const route = useRoute<RouteProp<RootStackParamList, 'OTP'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'OTP'>>();
  const dispatch = useAppDispatch();
  const phoneFromParams = route.params?.phone ?? '';
  const otpFromParams = route.params?.otp ?? '';
  const otpExpiresInFromParams = route.params?.otpExpiresIn;
  const initialExpirySec = typeof otpExpiresInFromParams === 'number' ? otpExpiresInFromParams : 300;

  const [otp, setOtp] = useState<string[]>(() => {
    if (otpFromParams && /^\d{6}$/.test(otpFromParams)) {
      return otpFromParams.split('');
    }
    return Array(OTP_LENGTH).fill('');
  });
  const [devOtp, setDevOtp] = useState(otpFromParams);
  const [remainingSec, setRemainingSec] = useState<number>(initialExpirySec);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (otpFromParams && /^\d{6}$/.test(otpFromParams)) {
      setOtp(otpFromParams.split(''));
    }
    setDevOtp(otpFromParams);
    if (typeof otpExpiresInFromParams === 'number') {
      setRemainingSec(otpExpiresInFromParams);
    }
  }, [otpFromParams, otpExpiresInFromParams]);

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  useEffect(() => {
    if (remainingSec <= 0) return;
    const timer = setInterval(() => {
      setRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSec]);

  const handleResend = async () => {
    if (!phoneFromParams || resending || remainingSec > 0) return;
    setResending(true);
    try {
      const data = await sendOtp(phoneFromParams);
      if (data.otp && /^\d{6}$/.test(data.otp)) {
        setDevOtp(data.otp);
      }
      const nextExpiry = typeof data.otpExpiresIn === 'number' ? data.otpExpiresIn : initialExpirySec;
      setRemainingSec(nextExpiry);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Alert.alert('OTP sent', 'A new OTP has been sent to your phone.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to resend OTP';
      Alert.alert('Resend failed', message);
    } finally {
      setResending(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) {
      const digits = value.slice(0, OTP_LENGTH).split('');
      setOtp((prev) => {
        const next = Array(OTP_LENGTH).fill('');
        digits.forEach((d, i) => { next[i] = d; });
        return next;
      });
      if (digits.length === OTP_LENGTH) {
        inputRefs.current[OTP_LENGTH - 1]?.blur();
        Keyboard.dismiss();
      } else {
        inputRefs.current[digits.length]?.focus();
      }
      return;
    }

    setOtp((prev) => {
      const next = [...prev];
      next[index] = value.slice(-1);
      return next;
    });

    if (value) {
      if (index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        inputRefs.current[index]?.blur();
        Keyboard.dismiss();
      }
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
      navigation.replace('LoginSuccessfull');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid OTP';
      Alert.alert('Verification failed', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const code = otp.join('');
    if (code.length === OTP_LENGTH && !loading) {
      handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BackButton onPress={() => navigation.navigate('Signin')} isAbsolute={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../assets/images/logo.png') as ImageSourcePropType}
          style={styles.logo}
          resizeMode="contain"
        />


        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>OTP sent on Your registered Phone number</Text>

        {!keyboardVisible && (
          <Image
            source={require('../../assets/images/image.png') as ImageSourcePropType}
            style={styles.illustration}
            resizeMode="contain"
          />
        )}

        {/* <Text style={styles.inputCodeLabel}>Input code</Text>  */}

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
              maxLength={OTP_LENGTH}
              selectTextOnFocus
              placeholder=""
              textContentType={i === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={i === 0 ? 'sms-otp' : 'off'}
              importantForAutofill={i === 0 ? 'yes' : 'no'}
            />
          ))}
        </View>

        {devOtp ? (
          <Text style={styles.devOtpText}>Dev OTP: {devOtp}</Text>
        ) : null}

        <View style={styles.resendRow}>
          {remainingSec > 0 ? (
            <Text style={styles.resendText}>Resend OTP in {formatTimer(remainingSec)}</Text>
          ) : (
            <Text style={styles.resendText}>Didn't receive the OTP?</Text>
          )}
          {remainingSec <= 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.resendButton, resending && styles.resendButtonDisabled]}
              onPress={handleResend}
              disabled={resending}
            >
              {resending ? null : (
                <Text style={styles.resendButtonText}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? null : (
            <Text style={styles.confirmText}>CONFIRM</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    paddingVertical: hp(4),
  },
  backButton: {
    position: 'absolute',
    left: wp(6),
    top: hp(5),
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logo: {
    width: wp(48),
    height: hp(6),
    marginBottom: hp(4),
  },
  title: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(8),
    color: '#FFFFFF',
    marginBottom: hp(1.5),
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Outfit-Regular',
    fontSize: wp(4.2),
    color: 'rgba(255,255,255,0.4)',
    marginBottom: hp(5),
    textAlign: 'center',
    lineHeight: wp(6),
  },
  illustration: {
    width: wp(65),
    height: hp(18),
    marginBottom: hp(4),
  },
  inputCodeLabel: {
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.8),
    color: '#888',
    marginBottom: hp(2),
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp(2.5),
    marginBottom: hp(4),
  },
  otpBox: {
    width: wp(12),
    height: hp(6.5),
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    padding: 0,
  },
  devOtpText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4),
    color: '#FFFFFF',
    marginBottom: hp(2),
    textAlign: 'center',
  },
  resendRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: hp(2.5),
    gap: hp(1),
  },
  resendText: {
    fontSize: wp(3.6),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  resendButton: {
    backgroundColor: '#FFBF00',
    borderRadius: 10,
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.2),
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },
  confirmButton: {
    width: '100%',
    backgroundColor: '#FFBF00',
    borderRadius: 18,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(4.5),
    color: '#000000',
    letterSpacing: 0,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
});
