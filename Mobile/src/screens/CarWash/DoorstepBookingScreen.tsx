import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  carwashService,
  type WashPartnerOption,
  type WashType,
  WASH_TYPE_LABELS,
} from '../../services/carwashService';
import { openRazorpayCheckout, paymentsService } from '../../services/paymentsService';
import { useCarwashStore } from '../../store/carwashStore';

const WASH_TYPES: WashType[] = ['EXTERIOR', 'FOAM', 'INTERIOR', 'STEAM', 'DETAILING', 'CERAMIC_COATING', 'BIKE_WASH', 'EV_SAFE_WASH'];

function generateIdempotencyKey(): string {
  return `washbooking_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function DoorstepBookingScreen() {
  const navigation = useNavigation<any>();
  const notifyBookingChanged = useCarwashStore((s) => s.notifyBookingChanged);

  const [partners, setPartners] = useState<WashPartnerOption[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [washType, setWashType] = useState<WashType>('EXTERIOR');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [addressLine, setAddressLine] = useState('');
  const [booking, setBooking] = useState(false);
  const [idempotencyKey] = useState(generateIdempotencyKey);

  useEffect(() => {
    carwashService.listPartners()
      .then((data) => {
        setPartners(data);
        if (data.length > 0) setPartnerId(data[0].id);
      })
      .finally(() => setLoadingPartners(false));
  }, []);

  const handleBookAndPay = async () => {
    if (!partnerId || !addressLine.trim()) return;
    setBooking(true);
    try {
      const { booking: newBooking, payment } = await carwashService.createDoorstepBooking({
        partnerId,
        washType,
        addressLine: addressLine.trim(),
        idempotencyKey,
      });

      if (!payment) {
        Alert.alert('Almost there', 'Setting up your payment — please tap Book & Pay again.');
        return;
      }

      try {
        const result = await openRazorpayCheckout({
          keyId: payment.keyId,
          razorpayOrderId: payment.razorpayOrderId,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          name: 'Doorstep Wash',
          description: WASH_TYPE_LABELS[washType],
        });
        await paymentsService.verifyOrder(payment.orderId, {
          razorpayPaymentId: result.razorpay_payment_id,
          razorpaySignature: result.razorpay_signature,
        }).catch(() => {});

        notifyBookingChanged();
        Alert.alert(
          'Payment received',
          "We're confirming your doorstep wash — a technician will be assigned shortly.",
          [{ text: 'View my bookings', onPress: () => navigation.navigate('MyWashBookings') }],
        );
      } catch (checkoutErr: any) {
        Alert.alert('Payment not completed', checkoutErr?.description || 'Please try booking again.');
      }
    } catch (e: any) {
      Alert.alert('Could not book doorstep wash', e?.message || 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const canSubmit = !!partnerId && addressLine.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Doorstep Wash</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Wash type</Text>
        <View style={styles.chipsRow}>
          {WASH_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, washType === t && styles.chipActive]}
              onPress={() => setWashType(t)}
            >
              <Text style={[styles.chipText, washType === t && styles.chipTextActive]}>{WASH_TYPE_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Wash partner</Text>
        {loadingPartners ? (
          <ActivityIndicator color="#FFBF00" style={{ marginVertical: hp(1.5) }} />
        ) : partners.length === 0 ? (
          <Text style={styles.emptyText}>No doorstep wash partners available in your area yet.</Text>
        ) : (
          <View style={styles.chipsRow}>
            {partners.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, partnerId === p.id && styles.chipActive]}
                onPress={() => setPartnerId(p.id)}
              >
                <Text style={[styles.chipText, partnerId === p.id && styles.chipTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Address</Text>
        <View style={styles.addressInputWrap}>
          <IconMC name="map-marker-outline" size={wp(4.5)} color="#FFBF00" />
          <TextInput
            value={addressLine}
            onChangeText={setAddressLine}
            placeholder="Home, office, apartment or parking lot address"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.addressInput}
            multiline
          />
        </View>

        <View style={styles.infoBanner}>
          <IconMC name="information-outline" size={wp(4)} color="#888" />
          <Text style={styles.infoBannerText}>
            A wash partner will be assigned once payment is confirmed. You'll get before/after photos and live status updates.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, !canSubmit && styles.bookBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleBookAndPay}
          disabled={booking || !canSubmit}
        >
          <Text style={styles.bookBtnText}>{booking ? 'Processing…' : 'Book & Pay'}</Text>
        </TouchableOpacity>
      </View>
      <LoadingSpinner visible={booking} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  scrollContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  sectionTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), marginBottom: hp(1.2), marginTop: hp(1) },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2), marginBottom: hp(1) },
  chip: { paddingHorizontal: wp(3.5), paddingVertical: hp(0.9), borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  chipActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  chipText: { color: '#aaa', fontFamily: 'Outfit-Medium', fontSize: wp(3.2) },
  chipTextActive: { color: '#111', fontFamily: 'Outfit-Bold' },
  emptyText: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), marginBottom: hp(1) },
  addressInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2.5),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
  },
  addressInput: { flex: 1, color: '#fff', fontFamily: 'Outfit-Regular', fontSize: wp(3.5), padding: 0, minHeight: hp(6) },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2.5),
    backgroundColor: '#111',
    borderRadius: 14,
    padding: wp(4),
    marginTop: hp(2),
    borderWidth: 1,
    borderColor: '#222',
  },
  infoBannerText: { flex: 1, color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3), lineHeight: wp(4.3) },
  footer: { padding: wp(5), borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  bookBtn: { backgroundColor: '#FFBF00', borderRadius: 16, paddingVertical: hp(1.8), alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: '#333' },
  bookBtnText: { color: '#111', fontFamily: 'Outfit-Black', fontSize: wp(4) },
});
