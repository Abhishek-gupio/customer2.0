import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { COLORS } from '../../components/Vehicles/VehicleUI';

export default function CheckChallan() {
  const navigation = useNavigation();
  const [regNumber, setRegNumber] = useState('');
  
  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;

  const [isFocused, setIsFocused] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const placeholders = ['MH01CH4322', 'AP39CH5621', 'UP31CH4259'];

  useEffect(() => {
    // Floating movement
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse effect for background glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Scanning line animation
    Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Keyboard listeners to auto-switch focus state
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSub = Keyboard.addListener(showEvent, () => setIsFocused(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsFocused(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [floatAnim, scanAnim, pulseAnim]);

  // Typewriter animation for rotating number plate placeholders
  useEffect(() => {
    let currentIdx = 0;
    let placeholderIdx = 0;
    let isDeleting = false;
    let timeout: any;

    const animatePlaceholder = () => {
      const fullText = placeholders[placeholderIdx];

      if (!isDeleting) {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx + 1));
        currentIdx++;
        if (currentIdx === fullText.length) {
          isDeleting = true;
          timeout = setTimeout(animatePlaceholder, 2000); // Wait before deleting
        } else {
          timeout = setTimeout(animatePlaceholder, 150);
        }
      } else {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx - 1));
        currentIdx--;
        if (currentIdx === 0) {
          isDeleting = false;
          // Move to next placeholder in the list
          placeholderIdx = (placeholderIdx + 1) % placeholders.length;
          timeout = setTimeout(animatePlaceholder, 500); // Wait before typing next
        } else {
          timeout = setTimeout(animatePlaceholder, 100);
        }
      }
    };

    animatePlaceholder();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnim]);

  const heroHeight = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [hp(35), 0],
  });

  const heroOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const heroScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const rotate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '3deg'],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.05],
  });

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-wp(15), wp(15)],
  });

  const handleCheckDetails = () => {
    if (!regNumber.trim()) return;
    // API call logic would go here
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with standard BackButton and Title */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Check Challan</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isFocused && { paddingTop: hp(2) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isFocused}
        >
          {/* Animated Hero Section */}
          <Animated.View style={[
            styles.heroSection, 
            { 
              height: heroHeight, 
              opacity: heroOpacity,
              transform: [{ scale: heroScale }],
              overflow: 'hidden',
              marginBottom: isFocused ? 0 : hp(4)
            }
          ]}>
            <View style={styles.outerCircle}>
              {/* Pulsing Background Glow */}
              <Animated.View 
                style={[
                  styles.pulseGlow, 
                  { transform: [{ scale: pulseScale }], opacity: pulseOpacity }
                ]} 
              />
              
              <View style={styles.glassCircle}>
                {/* Floating Search Icon */}
                <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
                  <View style={styles.iconBackground}>
                    <Icon name="search-dollar" size={wp(11)} color={COLORS.primary} />
                  </View>
                </Animated.View>

                {/* Radar/Scanning Beam */}
                <Animated.View 
                  style={[
                    styles.scanBeam, 
                    { transform: [{ translateY: scanTranslateY }] }
                  ]} 
                >
                   <View style={styles.scanLineInner} />
                </Animated.View>
              </View>
            </View>
            
            <Text style={styles.heroTitle}>Traffic Challan Search</Text>
            <Text style={styles.heroSub}>
              Instantly find pending traffic fines for any vehicle using its registration number.
            </Text>
          </Animated.View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>ENTER VEHICLE NUMBER</Text>
            <View style={styles.plateInputContainer}>
              <View style={styles.indStrip}>
                <View style={styles.dot} />
                <Text style={styles.indText}>IND</Text>
              </View>
              <TextInput
                style={styles.plateInput}
                placeholder={animatedPlaceholder}
                placeholderTextColor="#fff"
                value={regNumber}
                onChangeText={setRegNumber}
                autoCapitalize="characters"
                maxLength={15}
                autoCorrect={false}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                !regNumber.trim() && styles.primaryBtnDisabled
              ]}
              onPress={handleCheckDetails}
              activeOpacity={0.85}
              disabled={!regNumber.trim()}
            >
              <Text style={styles.primaryBtnText}>CHECK DETAILS</Text>
            </TouchableOpacity>
          </View>

          {/* Trust Banner */}
          <View style={styles.trustBanner}>
            <IconMC name="shield-check" size={wp(5)} color="#444" />
            <Text style={styles.trustText}>OFFICIAL RTO VERIFIED DATA</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    backgroundColor: '#0a0a0a',
  },
  headerTitle: {
    flex: 1,
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp(6),
    paddingBottom: hp(4),
  },
  heroSection: {
    alignItems: 'center',
    marginTop: hp(4),
  },
  outerCircle: {
    width: wp(34),
    height: wp(34),
    borderRadius: wp(17),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(3),
    position: 'relative',
  },
  pulseGlow: {
    position: 'absolute',
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
    backgroundColor: COLORS.primary,
    zIndex: -2,
  },
  glassCircle: {
    width: wp(28),
    height: wp(28),
    borderRadius: wp(14),
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
  iconBackground: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: 'rgba(255,191,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBeam: {
    position: 'absolute',
    width: '150%',
    height: 40,
    zIndex: 1,
  },
  scanLineInner: {
    width: '100%',
    height: 3,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
    opacity: 0.6,
  },
  heroTitle: {
    fontSize: wp(7),
    fontFamily: 'Outfit-Black',
    color: '#fff',
    textAlign: 'center',
    marginBottom: hp(1.5),
  },
  heroSub: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Regular',
    color: '#888',
    textAlign: 'center',
    lineHeight: wp(6),
    paddingHorizontal: wp(4),
  },
  inputSection: {
    width: '100%',
  },
  inputLabel: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    color: '#555',
    marginBottom: hp(1.5),
    letterSpacing: 1.5,
    paddingLeft: 4,
  },
  plateInputContainer: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: hp(3),
  },
  plateInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(6),
    fontFamily: 'Outfit-Black',
    letterSpacing: 2,
    padding: 0,
  },
  indStrip: {
    backgroundColor: '#003399',
    width: wp(8),
    height: hp(5.5),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: '#8BC34A',
    borderRadius: 3,
    marginBottom: 4,
  },
  indText: {
    color: '#FFF',
    fontSize: wp(2),
    fontFamily: 'Outfit-Black',
  },
  primaryBtn: {
    backgroundColor: '#FFBF00',
    borderRadius: 18,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: '#222',
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Black',
    color: '#000',
    letterSpacing: 1,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: hp(6),
    marginBottom: hp(2),
  },
  trustText: {
    color: '#444',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
  },
});
