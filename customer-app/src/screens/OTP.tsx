// OTP.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Platform,
  Keyboard,
  Pressable,
  TextInput,
} from 'react-native';
import WaveLayout from '../components/CommonUI';
import Button from '../components/Button';
import { useNavigation, useRoute } from '@react-navigation/native';
import { verifyOtp, resendOtp } from '../services/authApi';
import { AuthContext } from '../context/AuthContext';
import { otpSchema } from '../validation/otpSchema';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
// prefer static require so bundler can include proper densities
const logo = require('../assets/logo.png');

// iOS code-field
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';

type OtpDigitRef = {
  focus: () => void;
  clear: () => void;
};
type OtpDigitProps = {
  value: string;
  index: number;
  size: number;
  fontSize: number;
  onChange: (text: string, index: number) => void;
  onKeyPress: (e: any, index: number) => void; // used only for Android
  editable?: boolean;
};
// Android path digit input — memoized to minimize re-renders
const OtpDigit = React.memo(
  forwardRef<OtpDigitRef, OtpDigitProps>((props, ref) => {
    const {
      value,
      size,
      fontSize,
      onChange,
      onKeyPress,
      editable = true,
    } = props;
    const localRef = useRef<TextInput | null>(null);
    useImperativeHandle(ref, () => ({
      focus: () => localRef.current?.focus(),
      clear: () =>
        localRef.current &&
        (localRef.current.setNativeProps({ text: '' }),
        onChange('', props.index)),
    }));
    return (
      <View
        style={[
          stylesStatic.otpWrapper,
          { width: size, height: size, borderRadius: size * 0.22 },
        ]}
      >
        <View style={stylesStatic.otpGlow} pointerEvents="none" />
        <TextInput
          ref={localRef}
          style={[stylesStatic.otpBox, { fontSize }]}
          value={value}
          onChangeText={text => onChange(text, props.index)}
          onKeyPress={e => onKeyPress(e, props.index)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          returnKeyType="done"
          underlineColorAndroid="transparent"
          selectionColor="#000"
          editable={editable}
        />
      </View>
    );
  }),
);

const CELL_COUNT = 4;

const OTP: React.FC = () => {
  // Error boundary - DO NOT return early here as it breaks React Hooks rules
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('OTP');

  // navigation / route / auth
  const navigation = useNavigation();
  const route = useRoute<any>();
  const identifier: string | undefined = route?.params?.identifier;
  const initialOtpToken: string | undefined = route?.params?.otpToken;
  const initialDemo: boolean = !!route?.params?.demo;
  const initialDemoOtp: string | undefined = route?.params?.demoOtp;
  const auth = React.useContext(AuthContext);

  // state
  const [otp, setOtp] = useState<string[]>(
    Array.from({ length: CELL_COUNT }, () => ''),
  );
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timer, setTimer] = useState<number>(180); // 3 minutes = 180 seconds
  const [showResend, setShowResend] = useState<boolean>(false);
  const [otpToken, setOtpToken] = useState<string | undefined>(initialOtpToken);
  const [isDemo, setIsDemo] = useState<boolean>(initialDemo);
  const [demoOtp, setDemoOtp] = useState<string | undefined>(initialDemoOtp);

  // refs for Android path inputs
  const inputRefs = useRef<Array<React.RefObject<OtpDigitRef>>>(
    Array.from({ length: CELL_COUNT }, () => React.createRef<OtpDigitRef>()) as any
  ).current;

  // iOS CodeField state
  const [codeValue, setCodeValue] = useState(''); // consolidated string for iOS
  const refCodeField = useBlurOnFulfill({
    value: codeValue,
    cellCount: CELL_COUNT,
  });
  const [propsClear, getCellOnLayoutHandler] = useClearByFocusCell({
    value: codeValue,
    setValue: setCodeValue,
  });

  const sizes = useMemo(() => {
    return {
      logoWidth: wp('38%'), // percentage-based, scales automatically
      logoHeight: hp('4.2%'),
      otpBoxSize: wp('14%'),
      otpFontSize: hp('3.6%'),
      headingSize: hp('3.2%'),
      subHeadingSize: hp('2%'),
      subHeadingSizeWait: hp('1.6%'),
      otpMarginTop: hp('6.5%'),
    };
  }, []);

  const styles = useMemo(() => createStyles(sizes), [sizes]);

  // This check is minimal and doesn't change base responsive sizes; it's only a small nudge for compact iPhones.
  // If you want zero branching at all, remove this and always use sizes.otpMarginTop.
  const deviceHeightPx = hp('100%'); // returns device height in px
  const isVeryShortIOS = Platform.OS === 'ios' && deviceHeightPx <= 680; // ~small compact iPhones
  const bottomExtraMarginTop = isVeryShortIOS
    ? sizes.otpMarginTop + hp('2%')
    : sizes.otpMarginTop;

  useEffect(() => {
    if (timer <= 0) {
      if (!showResend) setShowResend(true);
      return;
    }
    if (showResend) return;
    const id = setInterval(() => setTimer(p => p - 1), 1000);
    return () => clearInterval(id);
  }, [timer, showResend]);

  useEffect(() => {
    const otpValue = otp.join('');
    if (!otpValue) {
      setOtpError(null);
      return;
    }
    const result = otpSchema.safeParse({ otp: otpValue });
    setOtpError(result.success ? null : result.error.errors[0].message);
  }, [otp]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const arr = codeValue.split('').slice(0, CELL_COUNT);
      setOtp(Array.from({ length: CELL_COUNT }, (_, i) => arr[i] || ''));
    }
  }, [codeValue]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const joined = otp.join('').slice(0, CELL_COUNT);
      if (joined !== codeValue) setCodeValue(joined);
    }
  }, [otp]);

  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);

  // handlers (memoized)
  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const digitsOnly = text.replace(/\D/g, '');
      setOtp(prev => {
        if (prev[index] === digitsOnly.charAt(0)) return prev;
        const next = [...prev];
        next[index] = digitsOnly ? digitsOnly.charAt(0) : '';
        return next;
      });
      // Auto-focus to next box when digit is entered, but DO NOT dismiss keyboard
      if (digitsOnly && index < inputRefs.length - 1) {
        setTimeout(() => inputRefs[index + 1].current?.focus(), 0);
      }
    },
    [inputRefs],
  );

  // Android-only key handling kept as-is
  const handleKeyPress = useCallback(
    (e: any, index: number) => {
      if (e?.nativeEvent?.key !== 'Backspace') return;
      
      // Prevent default behavior to avoid black screen
      e.preventDefault?.();
      
      setOtp(prev => {
        const next = [...prev];
        if (next[index]) {
          // Current box has a digit, clear it
          next[index] = '';
          // Focus previous box after clearing
          if (index > 0) {
            setTimeout(
              () => inputRefs[index - 1].current?.focus(),
              0,
            );
          }
          setOtpError(null);
          return next;
        }
        // Current box is empty, focus previous and clear it
        if (index > 0) {
          next[index - 1] = '';
          setTimeout(() => inputRefs[index - 1].current?.focus(), 0);
          setOtpError(null);
          return next;
        }
        return next;
      });
    },
    [inputRefs],
  );

  const handleVerify = useCallback(async () => {
    const otpValue = otp.join('');
    const result = otpSchema.safeParse({ otp: otpValue });
    if (!result.success) {
      setOtpError(result.error.errors[0].message);
      return;
    }
    setOtpError(null);
    setIsVerifying(true);
    try {
      if (!identifier) throw new Error('Missing identifier');
      const res = await verifyOtp(identifier, otpValue, otpToken);
      // on success backend returns session token in res.data.token
      await auth.signIn(res.data.token, res.data.customer);

      // === NAVIGATE TO SUCCESS SCREEN ===
      // Replace the route name below if your navigator uses a different name.
      (navigation as any).navigate('SucessfullyLoggedIn', {
        customer: res.data.customer,
      } as never);
      // ==================================
    } catch (e: any) {
      setOtpError(e?.message || 'Failed to verify OTP');
    } finally {
      setIsVerifying(false);
    }
  }, [otp, identifier, auth, navigation, otpToken]);

  const handleResendOtp = useCallback(() => {
    setTimer(180); // 3 minutes = 180 seconds
    setShowResend(false);
    (async () => {
      try {
        if (!identifier) throw new Error('Missing identifier');
        const res = await resendOtp(identifier);
        const newToken = res?.data?.token;
        const newOtp = res?.data?.otp;
        setOtpToken(newToken);
        if (newOtp) {
          setIsDemo(true);
          setDemoOtp(newOtp);
        } else {
          setIsDemo(false);
          setDemoOtp(undefined);
        }
      } catch (err: any) {
        setOtpError(err?.message || 'Failed to resend OTP');
      }
    })();
  }, [identifier]);

  // Check error boundary AFTER all hooks
  if (error) return ErrorBoundaryUI;

  // stable button styles memoized
  const verifyButtonContainer = useMemo(
    () => ({
      backgroundColor: '#FFBF00',
      borderRadius: 15,
      alignSelf: 'center',
      paddingHorizontal: wp('20%'),
      paddingVertical: hp('1.55%'),
      marginTop: hp('4%'),
      shadowColor: '#4D6FFF',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    }),
    [],
  );

  const verifyTextStyle = useMemo(
    () => ({
      fontSize: hp('2.2%'),
      fontWeight: '700',
      color: '#000',
      fontFamily: 'Poppins-SemiBold',
    }),
    [],
  );

  return (
    <WaveLayout
      waveSectionStyle={{ minHeight: hp('40%') }}
      topContainerStyle={styles.topContainer}
      topContent={
        <Pressable
          onPress={dismissKeyboard}
          style={{ alignItems: 'center', width: '100%' }}
        >
          <View
            style={[
              styles.logoWrapper,
              { width: sizes.logoWidth, height: sizes.logoHeight },
            ]}
          >
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>

          <View>
            <Text style={[styles.WelcomeText, { fontSize: sizes.headingSize }]}>
              Enter OTP
            </Text>
            <Text
              style={[styles.subHeading, { fontSize: sizes.subHeadingSize }]}
            >
              OTP sent on Your registered{'\n'}Phone number/Email
            </Text>
          </View>
        </Pressable>
      }
      bottomPlatformAdjust={
        Platform.OS === 'ios'
          ? { marginTop: '-12%', paddingBottom: 0 }
          : { marginTop: '-9%', paddingBottom: 0 }
      }
      bottomContent={
        <Pressable onPress={dismissKeyboard} style={{ width: '100%' }}>
          <View
            style={[styles.bottomExtra, { marginTop: bottomExtraMarginTop }]}
          >
            <View
              style={{
                width: '100%',
                alignItems: 'center',
                marginBottom: hp('4%'),
              }}
            >
              {!!otpError && <Text style={styles.errorText}>{otpError}</Text>}

              <View style={[styles.otpContainer, { width: wp('85%') }]}>
                {Platform.OS === 'ios' ? (
                  <CodeField
                    ref={refCodeField}
                    {...propsClear}
                    value={codeValue}
                    onChangeText={text => {
                      const digitsOnly = text
                        .replace(/\D/g, '')
                        .slice(0, CELL_COUNT);
                      setCodeValue(digitsOnly);
                      // Clear error when user is typing
                      if (digitsOnly.length < codeValue.length) {
                        setOtpError(null);
                      }
                    }}
                    cellCount={CELL_COUNT}
                    rootStyle={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    editable={!isVerifying}
                    renderCell={({ index, symbol, isFocused }) => (
                      <View
                        key={index}
                        style={[
                          stylesStatic.otpWrapper,
                          {
                            width: sizes.otpBoxSize,
                            height: sizes.otpBoxSize,
                            borderRadius: sizes.otpBoxSize * 0.22,
                            justifyContent: 'center',
                            alignItems: 'center',
                          },
                        ]}
                      >
                        <View
                          style={stylesStatic.otpGlow}
                          pointerEvents="none"
                        />
                        <Text
                          onLayout={getCellOnLayoutHandler(index)}
                          style={[
                            stylesStatic.otpBox,
                            {
                              fontSize: sizes.otpFontSize,
                              textAlign: 'center',
                              includeFontPadding: false,
                              lineHeight: Math.round(sizes.otpBoxSize),
                            },
                          ]}
                        >
                          {symbol || (isFocused ? <Cursor /> : null)}
                        </Text>
                      </View>
                    )}
                  />
                ) : (
                  <>
                    {otp.map((digit, i) => (
                      <OtpDigit
                        key={i}
                        ref={inputRefs[i]}
                        value={digit}
                        index={i}
                        size={sizes.otpBoxSize}
                        fontSize={sizes.otpFontSize}
                        onChange={handleOtpChange}
                        onKeyPress={handleKeyPress}
                        editable={!isVerifying}
                      />
                    ))}
                  </>
                )}
              </View>

              {/* Timer / Resend */}
              <View style={styles.swapWrapper}>
                {showResend ? (
                  <View style={styles.resendContainerView}>
                    <Text
                      style={[
                        styles.notReceivedText,
                        { fontSize: sizes.subHeadingSize },
                      ]}
                    >
                      Not Received the OTP Yet
                    </Text>
                    <Text
                      style={[
                        styles.resendText,
                        {
                          fontSize: sizes.subHeadingSize,
                          fontWeight: '700',
                          color: '#1F1B4E',
                        },
                      ]}
                      onPress={handleResendOtp}
                    >
                      Resend?
                    </Text>
                  </View>
                ) : (
                  <View style={styles.timerContainerView}>
                    <Text
                      style={[
                        styles.timerText,
                        { fontSize: sizes.subHeadingSizeWait },
                      ]}
                    >
                      Wait {Math.floor(timer / 60).toString().padStart(2, '0')}:{(timer % 60).toString().padStart(2, '0')} to{' '}
                      <Text style={styles.timerTextBold}>resend OTP</Text>
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <Button
              title={isVerifying ? 'Verifying...' : 'Verify'}
              onPress={handleVerify}
              containerStyle={verifyButtonContainer}
              textStyle={verifyTextStyle}
              disabled={isVerifying}
              loading={isVerifying}
            />
          </View>
        </Pressable>
      }
    />
  );
};
export default OTP;

/* ---------- Static styles that never change ---------- */
const stylesStatic = StyleSheet.create({
  otpWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    marginHorizontal: wp('1%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    // allow iOS shadows to show (overflow:hidden clips shadows on iOS)
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
  },
  otpGlow: {
    position: 'absolute',
    bottom: -10,
    left: 8,
    right: 8,
    height: 18,
    borderRadius: 12,
    opacity: 0.9,
  },
  otpBox: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    includeFontPadding: false,
    padding: 0,
    margin: 0,
    zIndex: 1,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    color: '#000000',
  },
});

/* ---------- createStyles(sizes) -> StyleSheet.create ---------- */
const createStyles = (sizes: any) =>
  StyleSheet.create({
    logoWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Platform.OS === 'ios' ? hp('2%') : hp('3%'),
    },
    logo: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    topContainer: {
      flex: 1,
      paddingHorizontal: wp('0%'),
      paddingTop: Platform.OS === 'ios' ? hp('1%') : hp('1.5%'),
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    WelcomeText: {
      fontFamily: 'Poppins-SemiBold',
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: hp('0.5%'),
      marginTop: hp('3%'),
    },
    subHeading: {
      fontFamily: 'Poppins-Regular',
      fontWeight: '400',
      color: '#C1C1C1',
      textAlign: 'center',
      lineHeight: hp('2.5%'),
      opacity: 0.9,
    },
    bottomExtra: {
      alignItems: 'center',
      width: '100%',
    },
    errorText: {
      color: '#EF0000',
      fontWeight: '400',
      fontSize: hp('1.6%'),
      textAlign: 'center',
    },
    otpContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignSelf: 'center',
      alignItems: 'center',
      marginTop: hp('1.3%'),
      marginBottom: hp('1%'),
    },
    otpGlow: stylesStatic.otpGlow,
    otpWrapper: stylesStatic.otpWrapper,
    otpBox: stylesStatic.otpBox,
    swapWrapper: {
      width: '100%',
      alignItems: 'center',
      marginTop: hp('1.2%'),
    },
    timerContainerView: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginTop: hp('1%'),
    },
    resendContainerView: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    timerText: {
      color: '#000000',
      fontFamily: 'Poppins-Regular',
      textAlign: 'center',
      includeFontPadding: false,
    },
    timerTextBold: {
      color: '#000000',
      fontFamily: 'PublicSans-Bold',
      fontWeight: '700',
    },
    notReceivedText: {
      fontFamily: 'Poppins-Regular',
      color: '#717079',
      textAlign: 'center',
      marginBottom: hp('0.3%'),
    },
    resendText: {
      fontFamily: 'Poppins-SemiBold',
      color: '#15104B',
      textAlign: 'center',
    },
  });
