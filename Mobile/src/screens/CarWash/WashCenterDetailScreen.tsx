import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { addDays, format, isSameDay } from 'date-fns';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  carwashService,
  type WashCenterDetail,
  type WashSlot,
  type WashType,
  WASH_TYPE_LABELS,
} from '../../services/carwashService';
import { openRazorpayCheckout, paymentsService } from '../../services/paymentsService';
import { useCarwashStore } from '../../store/carwashStore';

const WASH_TYPES: WashType[] = ['EXTERIOR', 'FOAM', 'INTERIOR', 'STEAM', 'DETAILING', 'CERAMIC_COATING'];

function generateIdempotencyKey(): string {
  return `washbooking_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function WashCenterDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { centerId } = route.params as { centerId: string };
  const notifyBookingChanged = useCarwashStore((s) => s.notifyBookingChanged);

  const [center, setCenter] = useState<WashCenterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [washType, setWashType] = useState<WashType>('EXTERIOR');
  const [slots, setSlots] = useState<WashSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [idempotencyKey] = useState(generateIdempotencyKey);

  const dateOptions = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  useEffect(() => {
    (async () => {
      try {
        const data = await carwashService.getCenter(centerId);
        setCenter(data);
      } catch (e: any) {
        setError(e?.message || 'Could not load this wash center.');
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  useEffect(() => {
    (async () => {
      setSlotsLoading(true);
      setSelectedSlotId(null);
      try {
        const data = await carwashService.getSlots(centerId, selectedDate);
        setSlots(data);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [centerId, selectedDate]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const handleBookAndPay = async () => {
    if (!center || !selectedSlot) return;
    setBooking(true);
    try {
      const { booking: newBooking, payment } = await carwashService.createVisitCenterBooking({
        centerId: center.id,
        slotId: selectedSlot.id,
        washType,
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
          name: center.name,
          description: `${WASH_TYPE_LABELS[washType]} — ${format(new Date(selectedSlot.startsAt), 'MMM d, h:mm a')}`,
        });
        await paymentsService.verifyOrder(payment.orderId, {
          razorpayPaymentId: result.razorpay_payment_id,
          razorpaySignature: result.razorpay_signature,
        }).catch(() => {});

        notifyBookingChanged();
        Alert.alert(
          'Payment received',
          "We're confirming your wash booking — it'll show as Confirmed in a few seconds.",
          [{ text: 'View my bookings', onPress: () => navigation.navigate('MyWashBookings') }],
        );
      } catch (checkoutErr: any) {
        Alert.alert('Payment not completed', checkoutErr?.description || 'Your slot hold will be released automatically.');
      }
    } catch (e: any) {
      Alert.alert('Could not book this slot', e?.message || 'Please try a different time.');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Wash Center</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !center) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Wash Center</Text>
        </View>
        <View style={styles.centerState}>
          <IconMC name="alert-circle-outline" size={wp(10)} color="#f59e0b" />
          <Text style={styles.centerStateText}>{error || 'Center not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{center.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.addressRow}>
            <IconMC name="map-marker" size={wp(4.5)} color="#FFBF00" />
            <Text style={styles.addressText}>{center.address}</Text>
          </View>
          <Text style={styles.dealerText}>Managed by {center.partner.name}</Text>
        </View>

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

        <Text style={styles.sectionTitle}>Date</Text>
        <View style={styles.dateRow}>
          {dateOptions.map((d) => {
            const active = isSameDay(d, selectedDate);
            return (
              <TouchableOpacity
                key={d.toISOString()}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.dateChipDay, active && styles.dateChipTextActive]}>{format(d, 'EEE')}</Text>
                <Text style={[styles.dateChipNum, active && styles.dateChipTextActive]}>{format(d, 'd')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Available slots</Text>
        {slotsLoading ? (
          <ActivityIndicator color="#FFBF00" style={{ marginVertical: hp(2) }} />
        ) : slots.length === 0 ? (
          <Text style={styles.emptySlotsText}>No slots for this date — try another day.</Text>
        ) : (
          <View style={styles.slotsWrap}>
            {slots.map((s) => {
              const full = s.available <= 0;
              const active = selectedSlotId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.slotChip, active && styles.slotChipActive, full && styles.slotChipDisabled]}
                  disabled={full}
                  onPress={() => setSelectedSlotId(s.id)}
                >
                  <Text style={[styles.slotChipText, active && styles.chipTextActive, full && styles.slotChipTextDisabled]}>
                    {format(new Date(s.startsAt), 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, !selectedSlot && styles.bookBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleBookAndPay}
          disabled={booking || !selectedSlot}
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
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3), flexShrink: 1 },
  scrollContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), paddingHorizontal: wp(8) },
  centerStateText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  card: { backgroundColor: '#111', borderRadius: 18, padding: wp(4.5), marginBottom: hp(1.8), borderWidth: 1, borderColor: '#222' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: wp(2.5), marginBottom: hp(1) },
  addressText: { flex: 1, color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
  dealerText: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.1) },
  sectionTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), marginBottom: hp(1.2), marginTop: hp(0.5) },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2), marginBottom: hp(1) },
  chip: { paddingHorizontal: wp(3.5), paddingVertical: hp(0.9), borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  chipActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  chipText: { color: '#aaa', fontFamily: 'Outfit-Medium', fontSize: wp(3.2) },
  chipTextActive: { color: '#111', fontFamily: 'Outfit-Bold' },
  dateRow: { flexDirection: 'row', gap: wp(2), marginBottom: hp(1) },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: hp(1), borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  dateChipActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  dateChipDay: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(2.8) },
  dateChipNum: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), marginTop: 2 },
  dateChipTextActive: { color: '#111' },
  emptySlotsText: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), marginBottom: hp(2) },
  slotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2), marginBottom: hp(2) },
  slotChip: { paddingHorizontal: wp(4), paddingVertical: hp(1), borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  slotChipActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  slotChipDisabled: { opacity: 0.35 },
  slotChipText: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
  slotChipTextDisabled: { color: '#666' },
  footer: { padding: wp(5), borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  bookBtn: { backgroundColor: '#FFBF00', borderRadius: 16, paddingVertical: hp(1.8), alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: '#333' },
  bookBtnText: { color: '#111', fontFamily: 'Outfit-Black', fontSize: wp(4) },
});
