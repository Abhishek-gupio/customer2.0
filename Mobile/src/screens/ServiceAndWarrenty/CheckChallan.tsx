import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Linking,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';

export default function CheckChallan() {
  const navigation = useNavigation();
  const [regNumber, setRegNumber] = useState('');
  const [agreedToTC, setAgreedToTC] = useState(true);
  const receiptDrop = useRef(new Animated.Value(0)).current;
  const receiptFloat = useRef(new Animated.Value(0)).current;

  // Entry: receipt drops down from rupee area
  useEffect(() => {
    Animated.spring(receiptDrop, {
      toValue: 1,
      useNativeDriver: true,
      tension: 45,
      friction: 8,
    }).start();
  }, [receiptDrop]);

  // Looping float animation so receipt stays "animation type"
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(receiptFloat, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(receiptFloat, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [receiptFloat]);

  const receiptTranslateY = receiptDrop.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 0],
  });
  const receiptOpacity = receiptDrop.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.6, 1],
  });
  const floatOffset = receiptFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 4],
  });
  const floatScale = receiptFloat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.015, 1],
  });

  const handleCheckDetails = () => {
    if (!regNumber.trim()) return;
    // TODO: navigate to challan results or call API
  };

  const openTC = () => {
    Linking.openURL('https://example.com/terms').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={wp(5)} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check Pending Challans</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rupee symbols row (three ovals) */}
        <View style={styles.rupeeRow}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.rupeeOval}>
              <View style={styles.rupeeCircle}>
                <Text style={styles.rupeeSymbol}>₹</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Receipt – drops from rupee area, then gentle float animation */}
        <Animated.View
          style={[
            styles.receiptWrap,
            {
              opacity: receiptOpacity,
              transform: [
                { translateY: receiptTranslateY },
                { translateY: floatOffset },
                { scale: floatScale },
              ],
            },
          ]}
        >
          <View style={styles.receipt}>
            <Text style={styles.receiptLabel}>RECEIPT</Text>
            <View style={styles.receiptLine} />
            <View style={styles.receiptLine} />
            <View style={styles.receiptFooter}>
              <Text style={styles.receiptRupee}>₹</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Enter Registration Number"
            placeholderTextColor="#999"
            value={regNumber}
            onChangeText={setRegNumber}
            autoCapitalize="characters"
            maxLength={15}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !regNumber.trim() && styles.primaryBtnDisabled]}
          onPress={handleCheckDetails}
          activeOpacity={0.85}
          disabled={!regNumber.trim()}
        >
          <Text style={styles.primaryBtnText}>Check Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreedToTC(!agreedToTC)}
          activeOpacity={0.7}
        >
          {/* <View style={[styles.checkbox, agreedToTC && styles.checkboxChecked]}>
            {agreedToTC && <Icon name="check" size={wp(3)} color="#1a1a1a" />}
          </View> */}
          {/* <Text style={styles.tcText}>
            I agree to the <Text style={styles.tcLink} onPress={openTC}>T & C</Text>
          </Text> */}
        </TouchableOpacity>

        {/* <Text style={styles.sectionTitle}>Recommended Product for You</Text> */}
        {/* <TouchableOpacity style={styles.recommendedBanner} activeOpacity={0.9}>
          <View style={styles.recommendedTextWrap}>
            <Text style={styles.recommendedTitle}>Drive less? Pay less!</Text>
            <Text style={styles.recommendedSub}>with Digit Car Insurance</Text>
          </View>
          <View style={styles.recommendedCtaWrap}>
            <View style={styles.recommendedCta}>
              <Text style={styles.recommendedCtaText}>View Prices</Text>
            </View>
          </View>
        </TouchableOpacity> */}

        {/* <Text style={styles.sectionTitle}>Other Important Tools</Text>
        <View style={styles.toolsPlaceholder}>
          <IconMC name="wrench" size={wp(8)} color="#ccc" />
          <Text style={styles.toolsPlaceholderText}>More tools coming soon</Text>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  headerTitle: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  rupeeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  rupeeOval: {
    width: wp(18),
    height: wp(12),
    borderRadius: wp(9),
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: hp(0.5),
  },
  rupeeCircle: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#FFC107',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeSymbol: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
  },
  receiptWrap: {
    alignSelf: 'center',
    marginBottom: hp(2),
  },
  receipt: {
    width: wp(70),
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingTop: hp(1.5),
    paddingHorizontal: wp(4),
    paddingBottom: hp(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    minHeight: hp(12),
  },
  receiptLabel: {
    fontSize: wp(3.8),
    fontWeight: '700',
    color: '#b85c38',
    letterSpacing: 1,
    marginBottom: hp(1),
  },
  receiptLine: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginBottom: hp(1),
  },
  receiptFooter: {
    alignItems: 'flex-end',
    marginTop: hp(0.5),
  },
  receiptRupee: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#333',
  },
  inputWrap: {
    marginBottom: hp(2),
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.8),
    fontSize: wp(4),
    color: '#1a1a1a',
  },
  primaryBtn: {
    backgroundColor: '#FFC107',
    borderRadius: 10,
    paddingVertical: hp(1.8),
    alignItems: 'center',
    marginBottom: hp(2),
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(3),
  },
  checkbox: {
    width: wp(5),
    height: wp(5),
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#b85c38',
    marginRight: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FFC107',
    borderColor: '#FFC107',
  },
  tcText: {
    fontSize: wp(3.5),
    color: '#555',
  },
  tcLink: {
    color: '#b85c38',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: wp(4.2),
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: hp(1.5),
  },
  recommendedBanner: {
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(3),
    minHeight: hp(14),
  },
  recommendedTextWrap: {
    flex: 1,
  },
  recommendedTitle: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(0.3),
  },
  recommendedSub: {
    fontSize: wp(3.5),
    color: 'rgba(255,255,255,0.8)',
  },
  recommendedCtaWrap: {
    marginLeft: wp(2),
  },
  recommendedCta: {
    backgroundColor: '#FFC107',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderRadius: 20,
  },
  recommendedCtaText: {
    fontSize: wp(3.5),
    fontWeight: '700',
    color: '#1a1a1a',
  },
  toolsPlaceholder: {
    alignItems: 'center',
    paddingVertical: hp(3),
  },
  toolsPlaceholderText: {
    fontSize: wp(3.5),
    color: '#888',
    marginTop: hp(1),
  },
});
