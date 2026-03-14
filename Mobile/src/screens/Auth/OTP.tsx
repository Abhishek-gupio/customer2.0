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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (otpFromParams && /^\d{6}$/.test(otpFromParams)) {
      setOtp(otpFromParams.split(''));
    }
  }, [otpFromParams]);

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
      navigation.replace('LoginSuccessfull');
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
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.backButton}
        onPress={() => navigation.navigate('Signin')}
      >
        <Icon name="arrow-left" size={wp(5.5)} color="#fff" />
      </TouchableOpacity>

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
            source={require('../../assets/images/Car_OTP.png') as ImageSourcePropType}
            style={styles.illustration}
            resizeMode="contain"
          />
        )}

        <Text style={styles.inputCodeLabel}>Input code</Text>

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

        {otpFromParams ? (
          <Text style={styles.devOtpText}>Dev OTP: {otpFromParams}</Text>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
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
    fontWeight: '900',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
});
