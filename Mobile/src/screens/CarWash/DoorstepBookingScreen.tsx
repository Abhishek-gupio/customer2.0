import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { placesService, type SearchSuggestion } from '../../services/placesService';
import { googleMapsService } from '../../services/googleMapsService';
import { openRazorpayCheckout, paymentsService } from '../../services/paymentsService';
import { useCarwashStore } from '../../store/carwashStore';

let Geolocation: any = null;
try {
  const geo = require('@react-native-community/geolocation') as any;
  Geolocation = geo?.default ?? geo;
} catch {
  Geolocation = null;
}

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      if (Geolocation?.requestAuthorization) {
        const status = await Geolocation.requestAuthorization('whenInUse');
        return status === 'granted' || status === 'authorized' || status === 'authorizedWhenInUse';
      }
      return true;
    } catch {
      return false;
    }
  }
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const has = await PermissionsAndroid.check(fine).catch(() => false);
  if (has) return true;
  const result = await PermissionsAndroid.request(fine);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!Geolocation) return resolve(null);
    Geolocation.getCurrentPosition(
      (pos: any) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

const WASH_TYPES: WashType[] = ['EXTERIOR', 'FOAM', 'INTERIOR', 'STEAM', 'DETAILING', 'CERAMIC_COATING', 'BIKE_WASH', 'EV_SAFE_WASH'];
const BOTTOM_TAB_HEIGHT = Platform.OS === 'ios' ? hp(10) : hp(8);

function generateIdempotencyKey(): string {
  return `washbooking_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function DoorstepBookingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const notifyBookingChanged = useCarwashStore((s) => s.notifyBookingChanged);

  const [partners, setPartners] = useState<WashPartnerOption[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [washType, setWashType] = useState<WashType>('EXTERIOR');
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const [addressLine, setAddressLine] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [checkingDistance, setCheckingDistance] = useState(false);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);
  const [distanceError, setDistanceError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!coords) {
      setNearestDistance(null);
      setDistanceError(null);
      return;
    }
    let active = true;
    setCheckingDistance(true);
    carwashService.searchCenters({ lat: coords.lat, lng: coords.lng })
      .then((centers) => {
        if (!active) return;
        if (centers.length === 0) {
          setNearestDistance(null);
          setDistanceError('Doorstep wash is only available within 10 km of a wash center.');
        } else {
          const minKm = Math.min(...centers.map((c) => c.distanceKm));
          setNearestDistance(minKm);
          if (minKm > 10) {
            setDistanceError(`Doorstep wash is only available within 10 km of a wash center (nearest center is ${minKm.toFixed(1)} km away).`);
          } else {
            setDistanceError(null);
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setNearestDistance(null);
        setDistanceError(null);
      })
      .finally(() => {
        if (active) setCheckingDistance(false);
      });
    return () => { active = false; };
  }, [coords]);

  const handleAddressTextChange = useCallback((text: string) => {
    setAddressLine(text);
    setShowSuggestions(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setIsSearchingSuggestions(false);
      return;
    }
    setIsSearchingSuggestions(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const list = await placesService.search(text);
        setSuggestions(list);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 350);
  }, []);

  const handlePickSuggestion = useCallback(async (s: SearchSuggestion) => {
    setShowSuggestions(false);
    setAddressLine(s.description || `${s.mainText}, ${s.secondaryText}`);
    const details = await placesService.getDetails(s.placeId);
    if (details) {
      setCoords({ lat: details.latitude, lng: details.longitude });
    }
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    setShowSuggestions(false);
    setDetectingLocation(true);
    try {
      const permitted = await requestLocationPermission();
      if (!permitted) {
        Alert.alert('Location permission', 'Please allow location permission to auto-detect your wash address.');
        return;
      }
      const pos = await getCurrentPosition();
      if (pos) {
        setCoords(pos);
        const details = await googleMapsService.getAddressDetails(pos.lat, pos.lng);
        if (details && details.full) {
          setAddressLine(details.full);
        } else {
          setAddressLine(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
        }
      } else {
        Alert.alert('Location unavailable', 'Could not determine your current location. Please type your address.');
      }
    } catch (e: any) {
      Alert.alert('Location error', e?.message || 'Failed to detect location.');
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  const handleBookAndPay = async () => {
    if (!partnerId || !addressLine.trim() || distanceError) return;
    setBooking(true);
    try {
      const { booking: newBooking, payment } = await carwashService.createDoorstepBooking({
        partnerId,
        washType,
        addressLine: addressLine.trim(),
        latitude: coords?.lat,
        longitude: coords?.lng,
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

  const canSubmit = !!partnerId && addressLine.trim().length > 0 && !distanceError && !checkingDistance;

  const bookBtnLabel = booking
    ? 'Processing…'
    : !partnerId
      ? 'No wash partner available'
      : addressLine.trim().length === 0
        ? 'Enter your address'
        : checkingDistance
          ? 'Checking service area…'
          : distanceError
            ? 'Outside 10 km service zone'
            : 'Book & Pay';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Doorstep Wash</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setShowSuggestions(false)}
      >
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
          <ActivityIndicator color="#5F9EA0" style={{ marginVertical: hp(1.5) }} />
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

        <View style={styles.addressHeaderRow}>
          <View style={{ flex: 1, marginRight: wp(2) }}>
            <Text style={styles.sectionTitle}>Address</Text>
            <Text style={styles.addressSubText}>Max 10 km from wash center</Text>
          </View>
          <TouchableOpacity
            style={styles.currentLocBtn}
            onPress={handleUseCurrentLocation}
            disabled={detectingLocation}
          >
            {detectingLocation ? (
              <ActivityIndicator size="small" color="#5F9EA0" />
            ) : (
              <>
                <IconMC name="crosshairs-gps" size={wp(3.8)} color="#5F9EA0" />
                <Text style={styles.currentLocText}>Current location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.addressInputWrap}>
          <IconMC name="map-marker-outline" size={wp(4.5)} color="#5F9EA0" style={{ marginTop: 2 }} />
          <TextInput
            value={addressLine}
            onChangeText={handleAddressTextChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search address (home, office, parking lot…)"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.addressInput}
            multiline
          />
          {isSearchingSuggestions && (
            <ActivityIndicator size="small" color="#5F9EA0" style={{ alignSelf: 'center' }} />
          )}
        </View>

        {showSuggestions && addressLine.trim().length >= 3 && (
          <View style={styles.suggestionsBox}>
            {suggestions.length === 0 ? (
              <Text style={styles.suggestionEmpty}>
                {isSearchingSuggestions ? 'Searching places…' : 'No matching places found'}
              </Text>
            ) : (
              suggestions.map((s) => (
                <TouchableOpacity
                  key={s.placeId}
                  style={styles.suggestionRow}
                  onPress={() => handlePickSuggestion(s)}
                >
                  <IconMC name="map-marker-outline" size={wp(4)} color="#5F9EA0" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionMain} numberOfLines={1}>
                      {s.mainText}
                    </Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {s.secondaryText}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {coords && (
          <View style={styles.distanceBadgeWrap}>
            {checkingDistance ? (
              <View style={styles.distanceBadgePending}>
                <ActivityIndicator size="small" color="#5F9EA0" />
                <Text style={styles.distanceBadgePendingText}>Verifying 10 km service distance…</Text>
              </View>
            ) : distanceError ? (
              <View style={styles.distanceBadgeError}>
                <IconMC name="alert-circle-outline" size={wp(4.2)} color="#ef4444" />
                <Text style={styles.distanceBadgeErrorText}>{distanceError}</Text>
              </View>
            ) : nearestDistance != null ? (
              <View style={styles.distanceBadgeSuccess}>
                <IconMC name="check-circle-outline" size={wp(4.2)} color="#4ade80" />
                <Text style={styles.distanceBadgeSuccessText}>
                  Within service area ({nearestDistance.toFixed(1)} km from nearest center)
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.infoBanner}>
          <IconMC name="information-outline" size={wp(4)} color="#888" />
          <Text style={styles.infoBannerText}>
            Doorstep wash is provided within 10 km of a wash center. A partner will be assigned once payment is confirmed.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: wp(5) + BOTTOM_TAB_HEIGHT }]}>
        <TouchableOpacity
          style={[styles.bookBtn, !canSubmit && styles.bookBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleBookAndPay}
          disabled={booking || !canSubmit}
        >
          <Text style={[styles.bookBtnText, !canSubmit && styles.bookBtnTextDisabled]}>{bookBtnLabel}</Text>
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
  scrollContent: { paddingHorizontal: wp(5), paddingBottom: hp(8) },
  sectionTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), marginTop: hp(0.8) },
  addressSubText: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(2.9), marginTop: 2, marginBottom: hp(0.8) },
  addressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp(1),
  },
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.2),
    paddingVertical: hp(0.5),
    paddingHorizontal: wp(2.5),
    backgroundColor: 'rgba(95,158,160,0.12)',
    borderRadius: 8,
  },
  currentLocText: { color: '#5F9EA0', fontFamily: 'Outfit-Medium', fontSize: wp(3) },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2), marginBottom: hp(1) },
  chip: { paddingHorizontal: wp(3.5), paddingVertical: hp(0.9), borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  chipActive: { backgroundColor: '#5F9EA0', borderColor: '#5F9EA0' },
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
  suggestionsBox: {
    marginTop: hp(0.8),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.3),
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  suggestionMain: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.4) },
  suggestionSecondary: { color: '#777', fontFamily: 'Outfit-Regular', fontSize: wp(2.9) },
  suggestionEmpty: {
    color: '#777',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
  },
  distanceBadgeWrap: { marginTop: hp(1) },
  distanceBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: 'rgba(95,158,160,0.1)',
    borderRadius: 10,
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1),
  },
  distanceBadgePendingText: { color: '#5F9EA0', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
  distanceBadgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1),
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  distanceBadgeErrorText: { flex: 1, color: '#f87171', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
  distanceBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 10,
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1),
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
  },
  distanceBadgeSuccessText: { flex: 1, color: '#4ade80', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
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
  bookBtn: { backgroundColor: '#5F9EA0', borderRadius: 16, paddingVertical: hp(1.8), alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: '#333' },
  bookBtnText: { color: '#111', fontFamily: 'Outfit-Black', fontSize: wp(4) },
  bookBtnTextDisabled: { color: '#999' },
});
