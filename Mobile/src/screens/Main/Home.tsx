import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Linking,
  Image as RNImage,
  type ImageSourcePropType,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import QuickServicesGrid from '../../components/QuickServicesGrid';
import { useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import ServiceOptionsOverlay from '../ServiceAndWarrenty/OptionModal';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { api } from '../../services/api';
import { COLORS } from '../../components/Vehicles/VehicleUI';
import { GEO } from '../../config';
import { PermissionsAndroid } from 'react-native';
import { getLastOdometerUpdate } from '../../services/storage';

// GPS-based location
let Geolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation') as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry', 'Chandigarh', 'Ladakh', 'Jammu and Kashmir'];
const AUTO_SCROLL_INTERVAL_MS = 9000;
const AUTO_SCROLL_RESUME_DELAY_MS = 15000;

function sortCarNewsLatestFirst(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const ta = typeof a?.publishedAt === 'string' ? new Date(a.publishedAt).getTime() : 0;
    const tb = typeof b?.publishedAt === 'string' ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
}

import { Animated, Easing } from 'react-native';

// ─── Animated Health Display ──────────────────────────────────────────────────
function HealthDisplay({ score }: { score: number }) {
  const countAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = React.useState(0);

  useEffect(() => {
    countAnim.setValue(0);
    barAnim.setValue(0);
    fadeAnim.setValue(0);

    const countListener = countAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    Animated.parallel([
      Animated.timing(countAnim, {
        toValue: score,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(barAnim, {
        toValue: score,
        duration: 1500,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => { countAnim.removeListener(countListener); };
  }, [score]);

  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171';
  const label = score >= 80 ? 'EXCELLENT' : score >= 50 ? 'GOOD' : 'CRITICAL';
  const barWidth = barAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={healthStyles.container}>
      <View style={healthStyles.row}>
        {/* Animated count-up score */}
        <Text style={[healthStyles.score, { color }]}>
          {displayScore}<Text style={healthStyles.scoreUnit}>%</Text>
        </Text>
        {/* Fade-in status pill */}
        <Animated.View style={[healthStyles.statusPill, { opacity: fadeAnim, borderColor: `${color}55`, backgroundColor: `${color}18` }]}>
          <Text style={[healthStyles.statusText, { color }]}>{label}</Text>
        </Animated.View>
      </View>
      {/* Animated fill bar */}
      <View style={healthStyles.barBg}>
        <Animated.View style={[healthStyles.barFill, { width: barWidth, backgroundColor: color, shadowColor: color }]} />
      </View>
      <Text style={healthStyles.subLabel}>VEHICLE HEALTH</Text>
    </View>
  );
}

const healthStyles = StyleSheet.create({
  container: { marginTop: hp(1.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: wp(3), marginBottom: hp(0.8) },
  score: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(10),
    lineHeight: wp(11),
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  scoreUnit: { fontSize: wp(5), opacity: 0.5 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    alignSelf: 'center',
  },
  statusText: { fontFamily: 'Outfit-Black', fontSize: wp(3), letterSpacing: 1 },
  barBg: {
    width: wp(55),
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: hp(0.5),
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  subLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.3)',
    fontSize: wp(2.2),
    letterSpacing: 1.5,
  },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [numberPlate, setNumberPlate] = useState('');
  const [fuelPrices, setFuelPrices] = useState<{ petrol: number; diesel: number; cng?: number } | null>(null);
  const [selectedState, setSelectedState] = useState('Detecting...');
  const [userLocationDisplay, setUserLocationDisplay] = useState('Detecting...');
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [fuelLoading, setFuelLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [serviceDueText, setServiceDueText] = useState('Checking...');
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [trendingNews, setTrendingNews] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showOdometerSlide, setShowOdometerSlide] = useState(false);
  const carouselRef = useRef<FlatList>(null);
  const autoScrollStoppedRef = useRef(false);
  const autoScrollResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After user picks a state for fuel prices, do not overwrite from GPS/IP (async location often arrived late). */
  const fuelStateLockedByUserRef = useRef(false);
  const placeholders = ['MH01CH4322', 'AP39CH5621', 'UP31CH4259'];
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Initial load
  useEffect(() => {
    fetchDiscoveryContent();
    fetchUserLocationWithRetry(0);
  }, []);

  // Fetch fuel prices when state changes
  useEffect(() => {
    if (selectedState && selectedState !== 'Detecting...' && STATES.includes(selectedState)) {
      fetchFuelPrices();
    }
  }, [selectedState]);

  useFocusEffect(
    useCallback(() => {
      fetchPrimaryVehicle();
      fetchDiscoveryContent();
    }, [])
  );

  const pauseAutoScrollTemporarily = useCallback(() => {
    autoScrollStoppedRef.current = true;
    if (autoScrollResumeTimerRef.current) {
      clearTimeout(autoScrollResumeTimerRef.current);
    }
    autoScrollResumeTimerRef.current = setTimeout(() => {
      autoScrollStoppedRef.current = false;
    }, AUTO_SCROLL_RESUME_DELAY_MS);
  }, []);

  // Auto-scroll carousel every 5 seconds
  // Use a ref to avoid stale closure & re-creating the interval on every slide,
  // which caused IllegalStateException from conflicting Animated frame timestamps.
  const carouselIndexRef = useRef(0);
  useEffect(() => {
    const totalSlides = showOdometerSlide ? 5 : 4;
    const timer = setInterval(() => {
      if (autoScrollStoppedRef.current) return;
      const nextIndex = (carouselIndexRef.current + 1) % totalSlides;
      carouselIndexRef.current = nextIndex;
      setCarouselIndex(nextIndex);
      try {
        carouselRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      } catch (_) {
        // guard against layout-not-ready race
      }
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      if (autoScrollResumeTimerRef.current) {
        clearTimeout(autoScrollResumeTimerRef.current);
        autoScrollResumeTimerRef.current = null;
      }
    };
  }, [showOdometerSlide]); // ← dependency added to update interval when slides change

  // Typewriter animation for rotating number plate placeholders
  useEffect(() => {
    let currentIdx = 0;
    let placeholderIdx = 0;
    let isDeleting = false;
    let timeout: any;

    const animatePlaceholder = () => {
      const fullText = placeholders[placeholderIdx];

      if (!isDeleting) {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx + 1));
        currentIdx++;
        if (currentIdx === fullText.length) {
          isDeleting = true;
          timeout = setTimeout(animatePlaceholder, 2000); // Wait before deleting
        } else {
          timeout = setTimeout(animatePlaceholder, 150);
        }
      } else {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx - 1));
        currentIdx--;
        if (currentIdx === 0) {
          isDeleting = false;
          // Move to next placeholder in the list
          placeholderIdx = (placeholderIdx + 1) % placeholders.length;
          timeout = setTimeout(animatePlaceholder, 500); // Wait before typing next
        } else {
          timeout = setTimeout(animatePlaceholder, 100);
        }
      }
    };

    animatePlaceholder();
    return () => clearTimeout(timeout);
  }, []);

  const fetchPrimaryVehicle = async () => {
    try {
      setVehicleLoading(true);
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary) || vehicles[0];

      if (primary) {
        setVehicle(primary);
        // Show odometer reminder slider ONLY if not updated in the last 24 hours
        const lastUpdate = getLastOdometerUpdate(primary.id);
        const now = Date.now();
        const DayMs = 24 * 60 * 60 * 1000;
        if (!lastUpdate || (now - lastUpdate) > DayMs) {
          setShowOdometerSlide(true);
        } else {
          setShowOdometerSlide(false);
        }

        // Also fetch upcoming service to show in header footer
        try {
          const upcoming = await api.get<any>(`/v1/expenses/warranty/vehicles/${primary.id}/upcoming`);
          const rawData = (upcoming as any).data || upcoming;

          if (Array.isArray(rawData)) {
            const overdue = rawData.find((p: any) => p.urgency === 'OVERDUE');
            if (overdue) {
              setServiceDueText('Overdue!');
            } else {
              const first = rawData[0];
              if (first) {
                const kmLeft = (first.lifecycleKm || 10000) - (first.kmSinceReplacement || 0);
                setServiceDueText(`${kmLeft > 0 ? kmLeft : 0} km`);
              } else {
                setServiceDueText('Healthy');
              }
            }
          } else {
            console.warn('Unexpected upcoming service response format', rawData);
            setServiceDueText('Healthy');
          }
        } catch (err) {
          console.warn('Could not fetch upcoming service for home', err);
          setServiceDueText('Checking...');
        }
      }
    } catch (error) {
      console.error('Error fetching primary vehicle:', error);
    } finally {
      setVehicleLoading(false);
    }
  };

  const fetchFuelPrices = async () => {
    try {
      setFuelLoading(true);
      const res = await api.get<any>(`/v1/fuel/state?name=${selectedState}`);
      const data = (res as any).data || res;
      if (data && (data.PETROL || data.petrol)) {
        setFuelPrices({
          petrol: data.PETROL || data.petrol,
          diesel: data.DIESEL || data.diesel,
          cng: data.CNG || data.cng
        });
      } else {
        console.warn('No fuel data available for', selectedState);
      }
    } catch (error) {
      console.error('Error fetching fuel prices:', error);
    } finally {
      setFuelLoading(false);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
        const fineHas = await PermissionsAndroid.check(fine);
        const coarseHas = await PermissionsAndroid.check(coarse);
        if (fineHas || coarseHas) return true;
        const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
        return results[fine] === PermissionsAndroid.RESULTS.GRANTED || results[coarse] === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }
    if (Platform.OS === 'ios' && Geolocation?.requestAuthorization) {
      try {
        const status = await Geolocation.requestAuthorization('whenInUse');
        return status === 'granted' || status === 'authorized' || status === 'authorizedWhenInUse';
      } catch {
        return false;
      }
    }
    return true;
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<{ display: string; state: string } | null> => {
    try {
      const base = GEO.reverseGeocodeBase.replace(/\/$/, '');
      const url = `${base}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`;
      const res = await fetch(url, {
        headers: { 'User-Agent': GEO.userAgent },
      });
      const data = await res.json();
      const addr = data?.address;
      if (!addr) return null;

      const primary = addr.suburb || addr.neighbourhood || addr.locality || addr.village || addr.town || addr.city || addr.state_district;
      const townOrCity = addr.town || addr.city;
      const stateOrCountry = addr.state || addr.region || addr.country;
      const secondary = townOrCity && townOrCity !== primary ? townOrCity : stateOrCountry;
      const display = primary && secondary ? `${primary}, ${secondary}` : primary || secondary || 'Unknown Location';

      return { display, state: addr.state || '' };
    } catch {
      return null;
    }
  };

  const [isGpsPrecise, setIsGpsPrecise] = useState(false);

  const fetchUserLocationWithRetry = async (attempt = 0) => {
    const maxAttempts = 20; // Try for ~4 minutes if needed
    try {
      setLocationLoading(true);

      // try GPS
      if (Geolocation) {
        const permitted = await requestLocationPermission();
        if (permitted) {
          const coords = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
            Geolocation.getCurrentPosition(
              (pos: any) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
            );
          });
          if (coords) {
            const geo = await reverseGeocode(coords.lat, coords.lon);
            if (geo) {
              setUserLocationDisplay(geo.display);
              if (!fuelStateLockedByUserRef.current && geo.state && STATES.includes(geo.state)) {
                setSelectedState(geo.state);
              }
              setIsGpsPrecise(true);
              setLocationLoading(false);
              return;
            }
          }
        }
      }

      // fallback to IP (only if GPS failed and we haven't found a GPS result yet)
      if (!isGpsPrecise) {
        let geo: any = null;
        for (const ipUrl of GEO.ipProviders) {
          try {
            const res = await fetch(ipUrl, { headers: { 'User-Agent': GEO.userAgent } });
            const data = await res.json();
            const region = data?.region || data?.region_name || data?.regionName;
            if (data?.city && region) {
              geo = { ...data, region: region };
              break;
            }
          } catch { /* ignore */ }
        }

        if (geo) {
          setUserLocationDisplay(`${geo.city}, ${geo.region}`);
          if (!fuelStateLockedByUserRef.current && geo.region && STATES.includes(geo.region)) {
            setSelectedState(geo.region);
          }
        }
      }

      // If we don't have a GPS-precise result yet, retry
      if (!isGpsPrecise && attempt < maxAttempts) {
        setTimeout(() => fetchUserLocationWithRetry(attempt + 1), 10000); // Wait 10s between retries
      } else if (!isGpsPrecise && attempt >= maxAttempts && !userLocationDisplay.includes(',')) {
        setUserLocationDisplay('Location not available');
        setLocationLoading(false);
      } else {
        setLocationLoading(false);
      }
    } catch (error) {
      console.error('Location detection failed:', error);
      if (!isGpsPrecise && attempt < maxAttempts) {
        setTimeout(() => fetchUserLocationWithRetry(attempt + 1), 10000);
      } else {
        setLocationLoading(false);
      }
    }
  };

  const fetchUserLocation = () => fetchUserLocationWithRetry(0);

  const handleProfilePress = () => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('MyProfile');
    } else {
      navigation.navigate('MyProfile');
    }
  };

  const handleSOSPress = () => {
    // Force navigation to the SOS route in the Root Navigator
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('SOS');
    } else {
      (navigation as any).navigate('SOS');
    }
  };

  const handleAlertsPress = () => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('Alerts');
    } else {
      navigation.navigate('Alerts');   
    }
  };

  const handleHelpPress = () => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('HelpSupport');
    } else {
      navigation.navigate('HelpSupport');
    }
  };

  const navigateToRootScreen = (screenName: keyof RootStackParamList, params?: any) => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      if (params) {
        rootNav.navigate(screenName as any, params);
      } else {
        rootNav.navigate(screenName as any);
      }
    } else {
      if (params) {
        navigation.navigate(screenName as any, params);
      } else {
        navigation.navigate(screenName as any);
      }
    }
  };

  const navigateToServicesScreen = (
    screen:
      | 'ServicesHome'
      | 'NearbyPlaces'
      | 'CheckChallan'
      | 'ServiceHistory'
      | 'WarrantyStatus',
    params?: any
  ) => {
    if (params) {
      navigation.navigate('Services' as any, { screen, params });
      return;
    }
    navigation.navigate('Services' as any, { screen });
  };

  const fetchDiscoveryContent = async () => {
    try {
      setDiscoveryLoading(true);
      const res = await api.get<{
        success?: boolean;
        data?: { news?: unknown; videos?: unknown };
      }>(`/v1/discovery/trending?refresh=1&t=${Date.now()}`);
      const body = res as { data?: { news?: unknown; videos?: unknown } };
      const inner = body?.data ?? (res as { news?: unknown; videos?: unknown });
      const newsRaw = inner?.news;
      const videosRaw = inner?.videos;
      setTrendingNews(sortCarNewsLatestFirst(Array.isArray(newsRaw) ? newsRaw : []));
      setTrendingVideos(Array.isArray(videosRaw) ? videosRaw : []);
    } catch (error) {
      console.error('Error fetching discovery content:', error);
      setTrendingNews([]);
      setTrendingVideos([]);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleVideoPress = async (url: string) => {
    try {
      if (url) await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleNewsPress = async (url: string) => {
    try {
      if (url) await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#000000' : undefined}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PREMIUM VEHICLE CAROUSEL HEADER */}
        <View style={styles.headerWrapper}>
          <FlatList
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onTouchStart={() => {
              pauseAutoScrollTemporarily();
            }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / wp(100));
              carouselIndexRef.current = index;
              setCarouselIndex(index);
            }}
            data={showOdometerSlide ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]}
            keyExtractor={(item) => item.toString()}
            renderItem={({ item }) => {
              const vehicleImageUrl = vehicle?.imageUrl as string | undefined;
              const fallbackHeroImage = (vehicle?.vehicleType === 'BIKE'
                ? require('../../assets/images/bike.png')
                : require('../../assets/images/car_vehicle_demo.png')) as ImageSourcePropType;
              const heroImageSource: ImageSourcePropType =
                typeof vehicleImageUrl === 'string' && vehicleImageUrl.length > 0
                  ? ({ uri: vehicleImageUrl } as ImageSourcePropType)
                  : fallbackHeroImage;

              if (item === 0) {
                return (
                  <View style={styles.slideFull}>
                    <View style={styles.primaryImageWrap}>
                      <FastImage
                        source={heroImageSource as any}
                        style={styles.primaryImageFull}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                      {/* Bottom-up gradient scrim for text legibility */}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.92)']}
                        locations={[0, 0.3, 0.65, 1]}
                        style={styles.primaryImageOverlay}
                      >
                          <View style={styles.bannerBottomRow}>
                            {/* Left: vehicle info + health */}
                            {vehicleLoading ? (
                              <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-end' }} />
                            ) : vehicle ? (
                              <View style={styles.vehicleBannerContent}>
                                {/* Real Indian number plate */}
                                <View style={styles.regBadge}>
                                  <View style={styles.regIndStrip}>
                                    <Text style={styles.regFlagEmoji}>🇮🇳</Text>
                                    <Text style={styles.regIndText}>IND</Text>
                                  </View>
                                  <Text style={styles.regBadgeText}>{vehicle.registrationNumber}</Text>
                                </View>
                                <Text style={styles.bannerModel}>{vehicle.model}</Text>
                                <HealthDisplay score={vehicle.healthScore?.overallScore ?? 100} />
                              </View>
                            ) : (
                              <View style={styles.vehicleBannerContent}>
                                <Text style={styles.bannerMake}>My Garage</Text>
                                <Text style={styles.bannerModel}>Add your vehicle to get started</Text>
                              </View>
                            )}

                            {/* Right: service due chip */}
                            <View style={styles.serviceDueChip}>
                              <Text style={styles.serviceDueLabel}>DUE IN</Text>
                              <Text style={styles.serviceDueValue}>{serviceDueText}</Text>
                            </View>
                          </View>
                        </LinearGradient>
                    </View>
                  </View>
                );
              }
              if (item === 1) {
                return (
                  <TouchableOpacity
                    style={styles.slideFull}
                    activeOpacity={0.9}
                    onPress={() => navigateToRootScreen('Expenses')}
                  >
                    <View style={styles.promoSlide}>
                      <View style={styles.promoLeft}>
                        <Text style={[styles.promoSubtitle, { color: '#FFBF00' }]}>Smart Tracking</Text>
                        <Text style={styles.promoTitle}>Expense Tracker</Text>
                        <Text style={styles.promoDesc}>Monitor your fuel, service and other vehicle costs easily.</Text>
                        <View style={styles.promoAction}>
                          <Text style={styles.promoActionText}>Try Now</Text>
                          <MaterialIcon name="chevron-right" size={18} color="#FFBF00" />
                        </View>
                      </View>
                      <View style={styles.promoRight}>
                        <RNImage
                          source={require('../../assets/images/expense_AD.png') as any}
                          style={styles.adImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              if (item === 2) {
                return (
                  <TouchableOpacity
                    style={styles.slideFull}
                    activeOpacity={0.9}
                    onPress={() => setServiceModalVisible(true)}
                  >
                    <View style={styles.promoSlide}>
                      <View style={styles.promoLeft}>
                        <Text style={[styles.promoSubtitle, { color: '#4ade80' }]}>Premium Care</Text>
                        <Text style={styles.promoTitle}>Featured Services</Text>
                        <Text style={styles.promoDesc}>Book maintenance, car wash, and emergency repairs instantly.</Text>
                        <View style={styles.promoAction}>
                          <Text style={[styles.promoActionText, { color: '#4ade80' }]}>Explore</Text>
                          <MaterialIcon name="chevron-right" size={18} color="#4ade80" />
                        </View>
                      </View>
                      <View style={styles.promoRight}>
                        <RNImage
                          source={require('../../assets/images/vehicle_AD.png') as any}
                          style={styles.adImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              if (item === 3) {
                return (
                  <View style={styles.slideFull}>
                    <View style={styles.promoSlide}>
                      <View style={styles.promoLeft}>
                        <Text style={styles.promoSubtitle}>Stay Connected</Text>
                        <Text style={styles.promoTitle}>Follow Us on Instagram</Text>
                        <View style={styles.promoButtons}>
                          <TouchableOpacity
                            style={styles.promoBtn}
                            onPress={() => Linking.openURL('https://www.instagram.com/gupio.in/')}
                          >
                            <Icon name="instagram" size={14} color="#000" />
                            <Text style={styles.promoBtnText}>Instagram</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.promoBtn, { backgroundColor: '#333' }]}
                            onPress={() => Linking.openURL('https://gupio.in/')}
                          >
                            <MaterialIcon name="earth" size={14} color="#fff" />
                            <Text style={[styles.promoBtnText, { color: '#fff' }]}>Website</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.promoRight}>
                        <RNImage
                          source={require('../../assets/images/insta&website_AD.png') as any}
                          style={styles.adImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </View>
                );
              }
            const lastUpdate = (vehicle as any)?.id ? getLastOdometerUpdate((vehicle as any).id) : undefined;
            const now = Date.now();
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            const isOverAWeek = lastUpdate && (now - lastUpdate) > weekMs;
            const daysSince = lastUpdate ? Math.floor((now - lastUpdate) / (24 * 60 * 60 * 1000)) : null;

            return (
              <TouchableOpacity
                style={styles.slideFull}
                activeOpacity={0.9}
                onPress={() => (navigation as any).navigate('Odometer')}
              >
                <View style={[styles.promoSlide, isOverAWeek ? styles.odometerAlertSlide : { backgroundColor: '#1A1A1A' }]}>
                  <View style={styles.promoLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: wp(2), marginBottom: hp(1) }}>
                      {isOverAWeek && <Ionicons name="alert-circle" size={18} color="#ff4d4d" />}
                      <Text style={[styles.promoTitle, { marginBottom: 0 }, isOverAWeek ? { color: '#ff4d4d' } : undefined]}>
                        {isOverAWeek ? 'ODOMETER ALERT' : 'Update Odometer'}
                      </Text>
                    </View>
                    
                    {lastUpdate ? (
                      <View>
                        <View style={styles.odometerInfoRow}>
                          <MaterialIcon name="calendar-month" size={14} color={isOverAWeek ? '#ff4d4d' : '#888'} />
                          <Text style={[styles.odometerInfoText, isOverAWeek ? { color: '#ff4d4d' } : undefined]}>
                            {new Date(lastUpdate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </Text>
                          <MaterialIcon name="clock-outline" size={14} color={isOverAWeek ? '#ff4d4d' : '#888'} style={{ marginLeft: wp(2) }} />
                          <Text style={[styles.odometerInfoText, isOverAWeek ? { color: '#ff4d4d' } : undefined]}>
                            {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </Text>
                        </View>
                        
                        <View style={[styles.odometerBadge, isOverAWeek ? styles.odometerWarningBadge : undefined]}>
                          <Text style={[styles.odometerBadgeText, isOverAWeek ? styles.odometerWarningBadgeText : undefined]}>
                            {isOverAWeek ? `${daysSince} days ago` : 'Last Reading'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.promoDesc}>
                        Start tracking your vehicle health by updating odometer.
                      </Text>
                    )}
                    
                    <View style={[styles.promoAction, { marginTop: hp(1.5) }]}>
                      <Text style={[styles.promoActionText, { color: COLORS.primary }]}>Update Now</Text>
                      <MaterialIcon name="chevron-right" size={18} color={COLORS.primary} />
                    </View>
                  </View>
                  <View style={styles.promoRight}>
                    <RNImage
                      source={require('../../assets/images/odometer.png') as any}
                      style={styles.adImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

          {/* Carousel Indicators */}
          <View style={styles.indicatorContainer}>
            {(showOdometerSlide ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]).map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  carouselIndex === i ? styles.dotActive : styles.dotInactive
                ]}
              />
            ))}
          </View>

          {/* Top Overlays - Fixed on top of carousel */}
          <View style={styles.headerOverlay}>
            <TouchableOpacity onPress={handleProfilePress} style={styles.overlayIconButton}>
              <Icon name="user" size={wp(5.2)} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleAlertsPress} style={styles.overlayIconButton}>
                <Icon name="bell" size={wp(4.6)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSOSPress} style={styles.sosOverlayButton}>
                <Icon name="shield-alt" size={wp(4)} color="#fff" />
                <Text style={styles.sosOverlayText}>SOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* NUMBER PLATE SECTION */}
        <View style={styles.numberPlateSection}>
          <TouchableOpacity 
            style={styles.numberPlateContainer}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('VehicleSearch')}
          >
            <View style={styles.indContainer}>
              <Text style={styles.flagEmoji}>🇮🇳</Text>
              <Text style={styles.indText}>IND</Text>
            </View>
            <View style={styles.numberPlatePlaceholderContainer}>
              <Text style={styles.numberPlatePlaceholderText}>
                {animatedPlaceholder || 'MH01CH4322'}
              </Text>
            </View>
            <View style={styles.searchButton}>
              <MaterialIcon name="magnify" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <QuickServicesGrid
          onServicePress={id => {
            if (id === 'document') {
              navigateToRootScreen('DocumentList');
            } else if (id === 'garage') {
              navigateToRootScreen('VehicleList');
            } else if (id === 'expense') {
              navigateToRootScreen('Expenses');
            } else if (id === 'valet') {
              navigateToRootScreen('Valet');
            } else if (id === 'service') {
              navigateToServicesScreen('ServicesHome');
            } else if (id === 'driving') {
              navigateToRootScreen('DrivingSummary');
            } else if (id === 'nearby') {
              navigateToServicesScreen('NearbyPlaces', { fromHome: true });
            } else if (id === 'support') {
              handleHelpPress();
            } else if (id === 'tripcost') {
              navigateToRootScreen('TripExpense');
            }
          }}
        />

        {/* INSURANCE BANNER */}
        <View style={styles.bannerSection}>
          <View style={styles.insuranceBanner}>
            <RNImage
              source={require('../../assets/images/challan.png') as any}
              style={styles.bannerImage}
              resizeMode="contain"
            />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Check Your Challans & Avoid Trouble!</Text>
              <Text style={styles.bannerDesc}>Settle now to avoid late fees and skip the hassle of going to court.</Text>
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => navigateToServicesScreen('CheckChallan')}
              >
                <Text style={styles.payNowText}>Check Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* TRENDING CAR VIDEOS — ScrollView avoids nested VirtualizedList inside ScrollView (FlatList often gets 0 height). */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Videos</Text>
            {discoveryLoading ? (
              <ActivityIndicator size="small" color="#FFBF00" />
            ) : null}
          </View>
          {discoveryLoading && trendingVideos.length === 0 ? (
            <View style={styles.discoveryPlaceholder}>
              <Text style={styles.discoveryPlaceholderText}>Loading videos…</Text>
            </View>
          ) : trendingVideos.length === 0 ? (
            <View style={styles.discoveryPlaceholder}>
              <Text style={styles.discoveryPlaceholderText}>No videos right now. Check back soon.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.videoListContent}
            >
              {trendingVideos.map((item, index) => (
                <TouchableOpacity
                  key={String(item?.id ?? index)}
                  style={styles.videoCard}
                  onPress={() => handleVideoPress(item.url)}
                >
                  {item.tag ? (
                    <View style={styles.videoTag}>
                      <Text style={styles.tagText}>{item.tag}</Text>
                    </View>
                  ) : null}
                  <View style={styles.videoThumbnail}>
                    <FastImage
                      source={{ uri: item.thumbnail, priority: FastImage.priority.normal }}
                      style={styles.thumbnailImage}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                    <View style={styles.playButtonOverlay}>
                      <MaterialIcon name="play-circle" size={50} color="#fff" />
                    </View>
                    <Text style={styles.viewCount}>{item.views}</Text>
                  </View>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.fuelSection}>
          <View style={styles.fuelHeaderBanner}>
            <View style={styles.fuelHeaderLeft}>
              <Text style={styles.fuelHeaderTitle}>Current Fuel Prices in</Text>
              <View style={styles.locationTrackRow}>
                <Ionicons name="location" size={wp(3)} color="#333" />
                <Text style={styles.locationTrackText} numberOfLines={1}>
                  {locationLoading ? 'Detecting...' : userLocationDisplay}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.stateButton}
              onPress={() => setShowStateModal(true)}
            >
              <Text style={styles.stateButtonText}>{selectedState.split(' ')[0]}</Text>
              <MaterialIcon name="chevron-down" size={14} color="#0a0a0a" />
            </TouchableOpacity>
          </View>

          {fuelLoading ? (
            <View style={styles.fuelContentCard}>
              <ActivityIndicator size="large" color="#fff" style={styles.fuelLoader} />
            </View>
          ) : fuelPrices ? (
            <View style={styles.fuelContentCard}>
              <View style={styles.fuelInlineContainer}>
                <View style={styles.fuelInlineItem}>
                  <Text style={styles.fuelInlineLabel}>Petrol:</Text>
                  <Text style={styles.fuelInlineValue}>₹ {fuelPrices.petrol}</Text>
                </View>
                <View style={styles.fuelInlineSpacer} />
                <View style={styles.fuelInlineItem}>
                  <Text style={styles.fuelInlineLabel}>Diesel:</Text>
                  <Text style={styles.fuelInlineValue}>₹ {fuelPrices.diesel}</Text>
                </View>
                {fuelPrices.cng && (
                  <>
                    <View style={styles.fuelInlineSpacer} />
                    <View style={styles.fuelInlineItem}>
                      <Text style={styles.fuelInlineLabel}>CNG:</Text>
                      <Text style={styles.fuelInlineValue}>₹ {fuelPrices.cng}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.fuelContentCard}>
              <Text style={styles.loadingText}>
                {selectedState === 'Detecting...' 
                  ? 'Finding your city...' 
                  : `No fuel data for ${selectedState || 'current state'}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending News</Text>
            {discoveryLoading ? <ActivityIndicator size="small" color="#FFBF00" /> : null}
          </View>
          {discoveryLoading && trendingNews.length === 0 ? (
            <View style={styles.discoveryPlaceholder}>
              <Text style={styles.discoveryPlaceholderText}>Loading news…</Text>
            </View>
          ) : trendingNews.length === 0 ? (
            <View style={styles.discoveryPlaceholder}>
              <Text style={styles.discoveryPlaceholderText}>No news right now. Check back soon.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.videoListContent}
            >
              {trendingNews.map((news, index) => (
                <TouchableOpacity
                  key={String(news?.id ?? index)}
                  style={styles.videoCard}
                  onPress={() => handleNewsPress(news.url)}
                >
                  {news.source ? (
                    <View style={styles.videoTag}>
                      <Text style={styles.tagText}>{news.source}</Text>
                    </View>
                  ) : null}
                  <View style={styles.videoThumbnail}>
                    <FastImage
                      source={{ uri: news.image || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800', priority: FastImage.priority.normal }}
                      style={styles.thumbnailImage}
                      resizeMode={FastImage.resizeMode.cover}
                    />
                  </View>
                  <View style={styles.videoCardInfo}>
                    <Text style={styles.videoCardTitle} numberOfLines={2}>
                      {news.title}
                    </Text>
                    <View style={styles.videoCardFooter}>
                      <Text style={styles.videoCardDetails}>{news.time}</Text>
                      <View style={styles.latestBadge}>
                        <Text style={styles.latestLabel}>LATEST</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* FULL HEIGHT HOME ADVERTISEMENT */}
        {/* <View style={styles.fullAdSection}>
          <Text style={styles.fullAdTitle}>Featured Services</Text>
          <Image
            source={require('../../assets/images/Home_AD.png') as any}
            style={styles.fullAdImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.exploreAdButton}
            onPress={() => navigation.navigate('Services' as any, { screen: 'ServicesHome' })}
          >
            <Text style={styles.exploreAdButtonText}>Explore</Text>
          </TouchableOpacity>
        </View> */}

        {/* COMING SOON FEATURES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleCenter}>Coming Soon</Text>
          <View style={styles.featureRow}>
            <View style={styles.featureCard}>
              <MaterialIcon name="car-electric" size={wp(8)} color="#555" />
              <Text style={styles.featureTitle}>EV Charging</Text>
            </View>
            <View style={styles.featureCard}>
              <MaterialIcon name="car-wash" size={wp(8)} color="#555" />
              <Text style={styles.featureTitle}>Car Wash</Text>
            </View>
            <View style={styles.featureCard}>
              <MaterialIcon name="tow-truck" size={wp(8)} color="#555" />
              <Text style={styles.featureTitle}>Emergency</Text>
            </View>
          </View>
          <RNImage
            source={require('../../assets/images/coming_soon.png') as any}
            style={styles.comingSoonBadge}
            resizeMode="contain"
          />
        </View>

        <View style={{ height: hp(3) }} />
      </ScrollView>

      {/* STATE SELECTION MODAL */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowStateModal(false);
          setStateSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => {
                setShowStateModal(false);
                setStateSearchQuery('');
              }}>
                <MaterialIcon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View style={styles.stateSearchContainer}>
              <MaterialIcon name="magnify" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.stateSearchInput}
                placeholder="Search state..."
                placeholderTextColor="#666"
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
              />
              {stateSearchQuery && (
                <TouchableOpacity onPress={() => setStateSearchQuery('')}>
                  <MaterialIcon name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={STATES.filter(state =>
                state.toLowerCase().includes(stateSearchQuery.toLowerCase())
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.stateOption, selectedState === item && styles.selectedStateOption]}
                  onPress={() => {
                    fuelStateLockedByUserRef.current = true;
                    setSelectedState(item);
                    setShowStateModal(false);
                    setStateSearchQuery('');
                  }}
                >
                  <Text style={styles.stateOptionText}>{item}</Text>
                  {selectedState === item && <MaterialIcon name="check" size={20} color="#fff" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <ServiceOptionsOverlay
        visible={serviceModalVisible}
        onClose={() => setServiceModalVisible(false)}
        onSelect={(screen) => {
          setServiceModalVisible(false);
          navigateToServicesScreen(screen);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionTitle: {
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    fontSize: wp(5),
  },
  discoveryPlaceholder: {
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  discoveryPlaceholderText: {
    color: '#888',
    fontSize: wp(3.4),
    fontFamily: 'Outfit-Medium',
  },
  sectionTitleCenter: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(5),
    color: '#FFFFFF',
    marginBottom: hp(2),
    textAlign: 'center',
  },
  viewAllText: {
    fontFamily: 'Outfit-Medium',
    color: '#ccc',
    fontSize: wp(3.5),
  },

  /* PREMIUM VEHICLE HEADER */
  headerWrapper: {
    width: '100%',
    height: hp(40),
    backgroundColor: '#0d0f14',
    paddingTop: 0,
  },
  primaryImageWrap: {
    marginTop: 0,
    marginHorizontal: 0,
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  primaryImageFull: {
    width: '100%',
    height: '100%',
  },
  primaryImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Bottom-up scrim for text legibility — handled by LinearGradient
    justifyContent: 'flex-end',
    paddingBottom: hp(3.5),
    paddingHorizontal: wp(5.5),
  },
  bannerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  vehicleBannerContent: {
    flex: 1,
    marginBottom: hp(2),
  },
  // Authentic licence plate badge
  regBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginBottom: hp(1),
    borderWidth: 2,
    borderColor: '#003580',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 8,
  },
  regIndStrip: {
    backgroundColor: '#003580',
    paddingHorizontal: wp(1.5),
    paddingVertical: hp(0.4),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  regFlagEmoji: {
    fontSize: wp(2.8),
    lineHeight: wp(3.2),
  },
  regIndText: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(2),
    letterSpacing: 0.5,
  },
  regBadgeText: {
    fontFamily: 'Outfit-Black',
    color: '#0A0A0A',
    fontSize: wp(4.8),
    letterSpacing: 2.5,
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
  },
  bannerMake: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(8),
    letterSpacing: 0.5,
    lineHeight: wp(8.5),
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bannerModel: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(8),
    letterSpacing: 0.5,
    lineHeight: wp(8.5),
    marginBottom: hp(1.5),
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  // Inline health score
  inlineHealth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    marginTop: hp(1.2),
  },
  inlineScore: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(11),
    lineHeight: wp(12),
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  inlineScoreUnit: {
    fontSize: wp(5),
    opacity: 0.5,
  },
  inlineRight: {
    gap: hp(0.6),
    justifyContent: 'center',
  },
  inlineStatusPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 50,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.4),
  },
  inlineStatusText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(3),
    letterSpacing: 1,
  },
  inlineSubLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.3)',
    fontSize: wp(2.2),
    letterSpacing: 1.5,
  },
  // Service due chip (right side)
  serviceDueChip: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.2),
    borderRadius: 14,
    marginBottom: hp(2),
    marginLeft: wp(3),
  },
  serviceDueLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.45)',
    fontSize: wp(2.5),
    letterSpacing: 1.5,
  },
  serviceDueValue: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(4),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // legacy / other slides
  headerFooterOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerNumberPlate: {
    fontFamily: 'Outfit-Black',
    color: '#fff',
    fontSize: wp(6),
    letterSpacing: 2,
  },
  headerCarModel: {
    fontFamily: 'Outfit-SemiBold',
    color: '#FFFFFF',
    fontSize: wp(4),
  },
  healthPillRow: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthPillText: { fontFamily: 'Outfit-Black', color: '#FFFFFF', fontSize: wp(5) },
  healthPillLabel: { fontFamily: 'Outfit-Bold', color: 'rgba(255,255,255,0.5)', fontSize: wp(2.8), letterSpacing: 1.5 },
  footerItem: { justifyContent: 'center' },
  footerLabel: { fontFamily: 'Outfit-Bold', color: 'rgba(255,255,255,0.6)', fontSize: wp(2.5), letterSpacing: 1 },
  footerValue: { fontFamily: 'Outfit-Black', color: '#FFFFFF', fontSize: wp(4.5), marginTop: hp(0.2) },
  healthSection: { marginTop: hp(1.5) },
  healthText: { fontFamily: 'Outfit-Black', color: '#fff', fontSize: wp(4.5) },
  healthLabel: { color: '#4ade80', fontSize: wp(3.5) },
  headerCarImage: {
    width: wp(40),
    height: hp(16),
    transform: [{ scale: 1.1 }, { translateX: wp(5) }],
  },
  headerOverlay: {
    position: 'absolute',
    top: hp(1),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    zIndex: 10,
  },
  overlayIconButton: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sosOverlayButton: {
    height: hp(4),
    paddingHorizontal: wp(3.5),
    borderRadius: 20,
    backgroundColor: 'rgba(255, 77, 77, 0.4)',
    borderWidth: 1.5,
    borderColor: '#ff4d4d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(3),
    // Premium glow effect
    shadowColor: '#ff4d4d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  sosOverlayText: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    marginLeft: wp(1.2),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* CAROUSEL SLIDE STYLES */
  slideFull: {
    width: wp(100),
    height: '100%',
  },
  promoSlide: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: hp(4), // Add space to push content down into the middle
    paddingBottom: hp(4), // Balanced padding
  },
  promoLeft: {
    flex: 1.4,
    justifyContent: 'center',
  },
  promoRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  adImage: {
    width: wp(35),
    height: hp(18),
  },
  promoSubtitle: {
    color: '#aaa',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(0.5),
  },
  promoTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Black',
    marginBottom: hp(1.5),
  },
  promoDesc: {
    color: '#ccc',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    lineHeight: hp(2),
    marginBottom: hp(2),
  },
  promoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    marginTop: hp(1),
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.8),
    borderRadius: 6,
    gap: wp(1),
  },
  promoBtnText: {
    color: '#000',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },
  promoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  promoActionText: {
    color: '#FFBF00',
    fontSize: wp(4),
    fontWeight: '700',
  },
  odometerSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(10),
  },
  odometerImage: {
    width: wp(40),
    height: hp(14),
    marginBottom: hp(1.5),
  },
  odometerTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Black',
    textAlign: 'center',
    marginBottom: hp(0.5),
  },
  odometerSubtitle: {
    color: COLORS.primary,
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(1.5),
  },
  odometerDesc: {
    color: '#888',
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
    marginTop: hp(0.5),
  },
  odometerWarning: {
    color: '#ff4d4d',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    marginTop: hp(1),
  },

  odometerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    marginTop: hp(0.5),
  },
  odometerInfoText: {
    color: '#8E8E93',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
  },
  odometerBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    marginTop: hp(1.2),
    alignSelf: 'flex-start',
  },
  odometerBadgeText: {
    color: COLORS.primary,
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
  },
  odometerWarningBadge: {
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderColor: 'rgba(255,77,77,0.2)',
  },
  odometerWarningBadgeText: {
    color: '#ff4d4d',
  },

  odometerAlertSlide: {
    backgroundColor: '#0D0D0D',
    borderWidth: hp('0.2%'),
    borderColor: 'rgba(255, 77, 77, 0.4)',
    marginHorizontal: wp(2),
    marginVertical: hp(1),
    borderRadius: 20,
  },

  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: hp(5), // Positioned above the overlapping vehicle input
    left: 0,
    right: 0,
    gap: wp(1.5),
  },
  dot: {
    width: wp(1.5),
    height: wp(1.5),
    borderRadius: wp(0.75),
  },
  dotActive: {
    backgroundColor: '#fff',
    width: wp(4),
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  /* NUMBER PLATE SECTION */
  numberPlateSection: {
    paddingHorizontal: wp(12),
    marginTop: -hp(2.80), // 50% of the 5.5hp height to overlap header
    marginBottom: hp(2.0),
    justifyContent: 'center',
    zIndex: 10, // Ensure it's above the header
  },
  numberPlateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: hp(5.5),
    overflow: 'hidden',
  },
  indContainer: {
    backgroundColor: '#003399',
    height: '100%',
    paddingHorizontal: wp(2),
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  flagEmoji: {
    fontSize: wp(2.8),
    lineHeight: wp(3.5),
  },
  indText: {
    fontFamily: 'Outfit-Black',
    color: '#fff',
    fontSize: wp(2.2),
    letterSpacing: 0.5,
  },
  numberPlatePlaceholderContainer: {
    flex: 1,
    paddingHorizontal: wp(2),
    justifyContent: 'center',
  },
  numberPlatePlaceholderText: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(4.5),
    letterSpacing: 1.5,
  },
  searchButton: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(1),
  },

  /* VEHICLE SECTION */
  vehicleSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  vehicleTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '700',
    marginBottom: hp(1.5),
  },
  vehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  vehicleImageContainer: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: wp(1),
    justifyContent: 'center',
    alignItems: 'center',
    width: wp(28),
    height: wp(28),
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  vehicleDetails: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.8),
  },
  detailLabel: {
    color: '#999',
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
  },
  detailValue: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-SemiBold',
  },
  chevronIcon: {
    alignSelf: 'center',
  },

  /* BANNER SECTION */
  bannerSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  insuranceBanner: {
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingHorizontal: wp(4),
    paddingVertical: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: wp(3),
  },
  bannerImage: {
    width: wp(20),
    height: wp(20),
    marginRight: wp(1),
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(4),
    marginBottom: hp(0.5),
  },
  bannerDesc: {
    fontFamily: 'Outfit-Regular',
    color: '#999',
    fontSize: wp(3.2),
    lineHeight: hp(2.2),
  },
  payNowButton: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.6),
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(1),
    alignSelf: 'flex-start',
  },
  payNowText: {
    color: '#0a0a0a',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },

  /* TRENDING VIDEOS */
  videoListContent: {
    paddingHorizontal: wp(5),
  },
  videoCard: {
    width: wp(60),
    marginRight: wp(4),
    backgroundColor: '#111111',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  videoTag: {
    position: 'absolute',
    top: wp(2),
    left: wp(2),
    backgroundColor: 'rgba(255,215,0,0.9)',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.4),
    borderRadius: 4,
    zIndex: 10,
  },
  tagText: {
    color: '#0a0a0a',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Bold',
  },
  videoThumbnail: {
    width: '100%',
    height: hp(18),
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  playButtonOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewCount: {
    position: 'absolute',
    bottom: wp(2),
    right: wp(2),
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: 4,
    fontSize: wp(3),
    fontFamily: 'Outfit-SemiBold',
    zIndex: 11,
  },
  videoTitle: {
    color: '#fff',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    padding: wp(3),
    lineHeight: hp(2.2),
  },
  videoCardInfo: {
    padding: wp(3),
    gap: hp(0.5),
  },
  videoCardTitle: {
    color: '#fff',
    fontSize: wp(3.3),
    fontFamily: 'Outfit-Bold',
    lineHeight: wp(4.5),
  },
  videoCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: hp(0.5),
  },
  videoCardDetails: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Medium',
  },
  latestBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: wp(1.5),
    paddingVertical: hp(0.2),
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  latestLabel: {
    color: '#22C55E',
    fontSize: wp(2),
    fontFamily: 'Outfit-Black',
    letterSpacing: 0.5,
  },

  /* NEWS CARDS */
  newsCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: wp(4.5),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  newsContent: {
    flex: 1,
  },
  newsTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-SemiBold',
    marginBottom: hp(0.5),
  },
  newsSnippet: {
    color: '#999',
    fontSize: wp(3.5),
    marginBottom: hp(0.5),
  },
  newsTime: {
    color: '#666',
    fontSize: wp(3),
  },

  /* FUEL PRICES */
  fuelSection: {
    marginHorizontal: wp(5),
    marginBottom: hp(2.5),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  fuelHeaderBanner: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelHeaderTitle: {
    color: '#333',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  fuelHeaderLeft: {
    flex: 1,
    gap: hp(0.2),
  },
  locationTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  locationTrackText: {
    color: '#333',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    flex: 1,
  },
  stateButton: {
    backgroundColor: '#fff',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(0.8),
  },
  stateButtonText: {
    color: '#0a0a0a',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },
  fuelContentCard: {
    backgroundColor: '#111111',
    paddingHorizontal: wp(2),
    paddingVertical: hp(2.5),
    gap: hp(1.5),
  },
  fuelInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  fuelInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  fuelInlineLabel: {
    color: '#999',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  fuelInlineValue: {
    color: '#FFBF00',
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
  },
  fuelInlineSpacer: {
    width: 1,
    height: hp(3),
    backgroundColor: '#333',
  },
  viewTrendsButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  viewTrendsText: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-SemiBold',
  },
  fuelLoader: {
    marginVertical: hp(2),
  },
  loadingText: {
    color: '#888',
    fontSize: wp(4),
    textAlign: 'center',
    paddingVertical: hp(2),
  },

  /* COMING SOON */
  featureRow: {
    flexDirection: 'row',
    gap: wp(3),
    justifyContent: 'space-between',
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: hp(2.5),
    paddingHorizontal: wp(2),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  comingSoonBadge: {
    width: wp(90),
    height: hp(40),
    alignSelf: 'center',
    marginTop: hp(-4),
    marginBottom: hp(-15),
  },
  featureTitle: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-SemiBold',
    marginTop: hp(1),
    textAlign: 'center',
  },

  /* STATE SELECTION MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: hp(80),
    paddingTop: hp(2),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
  },
  stateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  selectedStateOption: {
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  stateOptionText: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
  },

  /* STATE SEARCH */
  stateSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    marginHorizontal: wp(5),
    marginBottom: hp(2),
    paddingHorizontal: wp(3),
    height: hp(5),
    gap: wp(2),
    borderWidth: 0,
  },
  searchIcon: {
    marginRight: wp(1),
  },
  stateSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
    paddingVertical: hp(1),
  },

  /* FULL HEIGHT AD */
  fullAdSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
    marginTop: hp(-1), // Reduced top spacing as requested
    width: wp(100), // Taking full available viewport instead of arbitrary percentage wrapper
    alignItems: 'center',
  },
  fullAdTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: hp(1.5),
  },
  fullAdImage: {
    width: wp(90),
    height: hp(40), // Adjusted to reduce letterbox whitespace and fit closely above the button
    borderRadius: 12,
  },
  exploreAdButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: wp(12),
    paddingVertical: hp(1.6),
    borderRadius: 8,
    marginTop: hp(-2), // Pull the button slightly up against the image bounds
  },
  exploreAdButtonText: {
    color: '#0a0a0a',
    fontSize: wp(4.5),
    fontWeight: '800',
  },
});
