import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
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
  const [results, setResults] = useState<WashCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      const permitted = await requestLocationPermission();
      if (!permitted) {
        setError('Allow location access to find nearby wash centers.');
        return;
      }
      const pos = await getCurrentPosition();
      if (pos) setCoords(pos);
    })();
  }, []);

  useEffect(() => {
    if (coords) runSearch();
  }, [coords, runSearch]);

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

      <TouchableOpacity style={styles.doorstepBanner} onPress={() => navigation.navigate('DoorstepBooking')}>
        <View style={styles.doorstepIconWrap}>
          <IconMC name="home-city-outline" size={wp(6)} color="#FFBF00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doorstepTitle}>Prefer doorstep wash?</Text>
          <Text style={styles.doorstepSubtitle}>A technician comes to you — home, office or parking lot</Text>
        </View>
        <IconMC name="chevron-right" size={wp(5)} color="#666" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
        contentContainerStyle={styles.resultsWrap}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#FFBF00" />
            <Text style={styles.centerStateText}>Finding wash centers…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <IconMC name="alert-circle-outline" size={wp(10)} color="#f59e0b" />
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
                    <IconMC name="star" size={wp(3.4)} color="#FFBF00" />
                    <Text style={styles.metaTextAccent}>{r.partner.rating?.toFixed(1) ?? 'New'}</Text>
                  </View>
                </View>
              </View>
              <IconMC name="chevron-right" size={wp(5)} color="#666" />
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
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorstepTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.6) },
  doorstepSubtitle: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(2.9), marginTop: 2 },
  resultsWrap: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
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
  metaTextAccent: { color: '#FFBF00', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
});
