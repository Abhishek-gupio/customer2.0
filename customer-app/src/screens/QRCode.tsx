import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Platform,
  TouchableOpacity,
  Text,
  Animated,
  AppState,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import WaveLayout from '../components/CommonUI';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { createSocket } from '../services/socket';

// ⭐ Responsive lib
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const clock = require('../assets/clock.png');
const sideArrow = require('../assets/CaretLeft.png');

const QRCode: React.FC = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('QRCode');
  if (error) return ErrorBoundaryUI;
  const { customer } = useAuth();
  const navigation = useNavigation();
  const socketRef = useRef<any>(null);
  const { height: windowHeight } = useWindowDimensions();

  // tune cutoff for very small devices
  const isVerySmall = windowHeight <= 600;

  // tighten the back-button width so title and arrow are adjacent
  const BACK_BTN_WIDTH = isVerySmall ? wp('8%') : wp('10%');

  // make arrow slightly SMALLER on very small screens
  const ARROW_W = isVerySmall ? Math.round(wp('5%')) : Math.round(wp('5.5%'));
  const ARROW_H = isVerySmall ? Math.round(hp('2.8%')) : Math.round(hp('3%'));

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as never);
    }
  }, [navigation]);

  const [timeLeft, setTimeLeft] = useState(5 * 60);
  const expiryTimestampRef = useRef<number>(Date.now() + 5 * 60 * 1000);
  const [qrData, setQrData] = useState(generateQrData());

  const [blinkAnim] = useState(new Animated.Value(0));

  function generateQrData() {
    if (!customer?.phoneNumber) return 'No customer phone number available';

    const requestId = `gupioRequest${Math.floor(Math.random() * 100000)}`;
    const randomSalt = Math.floor(Math.random() * 1000000);
    return JSON.stringify({
      phoneNumber: customer.phoneNumber,
      requestId,
      generatedAt: new Date().toISOString(),
      salt: randomSalt,
    });
  }

  useEffect(() => {
    const computeTimeLeft = () => {
      const msLeft = Math.max(0, expiryTimestampRef.current - Date.now());
      const secondsLeft = Math.ceil(msLeft / 1000);
      setTimeLeft(secondsLeft);
      if (secondsLeft === 0) setQrData('');
    };

    const intervalId = setInterval(computeTimeLeft, 1000);
    computeTimeLeft();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') computeTimeLeft();
    });

    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 60 && timeLeft > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleRegenerate = () => {
    setQrData(generateQrData());
    expiryTimestampRef.current = Date.now() + 5 * 60 * 1000;
    setTimeLeft(5 * 60);
  };

  useEffect(() => {
    setQrData(generateQrData());
    expiryTimestampRef.current = Date.now() + 5 * 60 * 1000;
    setTimeLeft(5 * 60);
  }, [customer?.phoneNumber]);

  // SOCKET LISTENER
  useEffect(() => {
    if (!customer?.phoneNumber) return;

    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const socket = createSocket();
      socketRef.current = socket;

      // Normalize phone number by removing non-digits for room name
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const phoneNormalized = normalizePhone(customer.phoneNumber);
      const roomName = `customer_${phoneNormalized}`;

      socket.on('connect', () => {
        const transport = socket.io?.engine?.transport?.name || 'unknown';
        console.log(`✅ QRCode: Socket connected! [ID: ${socket.id}] [Transport: ${transport}]`);
        socket.emit('join', { role: 'customer', room: roomName });
        console.log('📡 QRCode: Joined room:', roomName);
      });

      socket.on('connect_error', (err: any) => {
        console.error('❌ QRCode: Socket connection error:', err.message);
      });

      socket.on('qr:scan:success', (data: any) => {
        // Normalize phone numbers for comparison
        if (!customer.phoneNumber) return;

        console.log('✅ QRCode: Received scan success event:', data);
        const dataPhoneNormalized = data.phoneNumber ? normalizePhone(data.phoneNumber) : null;
        const customerPhoneNormalized = normalizePhone(customer.phoneNumber);

        if (dataPhoneNormalized && dataPhoneNormalized === customerPhoneNormalized) {
          console.log('🎉 QRCode: Phone number matches! Navigating to Home.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' as never }],
          });
        } else {
          console.warn('⚠️ QRCode: Scan success for different phone number:', dataPhoneNormalized);
        }
      });

      socket.on('disconnect', (reason: string) => {
        console.log('❌ QRCode: Socket disconnected. Reason:', reason);
      });

    } catch (error) {
      console.error('❌ QRCode: Socket setup failed:', error);
    }

    return () => {
      if (socketRef.current) {
        console.log('🧹 QRCode: Cleaning up socket on unmount');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [customer?.phoneNumber]);

  if (error) return ErrorBoundaryUI;

  const header = useMemo(() => {
    return (
      <View
        style={[
          styles.header,
          {
            height: isVerySmall ? hp('7%') : hp('8%'),
            marginTop: Platform.OS === 'ios' ? hp('-2%') : hp('-2%'),
          }
        ]}
      >
        {/* Back + Title inline with no big gap */}
        <Pressable
          onPress={goBack}
          style={[styles.backButton, { width: BACK_BTN_WIDTH }]}
          android_ripple={{ color: '#00000010', radius: 22 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          {sideArrow ? (
            <Image
              source={sideArrow}
              style={{
                width: ARROW_W,
                height: ARROW_H,
                resizeMode: 'contain',
                tintColor: '#FFFFFF',
              }}
            />
          ) : (
            <Text
              style={[styles.backArrow, isVerySmall && styles.backArrowSmall]}
            >
              ‹
            </Text>
          )}
        </Pressable>

        {/* Title immediately after back button, minimal left margin */}
        <Text
          accessibilityRole="header"
          style={[
            styles.headerTitle,
            isVerySmall && styles.headerTitleSmall,
            { marginLeft: wp('1%') }, // minimal gap so not touching
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Customer Verification
        </Text>
      </View>
    );
  }, [BACK_BTN_WIDTH, ARROW_W, ARROW_H, goBack, isVerySmall, sideArrow]);

  const blinkStyle = { opacity: blinkAnim };
  const timerStyle =
    timeLeft <= 60 && timeLeft > 0
      ? [styles.timerText, { color: 'red', fontWeight: '600' as const }, blinkStyle]
      : styles.timerText;

  return (
    <>
      <WaveLayout
        waveSectionStyle={{ minHeight: hp('35%') }}
        topContent={
          <View style={styles.topWrapper}>
            {header}
            <View style={styles.subtitleContainer}>
              <Text style={styles.textStyle}>Scan this QR code</Text>
            </View>
          </View>
        }
        topContainerStyle={styles.topContainer}
        topPlatformAdjust={
          Platform.OS === 'ios' ? { marginTop: hp('0.5%') } : { marginTop: hp('2.5%') }
        }
        bottomPlatformAdjust={
          Platform.OS === 'ios'
            ? { marginTop: hp('-10%'), paddingBottom: hp('0%') }
            : { marginTop: hp('-8%'), paddingBottom: hp('0%') }
        }
        bottomContent={
          <View style={styles.bottomWrapper}>
            <View style={styles.QRWrapper}>
              <View>
                <QRCodeSVG
                  value={timeLeft === 0 ? 'expired' : qrData}
                  size={wp('45%')}
                  color={timeLeft === 0 ? 'gray' : '#1F1B4E'}
                  backgroundColor="#EDF1FF"
                />

                {timeLeft === 0 && (
                  <View style={styles.expiredOverlay}>
                    <Text style={styles.expiredText}>QR Expired</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.verificationRow}>
              <View style={styles.leftSection}>
                <Image source={clock} style={styles.clockIcon} />
                <Text style={styles.waitingText}>Waiting for verification</Text>
              </View>

              {timeLeft > 0 ? (
                <Animated.Text style={timerStyle}>
                  Expires in: {formatTime(timeLeft)}
                </Animated.Text>
              ) : (
                <TouchableOpacity style={styles.regenerateButton} onPress={handleRegenerate}>
                  <Text style={styles.regenerateText}>Regenerate QR</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
      />
    </>
  );
};

export default QRCode;

const styles = StyleSheet.create({
  topWrapper: {
    alignItems: 'center',
    width: wp('100%'),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    backgroundColor: 'transparent',
    width: wp('100%'),
    justifyContent: 'flex-start',
  },

  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: hp('0.4%'),
    paddingLeft: wp('1%'),
  },

  backArrow: {
    fontSize: hp('3%'),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 0,
    includeFontPadding: false,
    lineHeight: Math.round(hp('3.6%')),
  },

  backArrowSmall: {
    fontSize: hp('3%'),
    lineHeight: Math.round(hp('3.6%')),
  },

  headerTitle: {
    flex: 0,
    textAlign: 'left',
    fontSize: hp('2.6%'),
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  headerTitleSmall: {
    fontSize: hp('2.2%'),
  },

  subtitleContainer: {
    marginTop: hp('6.5%'),
    width: '100%',
    alignItems: 'center',
  },

  topContainer: {
    flex: 1,
    paddingHorizontal: wp('0%'),
    paddingTop: 0,
    alignItems: 'center',
  },

  bottomWrapper: {
    flex: 1,
    height: hp('100%'),
    alignItems: 'center',
  },

  QRWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: wp('7%'),
    backgroundColor: '#FFF',
    marginTop: hp('10%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#DBDBDB',

    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: { elevation: 0 },
    }),
  },

  textStyle: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: hp('2.8%'),
    fontFamily: 'Poppins',
    marginTop: hp('0.6%'),
  },

  regenerateButton: {
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: '#1F1B4E',
    borderRadius: wp('2%'),
  },

  regenerateText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: hp('1.8%'),
  },

  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: wp('90%'),
    marginTop: hp('4%'),
  },

  leftSection: { flexDirection: 'row', alignItems: 'center' },

  clockIcon: { width: wp('4%'), height: wp('4%'), marginRight: wp('2%'), tintColor: '#2D2AB2' },

  waitingText: {
    fontSize: hp('1.8%'),
    fontWeight: '600',
    color: '#2D2AB2',
  },

  timerText: {
    color: '#2D2AB2',
    fontWeight: '600',
    fontSize: hp('1.9%'),
  },

  expiredOverlay: {
    position: 'absolute',
    width: wp('45%'),
    height: wp('45%'),
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },

  expiredText: {
    color: 'red',
    fontSize: hp('2.2%'),
    fontWeight: '700',
  },
});
