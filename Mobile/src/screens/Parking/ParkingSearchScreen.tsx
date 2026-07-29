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

const DURATION_PRESETS = [
  { label: '1 hr', value: 1 },
  { label: '2 hrs', value: 2 },
  { label: '4 hrs', value: 4 },
  { label: '8 hrs', value: 8 },
  { label: 'Full Day', value: 24 },
];

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
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'CAR' | 'BIKE'>('CAR');

  const [results, setResults] = useState<ParkingSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlistedIds, setWaitlistedIds] = useState<Set<string>>(new Set());

  const dateOptions = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const endHour = Math.min(startHour + durationHours, 24);
  const minStartHour = isSameDay(selectedDate, new Date()) ? new Date().getHours() : 0;

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

  useEffect(() => {
    if (startHour < minStartHour) setStartHour(minStartHour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minStartHour]);

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
      {/* Header Bar - App Signature Accent #FFBF00 */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Find Parking</Text>
          <View style={styles.headerSubTitleWrap}>
            <View style={styles.livePulseDot} />
            <Text style={styles.headerSubTitle} numberOfLines={1}>
              {destinationLabel}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.myBookingsBtn}
          onPress={() => navigation.navigate('MyParkingBookings')}
          activeOpacity={0.8}
        >
          <IconMC name="ticket-confirmation-outline" size={wp(4.5)} color="#FFBF00" />
          <Text style={styles.myBookingsBtnText}>My Bookings</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Search Bar & Suggestions */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <IconMC name="magnify" size={wp(5)} color="#FFBF00" />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setShowSuggestions(true)}
            placeholder={`Search near ${destinationLabel}`}
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={{ padding: wp(1) }}>
              <IconMC name="close-circle" size={wp(4.5)} color="#666" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={useCurrentLocation} style={styles.gpsIconBtn}>
            <IconMC name="crosshairs-gps" size={wp(4.5)} color="#FFBF00" />
          </TouchableOpacity>
        </View>

        {showSuggestions && (query.length > 0 ? suggestions.length > 0 : true) && (
          <View style={styles.suggestionsBox}>
            <TouchableOpacity style={styles.suggestionRow} onPress={useCurrentLocation}>
              <View style={styles.suggestionIconWrap}>
                <IconMC name="crosshairs-gps" size={wp(4.2)} color="#FFBF00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionMain}>Use current GPS location</Text>
                <Text style={styles.suggestionSecondary}>Detect nearest parking lots around you</Text>
              </View>
            </TouchableOpacity>
            {suggestions.map((s) => (
              <TouchableOpacity key={s.placeId} style={styles.suggestionRow} onPress={() => onPickSuggestion(s)}>
                <View style={styles.suggestionIconWrap}>
                  <IconMC name="map-marker" size={wp(4.2)} color="#888" />
                </View>
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
        {/* Quick Vehicle & Filter Selector Bar */}
        <View style={styles.vehicleSelectorRow}>
          <View style={styles.vehicleToggleContainer}>
            <TouchableOpacity
              style={[styles.vehicleToggleBtn, vehicleTypeFilter === 'CAR' && styles.vehicleToggleBtnActive]}
              onPress={() => setVehicleTypeFilter('CAR')}
            >
              <IconMC
                name="car"
                size={wp(4)}
                color={vehicleTypeFilter === 'CAR' ? '#000' : '#aaa'}
              />
              <Text style={[styles.vehicleToggleText, vehicleTypeFilter === 'CAR' && styles.vehicleToggleTextActive]}>
                4-Wheeler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.vehicleToggleBtn, vehicleTypeFilter === 'BIKE' && styles.vehicleToggleBtnActive]}
              onPress={() => setVehicleTypeFilter('BIKE')}
            >
              <IconMC
                name="motorbike"
                size={wp(4)}
                color={vehicleTypeFilter === 'BIKE' ? '#000' : '#aaa'}
              />
              <Text style={[styles.vehicleToggleText, vehicleTypeFilter === 'BIKE' && styles.vehicleToggleTextActive]}>
                2-Wheeler
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.instantBadge}>
            <IconMC name="lightning-bolt" size={wp(3.5)} color="#FFBF00" />
            <Text style={styles.instantBadgeText}>Instant Booking</Text>
          </View>
        </View>

        {/* Date Selector Pills */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <Text style={styles.sectionValue}>{format(selectedDate, 'EEEE, MMM d')}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScrollContent}
        >
          {dateOptions.map((d) => {
            const active = isSameDay(d, selectedDate);
            const isToday = isSameDay(d, new Date());
            return (
              <TouchableOpacity
                key={d.toISOString()}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => {
                  setSelectedDate(d);
                  if (isToday) {
                    setStartHour((h) => Math.max(h, new Date().getHours()));
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateChipDay, active && styles.dateChipTextActive]}>
                  {isToday ? 'TODAY' : format(d, 'EEE').toUpperCase()}
                </Text>
                <Text style={[styles.dateChipNum, active && styles.dateChipTextActive]}>{format(d, 'd')}</Text>
                {active && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Steppers & Duration Presets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Time & Duration</Text>
          <Text style={styles.sectionValue}>
            {HOUR_LABELS[startHour]} – {HOUR_LABELS[endHour % 24]} ({durationHours}h)
          </Text>
        </View>

        {/* Quick Duration Preset Pills */}
        <View style={styles.durationPresetsRow}>
          {DURATION_PRESETS.map((preset) => {
            const active = durationHours === preset.value;
            return (
              <TouchableOpacity
                key={preset.value}
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => setDurationHours(preset.value)}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.timeRow}>
          <View style={styles.stepperCard}>
            <View style={styles.stepperHeader}>
              <IconMC name="clock-outline" size={wp(3.8)} color="#FFBF00" />
              <Text style={styles.stepperLabel}>Start Time</Text>
            </View>
            <View style={styles.stepperControls}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setStartHour((h) => Math.max(minStartHour, h - 1))}
                disabled={startHour <= minStartHour}
              >
                <IconMC name="minus" size={wp(4)} color={startHour <= minStartHour ? '#444' : '#fff'} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{HOUR_LABELS[startHour]}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setStartHour((h) => Math.min(23, h + 1))}
              >
                <IconMC name="plus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.stepperCard}>
            <View style={styles.stepperHeader}>
              <IconMC name="timer-sand" size={wp(3.8)} color="#FFBF00" />
              <Text style={styles.stepperLabel}>Duration</Text>
            </View>
            <View style={styles.stepperControls}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setDurationHours((d) => Math.max(1, d - 1))}
              >
                <IconMC name="minus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{durationHours} hrs</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setDurationHours((d) => Math.min(23, d + 1))}
              >
                <IconMC name="plus" size={wp(4)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Results Summary & Parking Lot Cards */}
        <View style={styles.resultsWrap}>
          <View style={styles.resultsHeaderRow}>
            <Text style={styles.resultsCountTitle}>
              {!loading && results.length > 0
                ? `${results.length} Parking Lots Found`
                : 'Available Parking'}
            </Text>
            <View style={styles.verifiedFilterBadge}>
              <IconMC name="shield-check" size={wp(3.5)} color="#FFBF00" />
              <Text style={styles.verifiedFilterText}>Verified Spots</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#FFBF00" />
              <Text style={styles.centerStateText}>Searching nearby parking spots…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <IconMC name="alert-circle-outline" size={wp(10)} color="#f59e0b" />
              <Text style={styles.centerStateText}>{error}</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.centerState}>
              <IconMC name="parking" size={wp(12)} color="#333" />
              <Text style={styles.centerStateTitle}>No Parking Lots Found</Text>
              <Text style={styles.centerStateText}>
                There are no active parking listings near this destination yet. Try adjusting your search location.
              </Text>
            </View>
          ) : (
            results.map((r) => {
              const hourlyRate = (r.hourlyRatePaise / 100).toFixed(0);
              const estTotal = (r.hourlyRatePaise / 100) * durationHours;
              const isLowSpots = !r.soldOut && r.availableSpots <= 3;
              const isWaitlisted = waitlistedIds.has(r.id);

              return (
                <TouchableOpacity
                  key={r.id}
                  style={styles.resultCard}
                  activeOpacity={0.88}
                  onPress={() =>
                    navigation.navigate('ParkingListingDetail', {
                      listingId: r.id,
                      date: selectedDate.toISOString(),
                      startHour,
                      endHour,
                    })
                  }
                >
                  {/* Top Bar of Lot Card */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.partnerBadgeWrap}>
                      <IconMC name="shield-check" size={wp(3.4)} color="#FFBF00" />
                      <Text style={styles.partnerBadgeText}>Verified Partner</Text>
                    </View>
                    <View style={styles.distanceBadgeWrap}>
                      <Icon name="location-arrow" size={wp(2.8)} color="#818cf8" />
                      <Text style={styles.distanceBadgeText}>{r.distanceKm} km away</Text>
                    </View>
                  </View>

                  {/* Lot Name & Address */}
                  <Text style={styles.resultName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.resultAddress} numberOfLines={2}>
                    {r.addressLine}, {r.city}
                  </Text>

                  {/* Spot Capacity Indicator Gauge */}
                  <View style={styles.capacityGaugeWrap}>
                    <View style={styles.capacityHeader}>
                      <Text style={styles.capacityLabel}>Spot Availability</Text>
                      {r.soldOut ? (
                        <Text style={styles.soldOutText}>🔴 Sold Out</Text>
                      ) : isLowSpots ? (
                        <Text style={styles.lowSpotsText}>🟡 Only {r.availableSpots} left!</Text>
                      ) : (
                        <Text style={styles.availableSpotsText}>🟢 {r.availableSpots} spots available</Text>
                      )}
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          r.soldOut
                            ? { width: '100%', backgroundColor: '#ef4444' }
                            : isLowSpots
                            ? { width: '85%', backgroundColor: '#f59e0b' }
                            : { width: '40%', backgroundColor: '#32D74B' },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Price & Action Row */}
                  <View style={styles.cardBottomRow}>
                    <View>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceCurrency}>₹</Text>
                        <Text style={styles.priceValue}>{hourlyRate}</Text>
                        <Text style={styles.priceUnit}>/ hr</Text>
                      </View>
                      <Text style={styles.estTotalText}>Est. ₹{estTotal} for {durationHours}h</Text>
                    </View>

                    {r.soldOut ? (
                      isWaitlisted ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.waitlistBtnJoined]}
                          onPress={() =>
                            parkingService.leaveWaitlist(r.id, selectedDate).then(() =>
                              setWaitlistedIds((prev) => {
                                const next = new Set(prev);
                                next.delete(r.id);
                                return next;
                              }),
                            )
                          }
                        >
                          <Text style={styles.waitlistBtnTextJoined}>On Waitlist ✕</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.waitlistBtn]}
                          onPress={() =>
                            parkingService.joinWaitlist(r.id, selectedDate).then(() => {
                              setWaitlistedIds((prev) => new Set(prev).add(r.id));
                              Alert.alert('Added to waitlist', "We'll notify you if a spot opens up.");
                            })
                          }
                        >
                          <Text style={styles.waitlistBtnText}>Notify Me</Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <TouchableOpacity
                        style={styles.bookNowBtn}
                        onPress={() =>
                          navigation.navigate('ParkingListingDetail', {
                            listingId: r.id,
                            date: selectedDate.toISOString(),
                            startHour,
                            endHour,
                          })
                        }
                      >
                        <Text style={styles.bookNowBtnText}>Reserve Spot</Text>
                        <IconMC name="arrow-right" size={wp(4)} color="#000" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: (Platform.OS === 'ios' ? hp(10) : hp(8)) + hp(2) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4.5),
    paddingVertical: hp(1.8),
  },
  headerTitleWrap: { flex: 1, marginLeft: wp(2.5) },
  headerTitle: {
    fontSize: wp(5.2),
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: wp(1.5),
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFBF00',
  },
  headerSubTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
    maxWidth: wp(45),
  },
  myBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingHorizontal: wp(3.2),
    paddingVertical: hp(0.9),
    borderRadius: 12,
    backgroundColor: 'rgba(255,191,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.3)',
  },
  myBookingsBtnText: {
    color: '#FFBF00',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
  },

  /* Search Bar */
  searchWrap: {
    paddingHorizontal: wp(4.5),
    marginBottom: hp(1.5),
    zIndex: 20,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#26262a',
    borderRadius: 16,
    paddingHorizontal: wp(3.8),
    paddingVertical: Platform.OS === 'ios' ? hp(1.4) : hp(1),
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.6),
    padding: 0,
  },
  gpsIconBtn: {
    padding: wp(1.5),
    borderRadius: 10,
    backgroundColor: 'rgba(255,191,0,0.12)',
  },
  suggestionsBox: {
    marginTop: hp(0.8),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#26262a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  suggestionIconWrap: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionMain: { color: '#ffffff', fontFamily: 'Outfit-Bold', fontSize: wp(3.4) },
  suggestionSecondary: { color: '#888888', fontFamily: 'Outfit-Regular', fontSize: wp(3), marginTop: 1 },

  /* Vehicle & Filter Row */
  vehicleSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4.5),
    marginBottom: hp(2),
  },
  vehicleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26262a',
    padding: 3,
  },
  vehicleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.7),
    borderRadius: 9,
  },
  vehicleToggleBtnActive: {
    backgroundColor: '#FFBF00',
  },
  vehicleToggleText: {
    color: '#aaaaaa',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
  },
  vehicleToggleTextActive: {
    color: '#000000',
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    paddingHorizontal: wp(2.8),
    paddingVertical: hp(0.7),
    borderRadius: 10,
    backgroundColor: 'rgba(255,191,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.25)',
  },
  instantBadgeText: {
    color: '#FFBF00',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.8),
  },

  /* Section Titles */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4.5),
    marginBottom: hp(1.2),
  },
  sectionTitle: {
    color: '#ffffff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
  },
  sectionValue: {
    color: '#FFBF00',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.1),
  },

  /* Date Selector Scroll */
  dateScrollContent: {
    paddingHorizontal: wp(4.5),
    gap: wp(2.2),
    marginBottom: hp(2),
  },
  dateChip: {
    width: wp(14),
    alignItems: 'center',
    paddingVertical: hp(1.2),
    borderRadius: 14,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#26262a',
  },
  dateChipActive: {
    backgroundColor: '#FFBF00',
    borderColor: '#FFBF00',
  },
  dateChipDay: { color: '#777777', fontFamily: 'Outfit-Bold', fontSize: wp(2.5) },
  dateChipNum: { color: '#ffffff', fontFamily: 'Outfit-Bold', fontSize: wp(4), marginTop: 2 },
  dateChipTextActive: { color: '#000000' },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000000',
    marginTop: 4,
  },

  /* Duration Presets & Time Row */
  durationPresetsRow: {
    flexDirection: 'row',
    paddingHorizontal: wp(4.5),
    gap: wp(2),
    marginBottom: hp(1.5),
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: hp(0.8),
    borderRadius: 10,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#26262a',
  },
  presetChipActive: {
    backgroundColor: 'rgba(255,191,0,0.15)',
    borderColor: '#FFBF00',
  },
  presetChipText: { color: '#888888', fontFamily: 'Outfit-Medium', fontSize: wp(2.9) },
  presetChipTextActive: { color: '#FFBF00', fontFamily: 'Outfit-Bold' },

  timeRow: {
    flexDirection: 'row',
    paddingHorizontal: wp(4.5),
    gap: wp(3),
    marginBottom: hp(2.5),
  },
  stepperCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26262a',
    padding: wp(3.5),
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    marginBottom: hp(1),
  },
  stepperLabel: { color: '#888888', fontFamily: 'Outfit-Medium', fontSize: wp(3) },
  stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperBtn: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { color: '#ffffff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8) },

  /* Results List & Cards */
  resultsWrap: { paddingHorizontal: wp(4.5) },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1.5),
  },
  resultsCountTitle: {
    color: '#ffffff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4),
  },
  verifiedFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  verifiedFilterText: {
    color: '#FFBF00',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
  },

  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: hp(6), gap: hp(1.2) },
  centerStateTitle: { color: '#ffffff', fontFamily: 'Outfit-Bold', fontSize: wp(4.2) },
  centerStateText: { color: '#888888', fontFamily: 'Outfit-Medium', fontSize: wp(3.3), textAlign: 'center', paddingHorizontal: wp(6) },

  /* Result Card */
  resultCard: {
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: wp(4),
    marginBottom: hp(1.8),
    borderWidth: 1,
    borderColor: '#26262a',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(1),
  },
  partnerBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    backgroundColor: 'rgba(255,191,0,0.12)',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
    borderRadius: 8,
  },
  partnerBadgeText: {
    color: '#FFBF00',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.7),
  },
  distanceBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.2),
    backgroundColor: 'rgba(129,140,248,0.1)',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
    borderRadius: 8,
  },
  distanceBadgeText: {
    color: '#818cf8',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.7),
  },

  resultName: { color: '#ffffff', fontFamily: 'Outfit-Bold', fontSize: wp(4.3) },
  resultAddress: { color: '#999999', fontFamily: 'Outfit-Regular', fontSize: wp(3.2), marginTop: 3, marginBottom: hp(1.2) },

  /* Capacity Gauge */
  capacityGaugeWrap: {
    backgroundColor: '#1c1c22',
    borderRadius: 12,
    padding: wp(2.8),
    marginBottom: hp(1.5),
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  capacityLabel: { color: '#777777', fontFamily: 'Outfit-Medium', fontSize: wp(2.8) },
  availableSpotsText: { color: '#32D74B', fontFamily: 'Outfit-Bold', fontSize: wp(2.9) },
  lowSpotsText: { color: '#f59e0b', fontFamily: 'Outfit-Bold', fontSize: wp(2.9) },
  soldOutText: { color: '#ef4444', fontFamily: 'Outfit-Bold', fontSize: wp(2.9) },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* Price & Action Row */
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: hp(0.5),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceCurrency: { color: '#FFBF00', fontFamily: 'Outfit-Bold', fontSize: wp(3.5), marginRight: 2 },
  priceValue: { color: '#ffffff', fontFamily: 'Outfit-Black', fontSize: wp(5.5), letterSpacing: -0.5 },
  priceUnit: { color: '#888888', fontFamily: 'Outfit-Medium', fontSize: wp(3), marginLeft: 3 },
  estTotalText: { color: '#777777', fontFamily: 'Outfit-Regular', fontSize: wp(2.8), marginTop: 1 },

  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(4.5),
    paddingVertical: hp(1.2),
    borderRadius: 14,
  },
  bookNowBtnText: {
    color: '#000000',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.4),
  },

  actionBtn: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderRadius: 14,
  },
  waitlistBtn: {
    backgroundColor: '#f59e0b',
  },
  waitlistBtnJoined: {
    backgroundColor: '#22222a',
    borderWidth: 1,
    borderColor: '#FFBF00',
  },
  waitlistBtnText: { color: '#000000', fontFamily: 'Outfit-Bold', fontSize: wp(3.2) },
  waitlistBtnTextJoined: { color: '#FFBF00', fontFamily: 'Outfit-Bold', fontSize: wp(3.2) },
});
