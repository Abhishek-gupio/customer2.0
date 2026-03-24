import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Platform,
  PermissionsAndroid,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import { placesService, type NearbyPlace } from '../../services/placesService';
import BackButton from '../../components/BackButton';

let Geolocation: any = null;
try {
  const geo = require('@react-native-community/geolocation') as any;
  Geolocation = geo?.default ?? geo;
} catch {
  Geolocation = null;
}

type PlaceType =
  | 'FuelStations'
  | 'Hospital'
  | 'PoliceStation'
  | 'Hotel'
  | 'ChargingStation'
  | 'Mechanics'
  | 'RTO'
  | 'Towing'
  | 'CarWash'
  | 'Insurance'
  | 'Parking'
  | 'TyreShop'
  | 'DocumentServices'
  | 'CarSpa';

const PLACE_LABELS: Record<string, string> = {
  FuelStations: 'Fuel Stations',
  Hospital: 'Hospital',
  PoliceStation: 'Police Station',
  Hotel: 'Hotel',
  ChargingStation: 'Charging Station',
  Mechanics: 'Mechanics',
  RTO: 'RTO',
  Towing: 'Towing',
  CarWash: 'Car Wash',
  Insurance: 'Insurance',
  Parking: 'Parking',
  TyreShop: 'Tyre Shop',
  DocumentServices: 'Document Services',
  CarSpa: 'Car Spa',
};

type PlaceItem = { id: PlaceType; name: string; icon: string; iconSet: 'fa' | 'mc' };

const PLACE_ITEMS: PlaceItem[] = [
  { id: 'FuelStations', name: 'Fuel', icon: 'gas-station', iconSet: 'mc' },
  { id: 'Hospital', name: 'Hospital', icon: 'hospital', iconSet: 'fa' },
  { id: 'PoliceStation', name: 'Police', icon: 'building', iconSet: 'fa' },
  { id: 'Hotel', name: 'Hotel', icon: 'hotel', iconSet: 'fa' },
  { id: 'ChargingStation', name: 'EV Charge', icon: 'ev-station', iconSet: 'mc' },
  { id: 'Mechanics', name: 'Mechanic', icon: 'wrench', iconSet: 'fa' },
  { id: 'RTO', name: 'RTO', icon: 'landmark', iconSet: 'fa' },
  { id: 'Towing', name: 'Towing', icon: 'truck-pickup', iconSet: 'fa' },
  { id: 'CarWash', name: 'Car Wash', icon: 'car-wash', iconSet: 'mc' },
  { id: 'Insurance', name: 'Insurance', icon: 'shield-check', iconSet: 'mc' },
  { id: 'Parking', name: 'Parking', icon: 'parking', iconSet: 'fa' },
  { id: 'TyreShop', name: 'Tyre Shop', icon: 'car-tire-alert', iconSet: 'mc' },
];

const getPlaceById = (id: PlaceType) => PLACE_ITEMS.find((i) => i.id === id)!;

const NEARBY_CATEGORIES: { title: string; itemIds: PlaceType[] }[] = [
  { title: 'Fuel & Charging', itemIds: ['FuelStations', 'ChargingStation'] },
  { title: 'Service & Repair', itemIds: ['Mechanics', 'CarWash', 'Towing', 'TyreShop'] },
  { title: 'Emergency & Safety', itemIds: ['Hospital', 'PoliceStation'] },
  { title: 'Others', itemIds: ['Hotel', 'Parking', 'RTO', 'Insurance'] },
];

function openMapsNavigation(lat: number, lng: number, label?: string) {
  const dest = `${lat},${lng}`;
  const encodedName = label ? encodeURIComponent(label) : '';
  if (Platform.OS === 'ios') {
    const url = encodedName
      ? `https://maps.apple.com/?daddr=${dest}&q=${encodedName}`
      : `https://maps.apple.com/?daddr=${dest}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`).catch(() => {});
    });
  } else {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`).catch(() => {});
  }
}

type NearbyApiType = 'gas_station' | 'electric_charging_station' | 'hospital' | 'police' | 'car_repair' | 'parking' | 'lodging';

const PLACE_API_TYPE: Partial<Record<PlaceType, NearbyApiType>> = {
  FuelStations: 'gas_station',
  ChargingStation: 'electric_charging_station',
  Mechanics: 'car_repair',
  Hospital: 'hospital',
  PoliceStation: 'police',
  Parking: 'parking',
  Hotel: 'lodging',
};

function NearbyPlacesListScreen({
  onBack,
  title,
  placeType,
  apiType,
}: {
  onBack: () => void;
  title: string;
  placeType: PlaceType;
  apiType: NearbyApiType;
}) {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      try {
        if (Geolocation?.requestAuthorization) {
          const status = await Geolocation.requestAuthorization('whenInUse');
          const ok = status === 'granted' || status === 'authorized' || status === 'authorizedWhenInUse';
          if (!ok) setPermissionDenied(true);
          return ok;
        }
        return true;
      } catch {
        setPermissionDenied(true);
        return false;
      }
    }
    if (Platform.OS === 'android') {
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
      const has = await PermissionsAndroid.check(fine).catch(() => false);
      if (has) return true;
      const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
      const ok = result[fine] === PermissionsAndroid.RESULTS.GRANTED || result[coarse] === PermissionsAndroid.RESULTS.GRANTED;
      if (!ok) setPermissionDenied(true);
      return ok;
    }
    return true;
  }, []);

  const fetchLocation = useCallback((): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!Geolocation) {
        setLocationError('Location is not available.');
        resolve(null);
        return;
      }
      Geolocation.getCurrentPosition(
        (pos: any) => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setLocation(coords);
          setLocationError(null);
          resolve(coords);
        },
        (err: any) => {
          const msg = err?.message || 'Could not get location.';
          setLocationError(msg);
          setLocation(null);
          if (err?.code === 1) setPermissionDenied(true);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }, []);

  const loadStations = useCallback(async (coords: { lat: number; lon: number } | null, isRefresh = false) => {
    if (!coords) {
      setLoading(false);
      setPlaces([]);
      return;
    }
    if (!isRefresh) setLoading(true);
    try {
      const list = await placesService.getNearby(coords.lat, coords.lon, apiType, 10000);
      setPlaces(list);
    } catch (e: any) {
      setPlaces([]);
      setLocationError(e?.message || `Failed to load nearby ${title.toLowerCase()}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiType, title]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const permitted = await requestLocationPermission();
    if (!permitted) {
      setRefreshing(false);
      return;
    }
    const coords = await fetchLocation();
    setLocation(coords || null);
    await loadStations(coords, true);
  }, [requestLocationPermission, fetchLocation, loadStations]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permitted = await requestLocationPermission();
      if (!permitted || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const coords = await fetchLocation();
      if (cancelled) return;
      await loadStations(coords);
    })();
    return () => { cancelled = true; };
  }, [requestLocationPermission, fetchLocation, loadStations]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {location && (
        <View style={styles.locationPill}>
          <Icon name="map-marker-alt" size={wp(3.5)} color="#FFBF00" />
          <Text style={styles.locationPillText}>
            Near {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
          </Text>
        </View>
      )}

      {locationError && !location && (
        <View style={styles.errorBanner}>
          <Icon name="exclamation-circle" size={wp(4)} color="#f59e0b" />
          <Text style={styles.errorBannerText}>{locationError}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.errorRetryBtn}>
            <Text style={styles.errorRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FFBF00" />
          <Text style={styles.loadingText}>Finding nearby {title.toLowerCase()}…</Text>
        </View>
      ) : permissionDenied ? (
        <View style={styles.emptyWrap}>
          <IconMC name="map-marker-off" size={wp(18)} color="#444" />
          <Text style={styles.emptyTitle}>Location access needed</Text>
          <Text style={styles.emptyText}>
            Enable location in Settings to see {title.toLowerCase()} near you.
          </Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : places.length === 0 && !loading ? (
        <View style={styles.emptyWrap}>
          <IconMC name="map-search" size={wp(18)} color="#444" />
          <Text style={styles.emptyTitle}>No places found</Text>
          <Text style={styles.emptyText}>
            We couldn't find {title.toLowerCase()} in your area. Try again or move to a different location.
          </Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.fuelListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFBF00"
            />
          }
        >
          {places.map((place) => (
            <View key={place.placeId || place.name} style={styles.fuelCard}>
              <View style={styles.fuelCardLeft}>
                <View style={styles.fuelCardIconWrap}>
                   <Icon name="map-pin" size={wp(5)} color="#FFBF00" />
                </View>
                <View style={styles.fuelCardBody}>
                  <Text style={styles.fuelCardName} numberOfLines={1}>{place.name}</Text>
                  {place.address ? (
                    <Text style={styles.fuelCardAddress} numberOfLines={2}>{place.address}</Text>
                  ) : null}
                  <View style={styles.fuelCardMeta}>
                    <View style={styles.distanceBadge}>
                      <Icon name="route" size={wp(3)} color="#888" />
                      <Text style={styles.distanceText}>{place.distanceText}</Text>
                    </View>
                    {place.rating != null && (
                      <View style={styles.ratingBadge}>
                        <Icon name="star" size={wp(3)} color="#FFBF00" solid />
                        <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.navigateBtn}
                onPress={() => openMapsNavigation(place.latitude, place.longitude, place.name)}
                activeOpacity={0.8}
              >
                <Icon name="directions" size={wp(4)} color="#000" />
                <Text style={styles.navigateBtnText}>GO</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default function NearbyPlaces() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [searchQuery, setSearchQuery] = useState('');
  
  const fromHome = route.params?.fromHome;
  const placeType = route.params?.placeType as PlaceType | undefined;

  const handleBack = () => {
    if (fromHome) {
      navigation.navigate('Home');
    } else {
      navigation.goBack();
    }
  };
  const title = placeType ? PLACE_LABELS[placeType] || 'Nearby' : 'Nearby Places';
  const isBrowse = !placeType;

  const onPlacePress = (id: PlaceType) => {
    navigation.push('NearbyPlaces', { placeType: id });
  };

  if (!isBrowse) {
    const apiType = placeType ? PLACE_API_TYPE[placeType] : undefined;
    if (placeType && apiType) {
      return (
        <NearbyPlacesListScreen
          onBack={handleBack}
          title={title}
          placeType={placeType}
          apiType={apiType}
        />
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.placeholder}>
          <Icon name="map-marker-alt" size={wp(20)} color="#222" />
          <Text style={styles.placeholderTitle}>Coming soon</Text>
          <Text style={styles.placeholderText}>
            Nearby {title.toLowerCase()} will show here. We're working on it.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Icon name="search" size={wp(4)} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search category..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.contentSection}>
          {NEARBY_CATEGORIES.map((cat) => (
            <View key={cat.title} style={styles.categoryWrap}>
              <Text style={styles.categoryTitle}>{cat.title}</Text>
              <View style={styles.row}>
                {cat.itemIds.map((id) => {
                  const item = getPlaceById(id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.button}
                      onPress={() => onPlacePress(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.iconBox}>
                        {item.id === 'FuelStations' || item.id === 'ChargingStation' || item.id === 'CarWash' || item.id === 'Insurance' || item.id === 'TyreShop' ? (
                          <IconMC name={item.icon as any} size={wp(5.8)} color="#fff" />
                        ) : (
                          <Icon name={item.icon as any} size={wp(5.8)} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.label} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
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
  scrollContent: {
    paddingBottom: hp(4),
  },
  searchWrapper: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 16,
    paddingHorizontal: wp(4),
    height: 52,
    borderWidth: 1,
    borderColor: '#222',
  },
  searchIcon: {
    marginRight: wp(3),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(4),
    padding: 0,
  },
  contentSection: {
    paddingHorizontal: wp(6),
    paddingTop: hp(1),
  },
  categoryWrap: {
    marginBottom: hp(4),
  },
  categoryTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
    color: '#aaa',
    marginBottom: hp(2),
    paddingLeft: 2,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(4),
  },
  button: {
    width: (wp(100) - wp(12) - wp(12)) / 4,
    alignItems: 'center',
    marginBottom: hp(1),
  },
  iconBox: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(4),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1),
  },
  label: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#fff',
    textAlign: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: 20,
    marginBottom: hp(1),
    gap: wp(1.5),
  },
  locationPillText: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    color: '#aaa',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: wp(5),
    marginBottom: hp(2),
    padding: wp(4),
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 16,
    gap: wp(2),
  },
  errorBannerText: {
    flex: 1,
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
    color: '#f59e0b',
  },
  errorRetryBtn: {
    paddingHorizontal: wp(3),
  },
  errorRetryText: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp(2),
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
    color: '#888',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  emptyTitle: {
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginTop: hp(2),
  },
  emptyText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
    color: '#888',
    textAlign: 'center',
    marginTop: hp(1),
  },
  retryButton: {
    marginTop: hp(3),
    backgroundColor: '#161616',
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.5),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  retryButtonText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
  },
  fuelListContent: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(4),
  },
  fuelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 18,
    padding: wp(4),
    marginBottom: hp(1.8),
    borderWidth: 1,
    borderColor: '#222',
  },
  fuelCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: wp(3),
  },
  fuelCardIconWrap: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  fuelCardBody: {
    flex: 1,
  },
  fuelCardName: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginBottom: hp(0.3),
  },
  fuelCardAddress: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    color: '#999',
    marginBottom: hp(0.8),
  },
  fuelCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  distanceText: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    color: '#888',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(0.8),
  },
  ratingText: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
  },
  navigateBtn: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateBtnText: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Black',
    color: '#000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: hp(10),
  },
  placeholderTitle: {
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginTop: hp(2),
  },
  placeholderText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
    color: '#888',
    textAlign: 'center',
    marginTop: hp(1),
  },
});
