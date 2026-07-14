import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { addDays, format, isSameDay } from 'date-fns';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { placesService, type SearchSuggestion } from '../../services/placesService';
import { parkingService, type ParkingSearchResult } from '../../services/parkingService';

let Geolocation: any = null;
try {
  const geo = require('@react-native-community/geolocation') as any;
  Geolocation = geo?.default ?? geo;
} catch {
  Geolocation = null;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${period}`;
});

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

export default function ParkingSearchScreen() {
  const navigation = useNavigation<any>();

  const [destinationLabel, setDestinationLabel] = useState('Current location');
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startHour, setStartHour] = useState(new Date().getHours());
  const [durationHours, setDurationHours] = useState(2);

  const [results, setResults] = useState<ParkingSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateOptions = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const endHour = Math.min(startHour + durationHours, 24);

  useEffect(() => {
    (async () => {
      const permitted = await requestLocationPermission();
      if (!permitted) return;
      const coords = await getCurrentPosition();
      if (coords) setDestinationCoords(coords);
    })();
  }, []);

  const runSearch = useCallback(async (isRefresh = false) => {
    if (!destinationCoords) {
      setError('Set a destination or allow location access first.');
      return;
    }
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await parkingService.search({
        lat: destinationCoords.lat,
        lng: destinationCoords.lng,
        date: selectedDate,
        startHour,
        endHour,
      });
      setResults(data);
    } catch (e: any) {
      setError(e?.message || 'Could not search parking right now.');
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [destinationCoords, selectedDate, startHour, endHour]);

  useEffect(() => {
    if (destinationCoords) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationCoords, selectedDate, startHour, durationHours]);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    setShowSuggestions(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const list = await placesService.search(text);
      setSuggestions(list);
    }, 300);
  };

  const onPickSuggestion = async (s: SearchSuggestion) => {
    setShowSuggestions(false);
    setQuery(s.mainText);
    const details = await placesService.getDetails(s.placeId);
    if (details) {
      setDestinationLabel(details.name || s.mainText);
      setDestinationCoords({ lat: details.latitude, lng: details.longitude });
    } else {
      Alert.alert('Could not locate that place', 'Try a different destination.');
    }
  };

  const useCurrentLocation = async () => {
    setShowSuggestions(false);
    setQuery('');
    setDestinationLabel('Current location');
    const permitted = await requestLocationPermission();
    if (!permitted) return;
    const coords = await getCurrentPosition();
    if (coords) setDestinationCoords(coords);
  };

  const onRefresh = () => {
    setRefreshing(true);
    runSearch(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Find Parking</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <IconMC name="map-marker-radius" size={wp(4.5)} color="#FFBF00" />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setShowSuggestions(true)}
            placeholder={destinationLabel}
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.searchInput}
          />
        </View>
        {showSuggestions && (query.length > 0 ? suggestions.length > 0 : true) && (
          <View style={styles.suggestionsBox}>
            <TouchableOpacity style={styles.suggestionRow} onPress={useCurrentLocation}>
              <IconMC name="crosshairs-gps" size={wp(4)} color="#FFBF00" />
              <Text style={styles.suggestionMain}>Use current location</Text>
            </TouchableOpacity>
            {suggestions.map((s) => (
              <TouchableOpacity key={s.placeId} style={styles.suggestionRow} onPress={() => onPickSuggestion(s)}>
                <IconMC name="map-marker-outline" size={wp(4)} color="#888" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionMain} numberOfLines={1}>{s.mainText}</Text>
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>{s.secondaryText}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
        onScrollBeginDrag={() => setShowSuggestions(false)}
      >
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

        <View style={styles.timeRow}>
          <View style={styles.stepperCard}>
            <Text style={styles.stepperLabel}>Start time</Text>
            <View style={styles.stepperControls}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setStartHour((h) => Math.max(0, h - 1))}>
                <IconMC name="minus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{HOUR_LABELS[startHour]}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setStartHour((h) => Math.min(23, h + 1))}>
                <IconMC name="plus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.stepperCard}>
            <Text style={styles.stepperLabel}>Duration</Text>
            <View style={styles.stepperControls}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setDurationHours((d) => Math.max(1, d - 1))}>
                <IconMC name="minus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{durationHours}h</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setDurationHours((d) => Math.min(23, d + 1))}>
                <IconMC name="plus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.resultsWrap}>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#FFBF00" />
              <Text style={styles.centerStateText}>Finding parking spots…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <IconMC name="alert-circle-outline" size={wp(10)} color="#f59e0b" />
              <Text style={styles.centerStateText}>{error}</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.centerState}>
              <IconMC name="parking" size={wp(10)} color="#444" />
              <Text style={styles.centerStateText}>No parking lots listed near this destination yet.</Text>
            </View>
          ) : (
            results.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.resultCard}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('ParkingListingDetail', {
                    listingId: r.id,
                    date: selectedDate.toISOString(),
                    startHour,
                    endHour,
                  })
                }
              >
                <View style={styles.resultLeft}>
                  <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.resultAddress} numberOfLines={2}>{r.addressLine}, {r.city}</Text>
                  <View style={styles.resultMetaRow}>
                    <View style={styles.metaBadge}>
                      <Icon name="route" size={wp(3)} color="#888" />
                      <Text style={styles.metaText}>{r.distanceKm} km</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <IconMC name="currency-inr" size={wp(3.4)} color="#FFBF00" />
                      <Text style={styles.metaTextAccent}>{(r.hourlyRatePaise / 100).toFixed(0)}/hr</Text>
                    </View>
                  </View>
                </View>
                {r.soldOut ? (
                  <TouchableOpacity
                    style={styles.waitlistBtn}
                    onPress={() => parkingService.joinWaitlist(r.id, selectedDate).then(() =>
                      Alert.alert('Added to waitlist', "We'll notify you if a spot opens up."))
                    }
                  >
                    <Text style={styles.waitlistBtnText}>Notify Me</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.availableBadge}>
                    <Text style={styles.availableBadgeText}>{r.availableSpots} left</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={{ height: hp(4) }} />
      </ScrollView>
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
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
  },
  searchWrap: {
    paddingHorizontal: wp(5),
    marginBottom: hp(1.5),
    zIndex: 10,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.6),
    padding: 0,
  },
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
  suggestionMain: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.5) },
  suggestionSecondary: { color: '#777', fontFamily: 'Outfit-Regular', fontSize: wp(3) },
  dateRow: {
    flexDirection: 'row',
    paddingHorizontal: wp(5),
    gap: wp(2),
    marginBottom: hp(1.5),
  },
  dateChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp(1),
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  dateChipActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  dateChipDay: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(2.8) },
  dateChipNum: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), marginTop: 2 },
  dateChipTextActive: { color: '#111' },
  timeRow: {
    flexDirection: 'row',
    paddingHorizontal: wp(5),
    gap: wp(3),
    marginBottom: hp(2),
  },
  stepperCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: wp(3),
  },
  stepperLabel: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(2.9), marginBottom: hp(0.8) },
  stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperBtn: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: '#232323',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.6) },
  resultsWrap: { paddingHorizontal: wp(5) },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: hp(6), gap: hp(1.2) },
  centerStateText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center', paddingHorizontal: wp(6) },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 18,
    padding: wp(4),
    marginBottom: hp(1.6),
    borderWidth: 1,
    borderColor: '#222',
  },
  resultLeft: { flex: 1, marginRight: wp(3) },
  resultName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4) },
  resultAddress: { color: '#999', fontFamily: 'Outfit-Regular', fontSize: wp(3.1), marginTop: 2, marginBottom: hp(0.8) },
  resultMetaRow: { flexDirection: 'row', gap: wp(3) },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: wp(1) },
  metaText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
  metaTextAccent: { color: '#FFBF00', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
  availableBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: 10,
  },
  availableBadgeText: { color: '#4ade80', fontFamily: 'Outfit-Bold', fontSize: wp(3) },
  waitlistBtn: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    borderRadius: 10,
  },
  waitlistBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(2.9) },
});
