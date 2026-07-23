import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import { parkingService, type ParkingListingDetail } from '../../services/parkingService';
import { openRazorpayCheckout, paymentsService } from '../../services/paymentsService';
import { vehicleService, type Vehicle } from '../../services/vehicleService';
import { useParkingStore } from '../../store/parkingStore';

function hourLabel(h: number): string {
  const period = h < 12 || h === 24 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${h === 24 || h >= 12 ? 'PM' : period}`;
}

/** Not a strict UUID — just needs to be unique and, importantly, the SAME value across retries of one tap. */
function generateIdempotencyKey(): string {
  return `booking_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function ParkingListingDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { listingId, date, startHour, endHour } = route.params as {
    listingId: string;
    date: string;
    startHour: number;
    endHour: number;
  };
  const notifyBookingChanged = useParkingStore((s) => s.notifyBookingChanged);

  const [listing, setListing] = useState<ParkingListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stable for the life of this screen instance, so retrying "Book & Pay" after a
  // network error reuses the same key instead of risking a second booking.
  const [idempotencyKey] = useState(generateIdempotencyKey);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await parkingService.getListing(listingId);
        setListing(data);
      } catch (e: any) {
        setError(e?.message || 'Could not load this listing.');
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  useEffect(() => {
    (async () => {
      try {
        const list = await vehicleService.getVehicles();
        setVehicles(list);
        const primary = list.find((v) => v.isPrimary) ?? list[0];
        if (primary) setSelectedVehicleId(primary.id);
      } catch {
        // Non-fatal — the "select vehicle" tile will just show the empty state.
      }
    })();
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const hours = Math.max(1, endHour - startHour);
  const totalPaise = listing ? hours * listing.hourlyRatePaise : 0;
  const selectedDate = new Date(date);

  const handleBookAndPay = async () => {
    if (!listing) return;
    if (!selectedVehicleId) {
      Alert.alert('Select a vehicle', 'Choose which vehicle you\'re parking before booking.');
      return;
    }
    setBooking(true);
    try {
      const startTime = new Date(selectedDate);
      startTime.setHours(startHour, 0, 0, 0);
      const endTime = new Date(selectedDate);
      endTime.setHours(endHour === 24 ? 23 : endHour, endHour === 24 ? 59 : 0, 0, 0);

      const { booking: newBooking, payment } = await parkingService.createBooking({
        listingId: listing.id,
        vehicleId: selectedVehicleId,
        startTime,
        endTime,
        idempotencyKey,
      });

      if (!payment) {
        // Extremely narrow window: an earlier attempt's booking exists but its
        // payment order hadn't been created yet. Safe to just ask for a retry.
        Alert.alert('Almost there', 'Setting up your payment — please tap Book & Pay again.');
        return;
      }

      try {
        const result = await openRazorpayCheckout({
          keyId: payment.keyId,
          razorpayOrderId: payment.razorpayOrderId,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          name: listing.name,
          description: `Parking ${format(startTime, 'MMM d, h:mm a')} – ${format(endTime, 'h:mm a')}`,
        });
        // Fast client-side check for snappy UI; the webhook is the source of truth
        // and will confirm the booking shortly even if this call fails.
        await paymentsService.verifyOrder(payment.orderId, {
          razorpayPaymentId: result.razorpay_payment_id,
          razorpaySignature: result.razorpay_signature,
        }).catch(() => {});

        notifyBookingChanged(newBooking.id);
        Alert.alert(
          'Payment received',
          "We're confirming your booking now — it'll show as Confirmed in a few seconds.",
          [{ text: 'View my bookings', onPress: () => navigation.navigate('MyParkingBookings') }],
        );
      } catch (checkoutErr: any) {
        // Razorpay checkout cancelled/failed client-side. The order stays PENDING_PAYMENT;
        // the payment.failed webhook (if Razorpay reports one) or the abandoned-hold cleanup
        // job releases the hold automatically — no manual cleanup needed here.
        Alert.alert(
          'Payment not completed',
          checkoutErr?.description || 'Your parking hold will be released automatically.',
        );
      }
    } catch (e: any) {
      if (e?.message?.includes('already booked this slot')) {
        Alert.alert(
          "You're all set",
          "You've already booked this slot — no need to book it again.",
          [
            { text: 'View my bookings', onPress: () => navigation.navigate('MyParkingBookings') },
            { text: 'OK', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Could not book this slot', e?.message || 'Please try a different time window.');
      }
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Parking</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Parking</Text>
        </View>
        <View style={styles.centerState}>
          <IconMC name="alert-circle-outline" size={wp(10)} color="#f59e0b" />
          <Text style={styles.centerStateText}>{error || 'Listing not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{listing.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.addressRow}>
            <IconMC name="map-marker" size={wp(4.5)} color="#FFBF00" />
            <Text style={styles.addressText}>{listing.addressLine}, {listing.city}</Text>
          </View>
          <View style={styles.dealerRow}>
            <Icon name="user-circle" size={wp(3.5)} color="#777" />
            <Text style={styles.dealerText}>Managed by {listing.dealer.ownerName}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <TouchableOpacity
            style={styles.vehicleSelector}
            activeOpacity={0.8}
            onPress={() => setShowVehiclePicker(true)}
          >
            <IconMC name="car" size={wp(4.5)} color="#FFBF00" />
            <Text style={styles.vehicleSelectorText} numberOfLines={1}>
              {selectedVehicle
                ? `${selectedVehicle.registrationNumber}${selectedVehicle.isPrimary ? ' (Primary)' : ''}`
                : vehicles.length === 0
                  ? 'No vehicles in your garage'
                  : 'Select which vehicle you\'re parking'}
            </Text>
            <IconMC name="chevron-right" size={wp(5)} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your booking</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryValue}>{format(selectedDate, 'EEE, MMM d')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Time</Text>
            <Text style={styles.summaryValue}>{hourLabel(startHour)} – {hourLabel(endHour)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{hours} hr{hours > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{(totalPaise / 100).toFixed(0)}</Text>
          </View>
        </View>

        <View style={styles.infoBanner}>
          <IconMC name="information-outline" size={wp(4)} color="#888" />
          <Text style={styles.infoBannerText}>
            Payment is collected securely via Razorpay. Cancel more than 1 hour before your start time for an automatic refund.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, !selectedVehicleId && styles.bookBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleBookAndPay}
          disabled={booking || !selectedVehicleId}
        >
          <Text style={styles.bookBtnText}>{booking ? 'Processing…' : `Book & Pay ₹${(totalPaise / 100).toFixed(0)}`}</Text>
        </TouchableOpacity>
      </View>
      <LoadingSpinner visible={booking} />

      <Modal transparent visible={showVehiclePicker} animationType="fade" onRequestClose={() => setShowVehiclePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowVehiclePicker(false)}>
          <Pressable style={styles.vehiclePanel} onPress={() => {}}>
            <Text style={styles.vehiclePanelTitle}>Select vehicle</Text>
            {vehicles.length === 0 ? (
              <Text style={styles.vehiclePanelEmpty}>
                Add a vehicle to your garage first to book parking.
              </Text>
            ) : (
              vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.vehicleOption}
                  onPress={() => {
                    setSelectedVehicleId(v.id);
                    setShowVehiclePicker(false);
                  }}
                >
                  <IconMC
                    name={v.id === selectedVehicleId ? 'radiobox-marked' : 'radiobox-blank'}
                    size={wp(5)}
                    color={v.id === selectedVehicleId ? '#FFBF00' : '#555'}
                  />
                  <Text style={styles.vehicleOptionText}>
                    {v.registrationNumber} {v.isPrimary ? '(Primary)' : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  headerTitle: {
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
    flexShrink: 1,
  },
  scrollContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1.2), paddingHorizontal: wp(8) },
  centerStateText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  card: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: wp(4.5),
    marginBottom: hp(1.8),
    borderWidth: 1,
    borderColor: '#222',
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: wp(2.5), marginBottom: hp(1) },
  addressText: { flex: 1, color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
  dealerRow: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  dealerText: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.1) },
  sectionTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), marginBottom: hp(1.4) },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: hp(1) },
  summaryLabel: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.3) },
  summaryValue: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
  divider: { height: 1, backgroundColor: '#222', marginVertical: hp(1) },
  totalLabel: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4) },
  totalValue: { color: '#FFBF00', fontFamily: 'Outfit-Black', fontSize: wp(4.5) },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2.5),
    backgroundColor: '#111',
    borderRadius: 14,
    padding: wp(4),
    borderWidth: 1,
    borderColor: '#222',
  },
  infoBannerText: { flex: 1, color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3), lineHeight: wp(4.3) },
  footer: {
    paddingHorizontal: wp(5),
    paddingTop: wp(5),
    // The bottom tab bar floats via position:'absolute' (MainBottomTabs.tsx),
    // so it doesn't reserve its own layout space — every screen nested inside
    // the Services tab has to pad for it manually or the tab bar covers
    // whatever's anchored at the bottom (here, the Book & Pay button).
    paddingBottom: (Platform.OS === 'ios' ? hp(10) : hp(8)) + wp(5),
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  bookBtn: {
    backgroundColor: '#FFBF00',
    borderRadius: 16,
    paddingVertical: hp(1.8),
    alignItems: 'center',
  },
  bookBtnDisabled: { backgroundColor: '#4a4020' },
  bookBtnText: { color: '#111', fontFamily: 'Outfit-Black', fontSize: wp(4) },
  vehicleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: '#181818',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: hp(1.6),
    paddingHorizontal: wp(3.5),
  },
  vehicleSelectorText: { flex: 1, color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.5) },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  vehiclePanel: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: wp(5),
    paddingBottom: hp(4),
  },
  vehiclePanelTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.2), marginBottom: hp(1.5) },
  vehiclePanelEmpty: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.4), paddingVertical: hp(2) },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    paddingVertical: hp(1.6),
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  vehicleOptionText: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
});
