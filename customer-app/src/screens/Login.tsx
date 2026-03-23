import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Image, Platform, Keyboard, Animated, Easing, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { loginSchema } from '../validation/loginSchema';
import { z } from 'zod';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import WaveLayout from '../components/CommonUI';
import Button from '../components/Button';
import LabeledInput from '../components/LabeledInput';
import { useNavigation } from '@react-navigation/native';
import { sendOtp } from '../services/authApi';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const logo = require('../assets/logo.png');
const ValetParking = require('../assets/ValetParkingCarIllustration.png');
const UserIcon = require('../assets/UserIcon.png');

const { height: screenHeight } = Dimensions.get('window');

const Login: React.FC = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('Login');
  if (error) return ErrorBoundaryUI;

  const [value, setValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const textShiftX = useRef(new Animated.Value(0)).current;
  const imageShiftY = useRef(new Animated.Value(0)).current;
  const inputShiftY = useRef(new Animated.Value(0)).current;

  const handleChange = (text: string) => {
    const lower = text.toLowerCase();
    setValue(lower);
    const result = loginSchema.safeParse({ identifier: lower });
    setErrorMsg(result.success ? null : result.error.errors[0].message);
  };

  const onNavigate = async () => {
    const result = loginSchema.safeParse({ identifier: value });
    if (!result.success) {
      setErrorMsg(result.error.errors[0].message);
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const resp = await sendOtp(value);
      const token = resp?.data?.token;
      const demo = resp?.data?.demo;
      const demoOtp = resp?.data?.otp;
      // navigate to OTP screen with token (if any) and demo info
      (navigation as any).navigate('OTP', {
        identifier: value,
        otpToken: token,
        demo: !!demo,
        demoOtp: demoOtp,
      });
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardOpen(true);
        animateKeyboard(true);
      }
    );

    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardOpen(false);
        animateKeyboard(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const animateKeyboard = (open: boolean) => {
    const ios = Platform.OS === 'ios';

    // Improved responsive animation distances
    const textShift = screenHeight * 0.50;
    const imageShift = screenHeight * 0.01;
    const inputShift = screenHeight * 0.22;

    Animated.parallel([
      Animated.timing(textShiftX, {
        toValue: open ? -textShift : 0,
        duration: ios ? 550 : 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(imageShiftY, {
        toValue: open ? -imageShift : 0,
        duration: ios ? 550 : 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(inputShiftY, {
        toValue: open ? -inputShift : 0,
        duration: ios ? 550 : 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  return (
    <WaveLayout
      waveSectionStyle={{ minHeight: '35%' }}
      topContainerStyle={styles.topContainer}
      topContent={
        <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
          <View style={{ alignItems: 'center', width: '100%' }}>

            {/* Logo */}
            <View style={styles.logoWrapper}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>

            {/* Animated welcome */}
            <Animated.View style={{ transform: [{ translateX: textShiftX }] }}>
              <Text style={styles.WelcomeText}>Welcome!</Text>
              <Text style={styles.subHeading}>Sign in quickly to continue!</Text>
            </Animated.View>

          </View>
        </TouchableWithoutFeedback>
      }
      bottomPlatformAdjust={
        Platform.OS === 'ios'
          ? { marginTop: '-12%', paddingBottom: 0 }
          : { marginTop: '-9%', paddingBottom: 0 }
      }
      bottomContent={
        <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
          <Animated.View
            style={{
              alignItems: 'center',
              width: '100%',
              transform: [{ translateY: inputShiftY }],
            }}
          >

            {/* Car Illustration animating upward */}
            <Animated.View
              style={[
                styles.ValetParking,
                {
                  transform: [{ translateY: imageShiftY }],
                  marginBottom: hp('3%'),
                },
              ]}
            >
              <Image source={ValetParking} style={styles.ValetParkingImage} />
            </Animated.View>

            {/* Input */}
            <View style={{ width: '90%' }}>
              <LabeledInput
                containerStyle={{ marginVertical: 0 }}
                label="Please enter your Email ID or Phone number"
                placeholder="Email/Phone number"
                value={value}
                onChangeText={handleChange}
                leftIcon={<Image source={UserIcon} style={{ width: 20, height: 20 }} />}
                iosStyles={{
                  inputWrapperStyle: {
                    height: hp('5.9%'),
                    width : wp('80%'),
                    borderRadius: 8,
                    backgroundColor: '#F3F4F9',
                    borderColor: '#A9A9A9',
                    borderWidth: 0.6,
                    alignSelf: 'center',
                  },
                }}
                androidStyles={{
                  inputWrapperStyle: {
                    height: hp('5.9%'),
                    width: wp('80%'),
                    alignSelf: 'center',
                    borderRadius: 8,
                    backgroundColor: '#F3F4F9',
                    borderColor: '#A9A9A9',
                    borderWidth: 0.7,
                  },
                }}
                labelStyle={{
                  fontSize: hp('1.9%'),
                  fontWeight: '500',
                  color: '#000000',
                  marginBottom: hp('2%'),
                  alignSelf: 'center',
                  fontFamily: 'Poppins-Medium',
                }}
              />

              {!!errorMsg && (
                <Text
                  style={{
                    color: '#EF0000',
                    marginTop: hp('1.5%'),
                    marginBottom: hp('0.5%'),
                    fontWeight: '300',
                    fontSize: hp('1.6%'),
                    marginLeft: wp('5%'),
                    fontFamily: 'Poppins-Regular',
                  }}
                >
                  {errorMsg}
                </Text>
              )}
            </View>

            {/* Button */}
            <Button
              title={isSubmitting ? 'Verifying...' : 'Send OTP'}
              onPress={onNavigate}
              containerStyle={{
                backgroundColor: '#FFBF00',
                borderRadius: 10,
                alignSelf: 'center',
                paddingHorizontal: wp('17%'),
                paddingVertical: hp('1.5%'),
                marginTop: keyboardOpen
                  ? (errorMsg ? hp('5%') : hp('10%'))
                  : hp('4%'),
              }}
              textStyle={{
                fontSize: hp('1.9%'),
                fontWeight: '700',
                color: '#000',
                fontFamily: 'Poppins-Bold',
              }}
              disabled={isSubmitting}
              loading={isSubmitting}
            />

          </Animated.View>
        </TouchableWithoutFeedback>
      }
    />
  );
};

export default Login;


const styles = StyleSheet.create({
  logoWrapper: {
    width: wp('25%'),     // was 100
    height: hp('2.8%'),     // was 24
  },

  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  topContainer: {
  flex: 1,
  paddingHorizontal: wp('0%'),      // no horizontal padding but still responsive
  paddingTop: Platform.OS === 'ios' ? hp('1.2%') : hp('1.8%'), 
  alignItems: 'center',
},


  WelcomeText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '700',

    // responsive text
    fontSize: hp('3%'),

    // platform-specific top spacing
    marginTop: Platform.OS === 'ios' ? hp('5%') : hp('7%'),

    color: '#FFFFFF',
    textAlign: 'center',
  },

  subHeading: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '500',

    fontSize: hp('2%'),
    marginTop: hp('1%'),

    color: '#C4C1B8',
    textAlign: 'center',
  },

  ValetParking: {
  width: Platform.OS === 'ios' ? wp('65%') : wp('65%'),
  height: Platform.OS === 'ios' ? hp('25%') : hp('28%'),  // Android slightly taller
  justifyContent: 'center',
  alignItems: 'center',
},

ValetParkingImage: {
  width: '100%',
  height: '100%',
  resizeMode: 'contain',
},

});
