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
  { id: 'FuelStations', name: 'Fuel Stations', icon: 'gas-station', iconSet: 'mc' },
  { id: 'Hospital', name: 'Hospital', icon: 'hospital', iconSet: 'fa' },
  { id: 'PoliceStation', name: 'Police Station', icon: 'building', iconSet: 'fa' },
  { id: 'Hotel', name: 'Hotel', icon: 'hotel', iconSet: 'fa' },
  { id: 'ChargingStation', name: 'Charging Station', icon: 'ev-station', iconSet: 'mc' },
  { id: 'Mechanics', name: 'Mechanics', icon: 'wrench', iconSet: 'fa' },
  { id: 'RTO', name: 'RTO', icon: 'landmark', iconSet: 'fa' },
  { id: 'Towing', name: 'Towing', icon: 'truck-pickup', iconSet: 'fa' },
  { id: 'CarWash', name: 'Car Wash', icon: 'car-wash', iconSet: 'mc' },
  { id: 'Insurance', name: 'Insurance', icon: 'shield-check', iconSet: 'mc' },
  { id: 'Parking', name: 'Parking', icon: 'parking', iconSet: 'fa' },
  { id: 'TyreShop', name: 'Tyre Shop', icon: 'car-tire-alert', iconSet: 'mc' },
  { id: 'DocumentServices', name: 'Document Services', icon: 'file-document', iconSet: 'mc' },
  { id: 'CarSpa', name: 'Car Spa', icon: 'spa', iconSet: 'mc' },
];

const getPlaceById = (id: PlaceType) => PLACE_ITEMS.find((i) => i.id === id)!;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const NEARBY_CATEGORIES: { title: string; itemIds: PlaceType[] }[] = [
  { title: 'Fuel & charging', itemIds: ['FuelStations', 'ChargingStation'] },
  { title: 'Repair & service', itemIds: ['Mechanics', 'TyreShop', 'CarWash', 'CarSpa', 'Towing'] },
  { title: 'Emergency & safety', itemIds: ['Hospital', 'PoliceStation'] },
  { title: 'Stay & parking', itemIds: ['Hotel', 'Parking'] },
  { title: 'RTO & documents', itemIds: ['RTO', 'DocumentServices', 'Insurance'] },
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
  }, []);

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
          <Icon name="map-marker-alt" size={wp(3.5)} color="#FFC107" />
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
          <ActivityIndicator size="large" color="#FFC107" />
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
              tintColor="#FFC107"
            />
          }
        >
          {places.map((place) => (
            <View key={place.placeId || place.name} style={styles.fuelCard}>
              <View style={styles.fuelCardLeft}>
                <View style={styles.fuelCardIconWrap}>
                  {(() => {
                    const config = getPlaceById(placeType);
                    if (config.iconSet === 'mc') {
                      return <IconMC name={config.icon as any} size={wp(6)} color="#FFC107" />;
                    }
                    return <Icon name={config.icon as any} size={wp(6)} color="#FFC107" />;
                  })()}
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
                        <Icon name="star" size={wp(3)} color="#FFC107" solid />
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
                <Icon name="directions" size={wp(4)} color="#0a0a0a" />
                <Text style={styles.navigateBtnText}>Navigate</Text>
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
  const placeType = route.params?.placeType as PlaceType | undefined;
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
          onBack={() => navigation.goBack()}
          title={title}
          placeType={placeType}
          apiType={apiType}
        />
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.placeholder}>
          <Icon name="map-marker-alt" size={wp(20)} color="#333" />
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
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {NEARBY_CATEGORIES.map((cat) => {
            const items = cat.itemIds.map((id) => getPlaceById(id));
            const rows = chunk(items, 4);
            return (
              <View key={cat.title} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <View style={styles.grid}>
                  {rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.row}>
                      {row.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.card}
                          onPress={() => onPlacePress(item.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.iconContainer}>
                            {item.iconSet === 'mc' ? (
                              <IconMC name={item.icon as any} size={wp(5.5)} color="#fff" />
                            ) : (
                              <Icon name={item.icon as any} size={wp(5.5)} color="#fff" />
                            )}
                          </View>
                          <Text style={styles.cardText} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {row.length < 4 &&
                        Array.from({ length: 4 - row.length }).map((_, i) => (
                          <View key={`pad-${i}`} style={[styles.card, styles.cardPad]} />
                        ))}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
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
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  headerTitle: {
    fontSize: wp(5.5),
    fontWeight: '700',
    color: '#fff',
    marginLeft: wp(3),
  },
  scrollContent: {
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  categoryBlock: {
    marginBottom: hp(2.5),
  },
  categoryTitle: {
    color: '#e0e0e0',
    fontSize: wp(4.2),
    fontWeight: '600',
    marginBottom: hp(1.2),
    textTransform: 'capitalize',
  },
  grid: {
    paddingVertical: hp(1.5),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  card: {
    alignItems: 'center',
    flex: 1,
  },
  cardPad: {
    opacity: 0,
  },
  iconContainer: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
  },
  cardText: {
    fontSize: wp(2.8),
    fontWeight: '500',
    color: '#ccc',
    textAlign: 'center',
    marginTop: hp(0.4),
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  placeholderTitle: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
    marginTop: hp(2),
  },
  placeholderText: {
    fontSize: wp(4),
    color: '#888',
    textAlign: 'center',
    marginTop: hp(1),
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: 20,
    marginTop: hp(1),
    gap: wp(1.5),
  },
  locationPillText: {
    fontSize: wp(3.2),
    color: '#aaa',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: wp(5),
    marginTop: hp(2),
    padding: wp(4),
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 12,
    gap: wp(2),
  },
  errorBannerText: {
    flex: 1,
    fontSize: wp(3.8),
    color: '#f59e0b',
  },
  errorRetryBtn: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
  },
  errorRetryText: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#FFC107',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(4),
  },
  loadingText: {
    marginTop: hp(2),
    fontSize: wp(4),
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
    fontWeight: '700',
    color: '#fff',
    marginTop: hp(2),
  },
  emptyText: {
    fontSize: wp(4),
    color: '#888',
    textAlign: 'center',
    marginTop: hp(1),
  },
  retryButton: {
    marginTop: hp(3),
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.2),
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#FFC107',
  },
  fuelListContent: {
    paddingHorizontal: wp(4),
    paddingTop: hp(1.5),
    paddingBottom: hp(4),
  },
  fuelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,193,7,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  fuelCardBody: {
    flex: 1,
    minWidth: 0,
  },
  fuelCardName: {
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(0.3),
  },
  fuelCardAddress: {
    fontSize: wp(3.2),
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
    color: '#888',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(0.8),
  },
  ratingText: {
    fontSize: wp(3.2),
    color: '#FFC107',
    fontWeight: '600',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC107',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.2),
    borderRadius: 10,
    gap: wp(1.5),
  },
  navigateBtnText: {
    fontSize: wp(3.5),
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
