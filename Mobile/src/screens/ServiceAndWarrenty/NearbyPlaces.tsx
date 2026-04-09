import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import { placesService, type NearbyPlace, type NearbyPlaceType } from '../../services/placesService';
import BackButton from '../../components/BackButton';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  | 'CarSpa'
  | 'TouristAttraction';

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
  TouristAttraction: 'Places to Visit',
};

type PlaceItem = { id: PlaceType; name: string; icon: string; iconSet: 'fa' | 'mc' };

const PLACE_ITEMS: PlaceItem[] = [
  { id: 'FuelStations', name: 'Fuel', icon: 'gas-station', iconSet: 'mc' },
  { id: 'Hospital', name: 'Hospital', icon: 'hospital', iconSet: 'fa' },
  { id: 'PoliceStation', name: 'Police', icon: 'building', iconSet: 'fa' },
  { id: 'Hotel', name: 'Hotel', icon: 'hotel', iconSet: 'fa' },
  { id: 'ChargingStation', name: 'EV Charge', icon: 'ev-station', iconSet: 'mc' },
  { id: 'Mechanics', name: 'Mechanic', icon: 'wrench', iconSet: 'fa' },
  { id: 'TouristAttraction', name: 'Visit', icon: 'map-marked-alt', iconSet: 'fa' },
  { id: 'RTO', name: 'RTO', icon: 'landmark', iconSet: 'fa' },
  { id: 'Towing', name: 'Towing', icon: 'truck-pickup', iconSet: 'fa' },
  { id: 'CarWash', name: 'Car Wash', icon: 'car-wash', iconSet: 'mc' },
  { id: 'Parking', name: 'Parking', icon: 'parking', iconSet: 'fa' },
  { id: 'TyreShop', name: 'Tyre Shop', icon: 'car-tire-alert', iconSet: 'mc' },
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

const PLACE_API_TYPE: Partial<Record<PlaceType, NearbyPlaceType>> = {
  FuelStations: 'gas_station',
  CarWash: 'car_wash',
  ChargingStation: 'electric_charging_station',
  Mechanics: 'car_repair',
  Hospital: 'hospital',
  PoliceStation: 'police',
  Parking: 'parking',
  Hotel: 'lodging',
  TouristAttraction: 'tourist_attraction',
  TyreShop: 'car_repair',
  Towing: 'car_repair',
  CarSpa: 'car_wash',
  RTO: 'local_government_office',
  DocumentServices: 'local_government_office',
  Insurance: 'insurance_agency',
};

const SERVICE_MARKER_STYLE: Record<PlaceType, { iconSet: 'fa' | 'mc'; icon: string; bg: string; fg: string }> = {
  FuelStations: { iconSet: 'mc', icon: 'gas-station', bg: '#FFBF00', fg: '#111111' },
  ChargingStation: { iconSet: 'mc', icon: 'ev-station', bg: '#22c55e', fg: '#0a0a0a' },
  Mechanics: { iconSet: 'fa', icon: 'wrench', bg: '#60a5fa', fg: '#0a0a0a' },
  CarWash: { iconSet: 'mc', icon: 'car-wash', bg: '#38bdf8', fg: '#0a0a0a' },
  Hospital: { iconSet: 'fa', icon: 'hospital', bg: '#ef4444', fg: '#ffffff' },
  PoliceStation: { iconSet: 'fa', icon: 'building', bg: '#6366f1', fg: '#ffffff' },
  Hotel: { iconSet: 'fa', icon: 'hotel', bg: '#f59e0b', fg: '#111111' },
  TouristAttraction: { iconSet: 'fa', icon: 'map-marked-alt', bg: '#e879f9', fg: '#111111' },
  Parking: { iconSet: 'fa', icon: 'parking', bg: '#a3e635', fg: '#111111' },
  RTO: { iconSet: 'fa', icon: 'landmark', bg: '#f97316', fg: '#111111' },
  Towing: { iconSet: 'fa', icon: 'truck-pickup', bg: '#94a3b8', fg: '#111111' },
  TyreShop: { iconSet: 'mc', icon: 'car-tire-alert', bg: '#fb7185', fg: '#111111' },
  Insurance: { iconSet: 'fa', icon: 'shield-alt', bg: '#34d399', fg: '#0a0a0a' },
  DocumentServices: { iconSet: 'fa', icon: 'file-alt', bg: '#c084fc', fg: '#111111' },
  CarSpa: { iconSet: 'mc', icon: 'car-wash', bg: '#2dd4bf', fg: '#111111' },
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
  apiType: NearbyPlaceType;
}) {
  const isFuelScreen = placeType === 'FuelStations';
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastAutoRefreshAtRef = useRef(0);
  const lastAutoRefreshCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

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

  const promptEnableLocationOnly = useCallback(() => {
    Alert.alert('Turn On Location', 'Please turn on your device location to see nearby places.');
    Linking.openSettings().catch(() => {});
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
          const code = err?.code;
          const isOff = code === 2 || /location.*(disabled|off|unavailable)/i.test(String(err?.message || ''));
          const msg = isOff
            ? 'Location is turned off. Please enable it in Settings.'
            : (err?.message || 'Could not get location.');
          setLocationError(msg);
          setLocation(null);
          if (isOff) {
            promptEnableLocationOnly();
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }, [promptEnableLocationOnly]);

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

  useEffect(() => {
    if (!isFuelScreen || !autoRefreshEnabled) {
      if (watchIdRef.current != null && Geolocation?.clearWatch) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    let stopped = false;
    (async () => {
      const permitted = await requestLocationPermission();
      if (!permitted || stopped || !Geolocation?.watchPosition) {
        return;
      }

      watchIdRef.current = Geolocation.watchPosition(
        async (pos: any) => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setLocation(coords);

          const lastCoords = lastAutoRefreshCoordsRef.current;
          const hasMovedEnough = !lastCoords || calculateDistance(coords.lat, coords.lon, lastCoords.lat, lastCoords.lon) >= 0.5;
          const cooldownElapsed = Date.now() - lastAutoRefreshAtRef.current >= 45000;
          if (!hasMovedEnough || !cooldownElapsed) return;

          lastAutoRefreshCoordsRef.current = coords;
          lastAutoRefreshAtRef.current = Date.now();
          setRefreshing(true);
          await loadStations(coords, true);
        },
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
          distanceFilter: 200,
        },
      );
    })();

    return () => {
      stopped = true;
      if (watchIdRef.current != null && Geolocation?.clearWatch) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [autoRefreshEnabled, isFuelScreen, loadStations, requestLocationPermission]);

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

      {isFuelScreen && (
        <View style={styles.autoRefreshCard}>
          <View style={styles.autoRefreshRow}>
            <Text style={styles.autoRefreshLabel}>Auto refresh</Text>
            <TouchableOpacity
              style={[styles.autoRefreshToggle, autoRefreshEnabled ? styles.autoRefreshToggleOn : styles.autoRefreshToggleOff]}
              onPress={() => setAutoRefreshEnabled((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={[styles.autoRefreshToggleText, autoRefreshEnabled ? styles.autoRefreshToggleTextOn : styles.autoRefreshToggleTextOff]}>
                {autoRefreshEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.autoRefreshHelpText}>
            Use ON while driving to keep nearby pumps updated automatically. Keep OFF to save data and battery; you can still pull down to refresh anytime.
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
        <FlashListAny
          data={places}
          keyExtractor={(item: NearbyPlace) => item.placeId || item.name}
          estimatedItemSize={92}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFBF00"
            />
          }
          contentContainerStyle={styles.fuelListContent}
          renderItem={({ item: place }: { item: NearbyPlace }) => (
            <View style={styles.fuelCard}>
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
          )}
        />
      )}
    </SafeAreaView>
  );
}

export default function NearbyPlaces() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mapRef = useRef<MapView | null>(null);
  const cacheRef = useRef<Record<string, { ts: number; data: NearbyPlace[] }>>({});
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedServices, setSelectedServices] = useState<PlaceType[]>(['FuelStations']);
  const [mapResults, setMapResults] = useState<Record<PlaceType, NearbyPlace[]>>({} as Record<PlaceType, NearbyPlace[]>);
  
  const fromHome = route.params?.fromHome;
  const placeType = route.params?.placeType as PlaceType | undefined;
  const MAP_RADIUS_METERS = 15000;
  const MAP_CACHE_TTL_MS = 10 * 60 * 1000;

  const handleBack = () => {
    if (fromHome) navigation.navigate('Home');
    else navigation.goBack();
  };

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      try {
        if (Geolocation?.requestAuthorization) {
          const status = await Geolocation.requestAuthorization('whenInUse');
          return status === 'granted' || status === 'authorized' || status === 'authorizedWhenInUse';
        }
        return true;
      } catch { return false; }
    }
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const has = await PermissionsAndroid.check(fine).catch(() => false);
    if (has) return true;
    const result = await PermissionsAndroid.request(fine);
    return result === PermissionsAndroid.RESULTS.GRANTED;
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
          setLocationError(null);
          resolve(coords);
        },
        (err: any) => {
          const code = err?.code;
          const isOff = code === 2 || /location.*(disabled|off|unavailable)/i.test(String(err?.message || ''));
          if (isOff) {
            Alert.alert('Turn On Location', 'Please turn on your device location to see nearby places.');
            Linking.openSettings().catch(() => {});
          }
          setLocationError(err?.message || 'Could not get location.');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000 },
      );
    });
  }, []);

  const getCacheKey = useCallback((service: PlaceType, coords: { lat: number; lon: number }) =>
    `${service}:${coords.lat.toFixed(3)}:${coords.lon.toFixed(3)}:${MAP_RADIUS_METERS}`, []);

  const fetchOneServiceForMap = useCallback(async (
    coords: { lat: number; lon: number },
    service: PlaceType,
    force = false,
  ) => {
    const apiType = PLACE_API_TYPE[service];
    if (!apiType) {
      setMapResults((prev) => ({ ...prev, [service]: [] }));
      return;
    }

    const cacheKey = getCacheKey(service, coords);
    const cached = cacheRef.current[cacheKey];
    const fresh = cached && Date.now() - cached.ts < MAP_CACHE_TTL_MS;
    if (!force && fresh) {
      setMapResults((prev) => ({ ...prev, [service]: cached.data }));
      return;
    }

    const list = await placesService.getNearby(coords.lat, coords.lon, apiType, MAP_RADIUS_METERS);
    cacheRef.current[cacheKey] = { ts: Date.now(), data: list };
    setMapResults((prev) => ({ ...prev, [service]: list }));
  }, [getCacheKey]);

  const fetchServicesForMap = useCallback(async (
    coords: { lat: number; lon: number },
    services: PlaceType[],
    force = false,
  ) => {
    if (services.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(services.map((service) => fetchOneServiceForMap(coords, service, force)));
    } catch (e) {
      console.error('Failed to fetch map services:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchOneServiceForMap]);

  const initData = useCallback(async (force = false) => {
    const permitted = await requestLocationPermission();
    if (!permitted) return;
    const coords = await fetchLocation();
    if (coords) {
      setLocation(coords);
      await fetchServicesForMap(coords, selectedServices, force);
    }
  }, [requestLocationPermission, fetchLocation, fetchServicesForMap, selectedServices]);

  useEffect(() => {
    initData();
  }, [initData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    initData(true);
  }, [initData]);

  const toggleService = useCallback(async (service: PlaceType) => {
    const exists = selectedServices.includes(service);
    const nextServices = exists
      ? selectedServices.filter((item) => item !== service)
      : [...selectedServices, service];
    setSelectedServices(nextServices);
    if (!location || nextServices.length === 0 || exists) return;
    await fetchServicesForMap(location, [service]);
  }, [selectedServices, location, fetchServicesForMap]);

  const mapMarkers = useMemo(() => selectedServices.flatMap((service) =>
    (mapResults[service] || []).map((place: NearbyPlace) => ({ ...place, service })),
  ), [selectedServices, mapResults]);

  if (placeType) {
    const apiType = PLACE_API_TYPE[placeType];
    if (!apiType) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <BackButton onPress={handleBack} />
            <Text style={styles.headerTitle}>Nearby Places</Text>
          </View>
          <View style={styles.emptyWrap}>
            <IconMC name="map-search" size={wp(18)} color="#444" />
            <Text style={styles.emptyTitle}>Not available</Text>
            <Text style={styles.emptyText}>
              This place type is not available right now.
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <NearbyPlacesListScreen
        onBack={handleBack}
        title={PLACE_LABELS[placeType]}
        placeType={placeType}
        apiType={apiType}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.headerTitle}>Nearby Places</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}>
        <Text style={styles.mapHintText}>
          Select one or more services to show them on the map.
        </Text>

        <View style={styles.mapCard}>
          {location ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.mainMap}
              initialRegion={{
                latitude: location.lat,
                longitude: location.lon,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              showsUserLocation
              showsMyLocationButton
            >
                {mapMarkers.map((place, index) => (
                  (() => {
                    const marker = SERVICE_MARKER_STYLE[place.service] || { iconSet: 'fa', icon: 'map-pin', bg: '#1f2937', fg: '#fff' };
                    return (
                  <Marker
                    key={`${place.placeId || place.name}-${place.service}-${index}`}
                    coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                    title={place.name}
                    description={`${PLACE_LABELS[place.service]}${place.distanceText ? ` • ${place.distanceText} from you` : ''}`}
                    onCalloutPress={() => openMapsNavigation(place.latitude, place.longitude, place.name)}
                  >
                    <View style={[styles.mapMarkerPin, { backgroundColor: marker.bg, borderColor: marker.bg }]}>
                      {marker.iconSet === 'mc' ? (
                        <IconMC name={marker.icon as any} size={wp(4.1)} color={marker.fg} />
                      ) : (
                        <Icon name={marker.icon as any} size={wp(3.7)} color={marker.fg} />
                      )}
                    </View>
                  </Marker>
                    );
                  })()
                ))}
              </MapView>
          ) : (
            <View style={styles.mapFallback}>
              <IconMC name="map-marker-off" size={wp(10)} color="#666" />
              <Text style={styles.mapFallbackText}>{locationError || 'Waiting for your location...'}</Text>
            </View>
          )}
          {loading ? (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color="#FFBF00" />
              <Text style={styles.mapLoadingText}>Loading places...</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.gridSection}>
          <Text style={styles.sectionHeading}>Services</Text>
          <View style={styles.gridRow}>
            {PLACE_ITEMS.map((item) => {
              const selected = selectedServices.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.serviceChip, selected ? styles.serviceChipActive : null]}
                  onPress={() => toggleService(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.serviceChipIcon}>
                    {item.iconSet === 'mc' ? (
                      <IconMC name={item.icon as any} size={wp(4.4)} color={selected ? '#000' : '#fff'} />
                    ) : (
                      <Icon name={item.icon as any} size={wp(4.2)} color={selected ? '#000' : '#fff'} />
                    )}
                  </View>
                  <Text style={[styles.serviceChipText, selected ? styles.serviceChipTextActive : null]}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={{ height: hp(5) }} />
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
  mapHintText: {
    marginHorizontal: wp(5),
    marginBottom: hp(1.2),
    color: '#9a9a9a',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.2),
  },
  mapCard: {
    marginHorizontal: wp(5),
    height: hp(35),
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#101010',
    marginBottom: hp(2),
  },
  mainMap: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(8),
    gap: hp(1),
  },
  mapFallbackText: {
    color: '#8a8a8a',
    textAlign: 'center',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.5),
  },
  mapLoadingOverlay: {
    position: 'absolute',
    right: wp(3),
    top: hp(1.2),
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  mapLoadingText: {
    color: '#fff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.9),
  },
  mapMarkerPin: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  mapMarkerFuel: {
    backgroundColor: '#FFBF00',
    borderColor: '#D9A300',
  },
  gridSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(3),
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(3),
  },
  serviceChip: {
    width: (wp(100) - wp(10) - wp(9)) / 3,
    backgroundColor: '#141414',
    borderColor: '#2a2a2a',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: hp(1),
    paddingHorizontal: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceChipActive: {
    backgroundColor: '#FFBF00',
    borderColor: '#FFBF00',
  },
  serviceChipIcon: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.6),
  },
  serviceChipText: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.1),
    color: '#fff',
    textAlign: 'center',
  },
  serviceChipTextActive: {
    color: '#121212',
    fontFamily: 'Outfit-Bold',
  },
  sectionHeading: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(4.3),
    color: '#fff',
    marginBottom: hp(1.4),
  },
  // List screen styles
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
  autoRefreshCard: {
    marginHorizontal: wp(5),
    marginBottom: hp(1.5),
    backgroundColor: '#131313',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232323',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.1),
  },
  autoRefreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoRefreshLabel: {
    fontSize: wp(3.6),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  autoRefreshToggle: {
    minWidth: wp(16),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: hp(0.6),
    borderWidth: 1,
  },
  autoRefreshToggleOn: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  autoRefreshToggleOff: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: '#333',
  },
  autoRefreshToggleText: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Black',
  },
  autoRefreshToggleTextOn: {
    color: '#4ade80',
  },
  autoRefreshToggleTextOff: {
    color: '#aaa',
  },
  autoRefreshHelpText: {
    marginTop: hp(0.9),
    fontSize: wp(3.1),
    fontFamily: 'Outfit-Regular',
    color: '#8f8f8f',
    lineHeight: wp(4.5),
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
    textAlign: 'center',
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
    gap: wp(1),
  },
  ratingText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
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
});
