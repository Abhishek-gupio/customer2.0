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
  Image,
  type ImageSourcePropType,
} from 'react-native';
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

export default function Home() {
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [numberPlate, setNumberPlate] = useState('');
  const [fuelPrices, setFuelPrices] = useState<{ petrol: number; diesel: number; cng?: number } | null>(null);
  const [selectedState, setSelectedState] = useState('Kerala');
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
  const placeholders = ['MH01CH4322', 'AP39CH5621', 'UP31CH4259'];
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Initial load
  useEffect(() => {
    fetchDiscoveryContent();
    fetchUserLocation();
  }, []);

  // Fetch fuel prices when state changes
  useEffect(() => {
    fetchFuelPrices();
  }, [selectedState]);

  useFocusEffect(
    useCallback(() => {
      fetchPrimaryVehicle();
    }, [])
  );

  // Auto-scroll carousel every 5 seconds
  // Use a ref to avoid stale closure & re-creating the interval on every slide,
  // which caused IllegalStateException from conflicting Animated frame timestamps.
  const carouselIndexRef = useRef(0);
  useEffect(() => {
    const totalSlides = showOdometerSlide ? 5 : 4;
    const timer = setInterval(() => {
      if (autoScrollStoppedRef.current) return;
      const nextIndex = (carouselIndexRef.current + 1) % 4;
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
    }, 9000);
    return () => clearInterval(timer);
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
          const upcoming = await api.get<any[]>(`/v1/expenses/warranty/vehicles/${primary.id}/upcoming`);
          const overdue = (upcoming as any).data?.find((p: any) => p.urgency === 'OVERDUE');
          if (overdue) {
            setServiceDueText('Overdue!');
          } else {
            // Find closest logic... for simplicity using first
            const first = (upcoming as any).data?.[0];
            if (first) {
              const kmLeft = first.lifecycleKm - first.kmSinceReplacement;
              setServiceDueText(`${kmLeft > 0 ? kmLeft : 0} km`);
            } else {
              setServiceDueText('Healthy');
            }
          }
        } catch (err) {
          console.warn('Could not fetch upcoming service for home', err);
          setServiceDueText('N/A');
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

  const fetchUserLocation = async () => {
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
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
            );
          });
          if (coords) {
            const geo = await reverseGeocode(coords.lat, coords.lon);
            if (geo) {
              setUserLocationDisplay(geo.display);
              if (geo.state && STATES.includes(geo.state)) {
                setSelectedState(geo.state);
              }
              return;
            }
          }
        }
      }

      // fallback to IP
      let geo: any = null;
      for (const ipUrl of GEO.ipProviders) {
        try {
          const res = await fetch(ipUrl, { headers: { 'User-Agent': GEO.userAgent } });
          const data = await res.json();
          if (data?.city && data?.region) {
            geo = data;
            break;
          }
        } catch { /* ignore */ }
      }

      if (geo) {
        setUserLocationDisplay(`${geo.city}, ${geo.region}`);
        if (geo.region && STATES.includes(geo.region)) {
          setSelectedState(geo.region);
        } else if (geo.region_name && STATES.includes(geo.region_name)) {
          setSelectedState(geo.region_name);
        }
      } else {
        setUserLocationDisplay('Location not available');
      }
    } catch (error) {
      console.error('Location detection failed:', error);
      setUserLocationDisplay('Location not available');
    } finally {
      setLocationLoading(false);
    }
  };

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

  const fetchDiscoveryContent = async () => {
    try {
      setDiscoveryLoading(true);
      const res = await api.get<{
        success?: boolean;
        data?: { news?: unknown; videos?: unknown };
      }>('/v1/discovery/trending');
      const body = res as { data?: { news?: unknown; videos?: unknown } };
      const inner = body?.data ?? (res as { news?: unknown; videos?: unknown });
      const newsRaw = inner?.news;
      const videosRaw = inner?.videos;
      setTrendingNews(Array.isArray(newsRaw) ? newsRaw : []);
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
              autoScrollStoppedRef.current = true;
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
                      <Image
                        source={heroImageSource}
                        style={styles.primaryImageFull}
                        resizeMode="cover"
                      />
                      <View style={styles.primaryImageOverlay}>
                        {vehicleLoading ? (
                          <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start' }} />
                        ) : vehicle ? (
                          <>
                            <Text style={styles.headerNumberPlate}>{vehicle.registrationNumber}</Text>
                            <Text style={styles.headerCarModel}>{vehicle.make} {vehicle.model}</Text>
                            <View style={styles.healthSection}>
                              <Text style={styles.healthText}>
                                {vehicle.healthScore?.overallScore || 100}% <Text style={styles.healthLabel}>Health</Text>
                              </Text>
                              <View style={styles.healthBarBg}>
                                <View style={[styles.healthBarFill, { width: `${vehicle.healthScore?.overallScore || 100}%` }]} />
                              </View>
                            </View>
                          </>
                        ) : (
                          <View>
                            <Text style={styles.headerNumberPlate}>Add Vehicle</Text>
                            <Text style={styles.headerCarModel}>Tap to get started</Text>
                          </View>
                        )}

                        <View style={styles.headerFooterOverlay}>
                          <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>Service due in</Text>
                            <Text style={styles.footerValue}>{serviceDueText}</Text>
                          </View>
                          <View style={[styles.footerItem, { alignItems: 'flex-end' }]}>
                            <Text style={styles.footerLabel}>FASTag</Text>
                            <Text style={styles.footerValue}>₹ ---</Text>
                          </View>
                        </View>
                      </View>
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
                        <Image
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
                        <Image
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
                        <Image
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
                    <Image
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
            <TouchableOpacity onPress={handleSOSPress} style={styles.sosOverlayButton}>
              <Icon name="shield-alt" size={wp(4)} color="#fff" />
              <Text style={styles.sosOverlayText}>SOS</Text>
            </TouchableOpacity>
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
              <View style={styles.greenDot} />
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

        {/* QUICK SERVICES GRID */}
        <QuickServicesGrid
          onServicePress={label => {
            if (label === 'Document') {
              navigateToRootScreen('DocumentList');
            } else if (label === 'My Garage') {
              navigateToRootScreen('VehicleList');
            } else if (label === 'Expense') {
              navigateToRootScreen('Expenses');
            } else if (label === 'Valet') {
              navigateToRootScreen('Valet');
            } else if (label === 'Service') {
              navigation.navigate('Services' as any, { screen: 'ServicesHome' });
            } else if (label === 'Driving') {
              navigateToRootScreen('DrivingSummary');
            } else if (label === 'Near By') {
              navigation.navigate('Services' as any, { 
                screen: 'NearbyPlaces',
                params: { fromHome: true }
              });
            } else if (label === 'Support') {
              handleHelpPress();
            }
          }}
        />

        {/* INSURANCE BANNER */}
        <View style={styles.bannerSection}>
          <View style={styles.insuranceBanner}>
            <Image
              source={require('../../assets/images/challan.png') as any}
              style={styles.bannerImage}
              resizeMode="contain"
            />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Check Your Challans & Avoid Trouble!</Text>
              <Text style={styles.bannerDesc}>Settle now to avoid late fees and skip the hassle of going to court.</Text>
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => navigation.navigate('Services' as any, { screen: 'CheckChallan' })}
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
                    <Image
                      source={{ uri: item.thumbnail }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
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
              <Text style={styles.loadingText}>Unable to load fuel prices</Text>
            </View>
          )}
        </View>

        {/* TRENDING CAR NEWS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Car News</Text>
            {discoveryLoading ? (
              <ActivityIndicator size="small" color="#FFBF00" />
            ) : null}
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
            trendingNews.map((news, index) => (
              <TouchableOpacity
                key={String(news?.id ?? index)}
                style={styles.newsCard}
                onPress={() => handleNewsPress(news.url)}
              >
                <View style={styles.newsContent}>
                  <Text style={styles.newsTitle}>{news.title}</Text>
                  <Text style={styles.newsSnippet} numberOfLines={1}>
                    {news.snippet}
                  </Text>
                  <Text style={styles.newsTime}>{news.time}</Text>
                </View>
              </TouchableOpacity>
            ))
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
          <Image
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
          navigation.navigate(screen);
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
    paddingHorizontal: wp(6),
    paddingTop: hp(6),
    paddingBottom: hp(6),
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  headerFooterOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    paddingTop: hp(4), // Avoid top overlay
    alignItems: 'center', // Center vertically
  },
  headerLeft: {
    flex: 1.3,
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerNumberPlate: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(5.5),
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerCarModel: {
    fontFamily: 'Outfit-SemiBold',
    color: '#f4f4f4',
    fontSize: wp(3.7),
    fontWeight: '700',
    marginTop: hp(0.2),
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  healthSection: {
    marginTop: hp(1.5),
  },
  healthText: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '700',
  },
  healthLabel: {
    color: '#4ade80', // Greenish
    fontSize: wp(3.5),
    fontWeight: '600',
  },
  healthBarBg: {
    width: wp(40),
    height: hp(0.5),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginTop: hp(1),
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    backgroundColor: '#32D74B',
    borderRadius: 4,
  },
  headerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    paddingBottom: hp(6),
  },
  footerItem: {
    justifyContent: 'center',
  },
  footerLabel: {
    fontFamily: 'Outfit-Medium',
    color: '#f1f1f1',
    fontSize: wp(3.1),
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footerValue: {
    fontFamily: 'Outfit-Black',
    color: '#ffffff',
    fontSize: wp(4),
    marginTop: hp(0.2),
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sosOverlayButton: {
    height: hp(4),
    paddingHorizontal: wp(3.5),
    borderRadius: 20,
    backgroundColor: 'rgba(255, 77, 77, 0.18)',
    borderWidth: 1.5,
    borderColor: '#ff4d4d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(3),
    // Premium glow effect
    shadowColor: '#ff4d4d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  sosOverlayText: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    marginLeft: wp(1.2),
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
    paddingHorizontal: wp(2.5),
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: hp(0.5),
  },
  greenDot: {
    width: wp(1.5),
    height: wp(1.5),
    borderRadius: wp(0.75),
    backgroundColor: '#4ade80',
    marginBottom: hp(0.3),
  },
  indText: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(2.6),
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
