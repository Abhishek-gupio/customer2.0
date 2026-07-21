import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { parkingService, type ParkingBooking, type ParkingBookingStatus } from '../../services/parkingService';
import { openRazorpayCheckout, paymentsService } from '../../services/paymentsService';
import { useParkingStore } from '../../store/parkingStore';

const STATUS_STYLE: Record<ParkingBookingStatus, { label: string; bg: string; fg: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
  CONFIRMED: { label: 'Confirmed', bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  COMPLETED: { label: 'Completed', bg: 'rgba(99,102,241,0.15)', fg: '#818cf8' },
  NO_SHOW: { label: 'No-show', bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
};

export default function MyParkingBookingsScreen() {
  const navigation = useNavigation<any>();
  const version = useParkingStore((s) => s.version);
  const notifyBookingChanged = useParkingStore((s) => s.notifyBookingChanged);

  const [bookings, setBookings] = useState<ParkingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [payingExtraId, setPayingExtraId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await parkingService.listMyBookings();
      setBookings(data);
    } catch (e: any) {
      Alert.alert('Could not load bookings', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const onCancel = (booking: ParkingBooking) => {
    Alert.alert('Cancel this booking?', 'If eligible, your payment will be refunded automatically.', [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(booking.id);
          try {
            await parkingService.cancelBooking(booking.id);
            notifyBookingChanged(booking.id);
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.message || 'Please try again.');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  const onPayExtra = async (booking: ParkingBooking) => {
    setPayingExtraId(booking.id);
    try {
      const payment = await parkingService.getExtraPayment(booking.id);
      const result = await openRazorpayCheckout({
        keyId: payment.keyId,
        razorpayOrderId: payment.razorpayOrderId,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        name: booking.listing?.name || 'Parking',
        description: 'Overstay charge',
      });
      await paymentsService.verifyOrder(payment.orderId, {
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      }).catch(() => {});
      notifyBookingChanged(booking.id);
      Alert.alert('Payment received', "We're confirming it now — checkout will complete in a few seconds.");
    } catch (e: any) {
      Alert.alert('Payment not completed', e?.description || e?.message || 'Please try again.');
    } finally {
      setPayingExtraId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>My Parking Bookings</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centerState}>
          <IconMC name="parking" size={wp(12)} color="#444" />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>Search for parking and book a spot to see it here.</Text>
          <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('ParkingSearch')}>
            <Text style={styles.searchBtnText}>Find parking</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
          renderItem={({ item }) => {
            const statusStyle = STATUS_STYLE[item.status];
            const cancellable = (item.status === 'PENDING_PAYMENT' || item.status === 'CONFIRMED') && !item.actualCheckOutTime;
            const awaitingOverstayPayment = item.status === 'CONFIRMED' && !!item.actualCheckOutTime && item.extraAmountPaise != null;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.listingName} numberOfLines={1}>{item.listing?.name || 'Parking'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
                  </View>
                </View>
                {item.listing?.addressLine ? (
                  <Text style={styles.listingAddress} numberOfLines={1}>{item.listing.addressLine}, {item.listing.city}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  <IconMC name="calendar-clock" size={wp(3.6)} color="#888" />
                  <Text style={styles.metaText}>
                    {format(new Date(item.startTime), 'MMM d, h:mm a')} – {format(new Date(item.endTime), 'h:mm a')}
                  </Text>
                </View>
                {awaitingOverstayPayment && (
                  <View style={styles.overstayBanner}>
                    <IconMC name="clock-alert-outline" size={wp(3.8)} color="#f59e0b" />
                    <Text style={styles.overstayText}>
                      Stayed longer than booked — pay ₹{((item.extraAmountPaise ?? 0) / 100).toFixed(0)} to complete checkout
                    </Text>
                  </View>
                )}
                <View style={styles.cardBottom}>
                  <Text style={styles.amountText}>₹{(item.amountPaise / 100).toFixed(0)}</Text>
                  {awaitingOverstayPayment ? (
                    <TouchableOpacity
                      style={styles.payExtraBtn}
                      onPress={() => onPayExtra(item)}
                      disabled={payingExtraId === item.id}
                    >
                      <Text style={styles.payExtraBtnText}>
                        {payingExtraId === item.id ? 'Processing…' : `Pay ₹${((item.extraAmountPaise ?? 0) / 100).toFixed(0)}`}
                      </Text>
                    </TouchableOpacity>
                  ) : cancellable ? (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => onCancel(item)}
                      disabled={cancellingId === item.id}
                    >
                      <Text style={styles.cancelBtnText}>{cancellingId === item.id ? 'Cancelling…' : 'Cancel'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1), paddingHorizontal: wp(8) },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5), marginTop: hp(1) },
  emptyText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  searchBtn: {
    marginTop: hp(2),
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.4),
    borderRadius: 12,
  },
  searchBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(3.6) },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  card: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: wp(4.5),
    marginBottom: hp(1.6),
    borderWidth: 1,
    borderColor: '#222',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hp(0.6) },
  listingName: { flex: 1, color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4), marginRight: wp(2) },
  statusBadge: { paddingHorizontal: wp(2.5), paddingVertical: hp(0.5), borderRadius: 8 },
  statusText: { fontFamily: 'Outfit-Bold', fontSize: wp(2.8) },
  listingAddress: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.1), marginBottom: hp(0.8) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: wp(1.5), marginBottom: hp(1.2) },
  metaText: { color: '#aaa', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountText: { color: '#FFBF00', fontFamily: 'Outfit-Black', fontSize: wp(4) },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 10,
  },
  cancelBtnText: { color: '#ef4444', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
  overstayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 10,
    padding: wp(2.5),
    marginBottom: hp(1.2),
  },
  overstayText: { flex: 1, color: '#f59e0b', fontFamily: 'Outfit-Medium', fontSize: wp(3) },
  payExtraBtn: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 10,
  },
  payExtraBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
});
