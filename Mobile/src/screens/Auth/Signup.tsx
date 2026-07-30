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
  Animated,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import BackButton from '../../components/BackButton';
import LoaderButton from '../../components/Button';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { formatPhoneNumber, signup as signupApi } from '../../services/authService';
import { getAuthErrorMessage } from '../../utils/errorHandlers';
import { validateIndianPhone } from '../../utils/validators';


type SignupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function Signup() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buttonScale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

    const validationError = validateIndianPhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    try {
      const phoneNumber = formatPhoneNumber(phone);
      const otpRequestedAt = Date.now();
      const data = await signupApi({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber,
      });
      navigation.navigate('OTP', {
        phone: phoneNumber,
        ...(typeof data.otpExpiresIn === 'number' && { otpExpiresIn: data.otpExpiresIn }),
        ...(typeof data.otpResendIn === 'number' && { otpResendIn: data.otpResendIn }),
        otpRequestedAt,
      });
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

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

        <Text style={styles.titleText}>Create Account</Text>
        <Text style={styles.subtitleText}>Join Gupio today</Text>

        <View style={styles.inputWrap}>
          <Icon name="user" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            placeholderTextColor="#AAAAAA"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setError('');
            }}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <View style={styles.inputWrap}>
          <Icon name="envelope" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter email"
            placeholderTextColor="#AAAAAA"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <View style={styles.inputWrap}>
          <Icon name="phone-alt" size={wp(5)} color="#AAAAAA" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            placeholderTextColor="#AAAAAA"
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setError('');
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Animated.View style={{ width: '100%', transform: [{ scale: buttonScale }] }}>
          <View onTouchStart={handlePressIn} onTouchEnd={handlePressOut}>
            <LoaderButton
              title="Create Account"
              loading={loading}
              onPress={handleSubmit}
              style={styles.submitButton}
            />
          </View>
        </Animated.View>

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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161616',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(8),
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: hp(1.2),
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontFamily: 'Outfit-Regular',
    fontSize: wp(4.2),
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: hp(5),
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
    width: '100%',
    backgroundColor: '#5F9EA0',
    borderRadius: 18,
    height: 62,
    marginTop: hp(1.5),
    marginBottom: hp(4),
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
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
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.8),
    color: '#888',
    marginBottom: hp(1.2),
  },
  signInButton: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontFamily: 'Outfit-SemiBold',
    fontSize: wp(4.5),
    color: '#fff',
    letterSpacing: 0.5,
  },
});
