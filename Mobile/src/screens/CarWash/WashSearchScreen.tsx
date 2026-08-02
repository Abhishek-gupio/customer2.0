import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { carwashService, type WashCenter } from '../../services/carwashService';
import { placesService, type SearchSuggestion } from '../../services/placesService';
import { openMapsNavigation } from '../../utils/mapUtils';

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

export default function WashSearchScreen() {
  const navigation = useNavigation<any>();

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Current location');
  const [results, setResults] = useState<WashCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (isRefresh = false) => {
    if (!coords) return;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await carwashService.searchCenters({ lat: coords.lat, lng: coords.lng });
      setResults(data);
    } catch (e: any) {
      setError(e?.message || 'Could not search wash centers right now.');
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coords]);

  const onUseCurrentLocation = useCallback(async () => {
    setShowSuggestions(false);
    setQuery('');
    setDetectingLocation(true);
    try {
      const permitted = await requestLocationPermission();
      if (!permitted) {
        setError('Allow location access to find nearby wash centers.');
        return;
      }
      const pos = await getCurrentPosition();
      if (pos) {
        setLocationLabel('Current location');
        setCoords(pos);
      }
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  useEffect(() => {
    onUseCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (coords) runSearch();
  }, [coords, runSearch]);

  const onChangeQuery = useCallback((text: string) => {
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
  }, []);

  const onPickSuggestion = useCallback(async (s: SearchSuggestion) => {
    setShowSuggestions(false);
    setQuery(s.mainText);
    const details = await placesService.getDetails(s.placeId);
    if (!details) {
      setError('Could not locate that place. Try a different search.');
      return;
    }
    setLocationLabel(details.name || s.mainText);
    setCoords({ lat: details.latitude, lng: details.longitude });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    runSearch(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Find a Wash Center</Text>
        <TouchableOpacity style={styles.myBookingsBtn} onPress={() => navigation.navigate('MyWashBookings')}>
          <IconMC name="clipboard-list-outline" size={wp(5)} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <TouchableOpacity onPress={onUseCurrentLocation} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            {detectingLocation ? (
              <ActivityIndicator size="small" color="#5F9EA0" />
            ) : (
              <IconMC name="map-marker-radius" size={wp(4.5)} color="#5F9EA0" />
            )}
          </TouchableOpacity>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            onFocus={() => setShowSuggestions(true)}
            placeholder={locationLabel}
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.searchInput}
          />
        </View>
        {showSuggestions && query.length >= 3 && (
          <View style={styles.suggestionsBox}>
            {suggestions.length === 0 ? (
              <Text style={styles.suggestionEmpty}>No matching places</Text>
            ) : (
              suggestions.map((s) => (
                <TouchableOpacity key={s.placeId} style={styles.suggestionRow} onPress={() => onPickSuggestion(s)}>
                  <IconMC name="map-marker-outline" size={wp(4)} color="#888" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionMain} numberOfLines={1}>{s.mainText}</Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>{s.secondaryText}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.doorstepBanner} onPress={() => navigation.navigate('DoorstepBooking')}>
        <View style={styles.doorstepIconWrap}>
          <IconMC name="home-city-outline" size={wp(6)} color="#5F9EA0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doorstepTitle}>Prefer doorstep wash?</Text>
          <Text style={styles.doorstepSubtitle}>A technician comes to you — home, office or parking lot</Text>
        </View>
        <IconMC name="chevron-right" size={wp(5)} color="#666" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5F9EA0" />}
        contentContainerStyle={styles.resultsWrap}
        onScrollBeginDrag={() => setShowSuggestions(false)}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#5F9EA0" />
            <Text style={styles.centerStateText}>Finding wash centers…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <IconMC name="alert-circle-outline" size={wp(10)} color="#5f9ea0" />
            <Text style={styles.centerStateText}>{error}</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerState}>
            <IconMC name="car-wash" size={wp(10)} color="#444" />
            <Text style={styles.centerStateText}>No wash centers listed near you yet — try doorstep wash instead.</Text>
          </View>
        ) : (
          results.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.resultCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('WashCenterDetail', { centerId: r.id })}
            >
              <View style={styles.resultLeft}>
                <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.resultAddress} numberOfLines={2}>{r.address}</Text>
                <View style={styles.resultMetaRow}>
                  <View style={styles.metaBadge}>
                    <Icon name="route" size={wp(3)} color="#888" />
                    <Text style={styles.metaText}>{r.distanceKm} km</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <IconMC name="star" size={wp(3.4)} color="#5F9EA0" />
                    <Text style={styles.metaTextAccent}>{r.partner.rating?.toFixed(1) ?? 'New'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.resultRightActions}>
                <TouchableOpacity
                  style={styles.directNavBtn}
                  onPress={() => openMapsNavigation({ latitude: r.latitude, longitude: r.longitude, address: r.address }, r.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconMC name="navigation-variant" size={wp(4.2)} color="#111" />
                </TouchableOpacity>
                <IconMC name="chevron-right" size={wp(5)} color="#666" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { flex: 1, fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  myBookingsBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
  suggestionEmpty: {
    color: '#777',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
  },
  doorstepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    marginHorizontal: wp(5),
    marginBottom: hp(1.5),
    padding: wp(4),
  },
  doorstepIconWrap: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: 'rgba(95, 158, 160,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorstepTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.6) },
  doorstepSubtitle: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(2.9), marginTop: 2 },
  resultsWrap: { paddingHorizontal: wp(5), paddingBottom: hp(14) },
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: hp(8), gap: hp(1.2) },
  centerStateText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center', paddingHorizontal: wp(6) },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 18,
    padding: wp(4),
    marginBottom: hp(1.6),
    borderWidth: 1,
    borderColor: '#222',
  },
  resultLeft: { flex: 1, marginRight: wp(2) },
  resultName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4) },
  resultAddress: { color: '#999', fontFamily: 'Outfit-Regular', fontSize: wp(3.1), marginTop: 2, marginBottom: hp(0.8) },
  resultMetaRow: { flexDirection: 'row', gap: wp(3) },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: wp(1) },
  metaText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
  metaTextAccent: { color: '#5F9EA0', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
  resultRightActions: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  directNavBtn: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    backgroundColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
