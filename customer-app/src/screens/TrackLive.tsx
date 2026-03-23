import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, Linking, Dimensions, Animated, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { useVehicle } from '../context/VehicleContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import { config } from '../config/environment';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import ErrorBoundary from '../components/ErrorBoundary';
import ReusableModal from '../components/ReusableModal';

const backIcon = require('../assets/humberger.png');
const gupioLocationIcon = require('../assets/gupiolocation.png');
const mappingCarIcon = require('../assets/mapping_car.png');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper function to create fetch with timeout
const fetchWithTimeout = (url: string, options: any, timeout: number = 15000): Promise<Response> => {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Route request timeout')), timeout)
    )
  ]);
};

// OSRM Route Fetching Function (Free, no API key needed)
const fetchRoute = async (
  startLat: number, 
  startLng: number, 
  endLat: number, 
  endLng: number
): Promise<Array<[number, number]> | null> => {
  try {
    // Check network state before fetching route
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) {
      console.warn('⚠️ [ROUTE] No internet connection - cannot fetch route');
      return null;
    }

    // OSRM - completely free, no key needed
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    
    console.log('🗺️ [ROUTE] Fetching route from OSRM:', url);
    
    // Fetch with 15 second timeout
    const response = await fetchWithTimeout(url, {}, 15000);
    
    if (!response.ok) {
      console.warn(`⚠️ [ROUTE] Route service returned error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // Convert from [lng, lat] to [lat, lng] for Leaflet
      const coordinates = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
      const distance = route.distance; // Distance in meters
      const duration = route.duration; // Duration in seconds
      console.log('✅ [ROUTE] Route fetched successfully:');
      console.log('   - Points:', coordinates.length);
      console.log('   - Distance:', (distance / 1000).toFixed(2), 'km');
      console.log('   - Estimated time:', Math.round(duration / 60), 'minutes');
      console.log('   - This is a ROAD ROUTE (not straight line)');
      return coordinates;
    }
    console.warn('⚠️ [ROUTE] No route found in response');
    return null;
  } catch (error: any) {
    if (error.message?.includes('timeout')) {
      console.error('❌ [ROUTE] Route request timeout - service took too long to respond');
    } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
      console.error('❌ [ROUTE] Network error - cannot fetch route');
    } else {
      console.error('❌ [ROUTE] Error fetching route:', error);
    }
    return null;
  }
};

const TrackLive: React.FC = () => {
  // Error boundary for catching React errors
  const { error, triggerError, ErrorBoundaryUI } = useScreenErrorBoundary('TrackLive');
  if (error) return ErrorBoundaryUI;
  
  const { vehicleInfo, requestStatus, vehicleRequestData, isValetOnWay } = useVehicle();
  
  // Get car image URI - use Cloudinary URL in production, local asset in development
  // This ensures the image works properly in APK builds (local assets don't work reliably in release builds)
  const getCarImageUri = useMemo((): string => {
    // Fallback Cloudinary URL (same as ValetMapView uses)
    const fallbackCloudinaryUrl = 'https://res.cloudinary.com/dveyxa6i5/image/upload/v1764738772/mapping_car_vxavjt.png';
    
    // In release builds (APK), always use Cloudinary URL (local assets don't work reliably)
    // Check if we're in a release build by checking __DEV__ flag
    const isReleaseBuild = !__DEV__;
    
    if (isReleaseBuild || config.name === 'production') {
      // Check if Cloudinary URL is configured (production)
      if (config.carImageUrl && config.carImageUrl.trim() !== '') {
        // Validate it's a proper URL
        try {
          const url = new URL(config.carImageUrl);
          // Ensure it's HTTPS for security
          if ((url as any).protocol === 'https:') {
            console.log('✅ [CAR_IMAGE] Using Cloudinary URL from config:', config.carImageUrl);
            return config.carImageUrl;
          } else {
            console.warn('⚠️ [CAR_IMAGE] Cloudinary URL must use HTTPS, using fallback');
          }
        } catch (e) {
          console.warn('⚠️ [CAR_IMAGE] Invalid Cloudinary URL, using fallback:', e);
        }
      }
      
      console.log('✅ [CAR_IMAGE] Release/Production build - using Cloudinary URL:', fallbackCloudinaryUrl);
      return fallbackCloudinaryUrl;
    }
    
    // In development (Metro bundler), try local asset first
    try {
      const localUri = Image.resolveAssetSource(mappingCarIcon).uri;
      // Only use local asset if it's a proper file:// URI (not a data URI or invalid)
      if (localUri && (localUri.startsWith('file://') || localUri.startsWith('http://') || localUri.startsWith('https://'))) {
        console.log('✅ [CAR_IMAGE] Development mode - using local asset:', localUri);
        return localUri;
      } else {
        console.warn('⚠️ [CAR_IMAGE] Invalid local asset URI, using Cloudinary fallback');
        return fallbackCloudinaryUrl;
      }
    } catch (e) {
      console.warn('⚠️ [CAR_IMAGE] Failed to resolve local asset, using Cloudinary fallback:', e);
      return fallbackCloudinaryUrl;
    }
  }, [config.carImageUrl, config.name]); // Re-compute if config changes
  
  const carImageUri = getCarImageUri;
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routePoints, setRoutePoints] = useState<Array<{ latitude: number; longitude: number; ts: number }>>([]);
  const [dest, setDest] = useState<{ latitude: number; longitude: number } | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [speedHistory, setSpeedHistory] = useState<number[]>([]); // ✅ For speed smoothing
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // ✅ Production improvements
  const [autoFollow, setAutoFollow] = useState<boolean>(true); // Auto-center on valet
  const [mapErrorCount, setMapErrorCount] = useState<number>(0);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(true);
  const routeCacheRef = useRef<Map<string, { route: Array<[number, number]>, timestamp: number }>>(new Map());
  const [pollingStatus, setPollingStatus] = useState<string>('Initializing...');
  const [lastApiResponse, setLastApiResponse] = useState<any>(null);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const mapRef = useRef<MapView>(null);
  // Network state tracking
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [showNetworkBanner, setShowNetworkBanner] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isValetSharingLocation, setIsValetSharingLocation] = useState<boolean>(false);
  const [valetInactiveTime, setValetInactiveTime] = useState<number>(0); // seconds since last update
  const [carRotation, setCarRotation] = useState<number>(0); // Car rotation angle in degrees
  const previousCoordsForRotation = useRef<{ lat: number; lng: number } | null>(null);
  
  // Rotation offset to align car image with polyline direction
  // Set to 0 if car image faces north when rotation is 0, adjust if needed
  const ROTATION_OFFSET = 0; // degrees - adjust if car image default orientation is different
  
  // Animated values for smooth Zepto-like car movement
  const animatedLat = useRef(new Animated.Value(0)).current;
  const animatedLng = useRef(new Animated.Value(0)).current;
  const animatedRotation = useRef(new Animated.Value(0)).current;
  const [animatedCoords, setAnimatedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  
  /* Modal states for replacing Alert messages */
  const [showNoInternetModal, setShowNoInternetModal] = useState(false);
  const [showServerErrorModal, setShowServerErrorModal] = useState(false);
  const [showRequestErrorModal, setShowRequestErrorModal] = useState(false);
  const [showGenericErrorModal, setShowGenericErrorModal] = useState(false);
  const [showConnectionFailedModal, setShowConnectionFailedModal] = useState(false);
  const [showValetArrivedModal, setShowValetArrivedModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [retryCallback, setRetryCallback] = useState<(() => void) | null>(null);
  
  const pollingIntervalRef = useRef<any>(null);
  const locationWatchId = useRef<number | null>(null);
  const mapUpdateTimeoutRef = useRef<any>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const arrivalPopupShownRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<any>(null);
  const networkUnsubscribeRef = useRef<any>(null);
  const valetInactiveCheckRef = useRef<any>(null);
  const navigation = useNavigation<any>();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current; // ✅ Start at 1 to ensure visibility
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // ✅ Network monitoring for production
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isNetworkOnline;
      setIsNetworkOnline(state.isConnected ?? true);
      
      if (!state.isConnected) {
        console.warn('⚠️ [NETWORK] Connection lost - map updates paused');
        setApiError('No internet connection. Map may not update.');
      } else {
        if (wasOffline) {
          console.log('✅ [NETWORK] Connection restored - resuming updates');
          setApiError(null);
          // Map will automatically update when coords change
        }
      }
    });
    
    return () => unsubscribe();
  }, [isNetworkOnline]);

  // Fade in animation on mount (already at 1, but keep for smooth transition)
  useEffect(() => {
    // Ensure fadeAnim is visible immediately
    fadeAnim.setValue(1);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pulse animation for loading state
  useEffect(() => {
    if (isLoadingLocation) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isLoadingLocation]);

  // Get customer's current location (with permission handling)
  useEffect(() => {
    let isMounted = true;

    const requestLocationPermission = async (): Promise<boolean> => {
      try {
        if (Platform.OS === 'android') {
          const fineGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Allow location access',
              message: 'We use your location to show live valet tracking and ETA.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
              buttonNeutral: 'Ask me later',
            }
          );

          if (fineGranted === PermissionsAndroid.RESULTS.GRANTED) {
            return true;
          }

          const coarseGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
          );

          return coarseGranted === PermissionsAndroid.RESULTS.GRANTED;
        }

        const requestAuth = Geolocation.requestAuthorization as
          | ((mode?: 'always' | 'whenInUse') => Promise<'granted' | 'denied' | 'restricted' | 'always' | 'whenInUse' | void> | void)
          | undefined;

        if (typeof requestAuth === 'function') {
          const authStatus = await requestAuth('whenInUse');
          if (typeof authStatus === 'string') {
            return authStatus === 'granted' || authStatus === 'always' || authStatus === 'whenInUse';
          }
        }

        return true;
      } catch (error) {
        console.warn('⚠️ Location permission request failed:', error);
        return false;
      }
    };

    const startLocationUpdates = async () => {
      setIsLoadingLocation(true);
      const hasPermission = await requestLocationPermission();

      if (!hasPermission) {
        console.warn('⚠️ Location permission denied – customer marker will fall back to valet location.');
        if (isMounted) {
          setIsLoadingLocation(false);
        }
        return;
      }

      Geolocation.getCurrentPosition(
        (position) => {
          if (!isMounted) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCustomerLocation({ lat, lng });
          console.log('📍 Initial customer location:', lat, lng);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.log('❌ Failed to get initial customer location:', error);
          if (isMounted) {
            setIsLoadingLocation(false);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );

      const id = Geolocation.watchPosition(
        (position) => {
          if (!isMounted) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCustomerLocation({ lat, lng });
          console.log('📍 Customer location update:', lat, lng);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.log('❌ Failed to watch customer location:', error);
        },
        { enableHighAccuracy: true, distanceFilter: 5, interval: 5000, fastestInterval: 2000 }
      );

      locationWatchId.current = (id as unknown) as number;
    };

    startLocationUpdates();

    return () => {
      isMounted = false;
      if (locationWatchId.current !== null) {
        try {
          Geolocation.clearWatch(locationWatchId.current);
        } catch (error) {
          console.warn('⚠️ Failed to clear customer location watch:', error);
        }
        locationWatchId.current = null;
      }
    };
  }, []);

  // Customer location is now sent automatically by customerLocationService in VehicleContext
  // No need to send it here - it works globally even when TrackLive is not open
  // This ensures valet can see customer location even if customer doesn't open TrackLive screen

  const normalize = (s: string): string => (s || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');

  const acceptedFirstRef = useRef(false);

  // Network state monitoring
  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(state => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      setNetworkType(state.type || 'unknown');
      setShowNetworkBanner(!connected);
      if (connected) {
        setRetryCount(0);
        setIsRetrying(false);
      }
    });

    // Listen for network state changes
    networkUnsubscribeRef.current = NetInfo.addEventListener(state => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      setNetworkType(state.type || 'unknown');
      
      if (!connected) {
        setShowNetworkBanner(true);
        setApiError(getNetworkErrorMessage(state));
        setPollingStatus('No internet connection');
      } else {
        setShowNetworkBanner(false);
        setApiError(null);
        setRetryCount(0);
        setIsRetrying(false);
        // Retry immediately when connection is restored
        if (pollingIntervalRef.current) {
          const vnum = vehicleInfo?.vehicleNumberFull || requestStatus?.vehicleNumber;
          if (vnum) {
            console.log('🔄 [NETWORK] Connection restored - retrying location fetch');
            // Trigger immediate fetch
            setTimeout(() => {
              const fetchLocation = async () => {
                try {
                  const baseUrl = config.apiBaseUrl.replace('/customer', '');
                  const fullUrl = `${baseUrl}/valet-location/${vnum.toUpperCase().trim()}`;
                  const response = await fetch(fullUrl, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                  });
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data) {
                      setCoords({ lat: data.data.latitude, lng: data.data.longitude });
                      setLastUpdate(Date.now());
                    }
                  }
                } catch (error) {
                  console.error('❌ [NETWORK] Retry failed:', error);
                }
              };
              fetchLocation();
            }, 500);
          }
        }
      }
    });

    return () => {
      if (networkUnsubscribeRef.current) {
        networkUnsubscribeRef.current();
      }
    };
  }, [vehicleInfo?.vehicleNumberFull, requestStatus?.vehicleNumber]);

  // Helper function to get user-friendly network error message
  const getNetworkErrorMessage = (state: any): string => {
    if (!state.isConnected) {
      if (state.type === 'none') {
        return 'No internet connection. Please check your network settings.';
      }
      if (state.type === 'cellular' && !state.isConnected) {
        return 'Mobile data is turned off. Please enable mobile data or connect to Wi-Fi.';
      }
      return 'No internet connection available.';
    }
    if (state.isInternetReachable === false) {
      return 'Connected but no internet access. Please check your connection.';
    }
    return 'Network connection issue.';
  };

  // HTTP Polling for valet location - ONLY start after valet accepts
  useFocusEffect(
    useCallback(() => {
      const vnum = vehicleInfo?.vehicleNumberFull || requestStatus?.vehicleNumber;
      console.log('🔍 TrackLive: ===== CHECKING POLLING CONDITIONS =====');
      console.log('🔍 TrackLive: Vehicle number:', vnum);
      console.log('🔍 TrackLive: Valet accepted?', isValetOnWay || vehicleRequestData?.requestStatus === 'ACCEPTED' || requestStatus?.vehicleStatus === 'IN_TRANSIT');
      
      // Check if request is completed (vehicle dropped)
      const isCompleted = 
        vehicleRequestData?.requestStatus === 'COMPLETED' ||
        vehicleRequestData?.requestStatus === 'RETURNED' ||
        requestStatus?.requestStatus === 'COMPLETED' ||
        requestStatus?.requestStatus === 'RETURNED';
      
      // Check if valet has accepted the request
      const hasValetAccepted = isValetOnWay || 
                               vehicleRequestData?.requestStatus === 'ACCEPTED' || 
                               requestStatus?.vehicleStatus === 'IN_TRANSIT' ||
                               requestStatus?.requestStatus === 'ACCEPTED';
      
      if (!vnum) {
        console.error('❌ TrackLive: No vehicle number available for tracking');
        setPollingStatus('No vehicle assigned yet');
        setApiError(null);
        return;
      }
      
      // Stop polling if request is completed (vehicle dropped)
      if (isCompleted) {
        console.log('🛑 TrackLive: Request completed (vehicle dropped) - stopping valet location polling');
        setPollingStatus('Vehicle drop completed');
        setApiError(null);
        setIsPolling(false);
        // Clear any existing polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        return;
      }
      
      if (!hasValetAccepted) {
        console.log('⏳ TrackLive: Valet has not accepted the request yet - polling will not start');
        setPollingStatus('Waiting for valet to accept request...');
        setApiError(null);
        setIsPolling(false);
        // Don't start polling - just return
        return;
      }
      
      console.log('✅ TrackLive: Valet has accepted - starting HTTP polling');
      
      const vehicleNumber = vnum.toUpperCase().trim();

      // PRODUCTION-READY: Prevent duplicate API calls with debouncing
      let lastFetchTime = 0;
      const MIN_FETCH_INTERVAL = 8000; // Minimum 8 seconds between calls (aligned with 10s polling)
      let isFetching = false; // Track if fetch is in progress

      // Retry function with exponential backoff
      const fetchLocationWithRetry = async (attempt: number = 0): Promise<void> => {
        // Prevent duplicate calls if fetch is already in progress
        if (isFetching) {
          console.log('⏸️ [POLLING] Fetch already in progress, skipping duplicate call');
          return;
        }
        
        // Debounce: Don't call if last call was too recent
        const now = Date.now();
        if (now - lastFetchTime < MIN_FETCH_INTERVAL && attempt === 0) {
          console.log('⏸️ [POLLING] Too soon since last call, skipping (debounced)');
          return;
        }
        
        isFetching = true;
        lastFetchTime = now;
        const MAX_RETRIES = 3;
        const BASE_DELAY = 1000; // 1 second
        
        // Check if request is completed (vehicle dropped) - stop polling immediately
        const isCompleted = 
          vehicleRequestData?.requestStatus === 'COMPLETED' ||
          vehicleRequestData?.requestStatus === 'RETURNED' ||
          requestStatus?.requestStatus === 'COMPLETED' ||
          requestStatus?.requestStatus === 'RETURNED';
        
        if (isCompleted) {
          console.log('🛑 TrackLive: Request completed during polling - stopping immediately');
          setPollingStatus('Vehicle drop completed');
          setIsPolling(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          return;
        }
        
        // Check network state before making request
        const netState = await NetInfo.fetch();
        if (!netState.isConnected || netState.isInternetReachable === false) {
          const errorMsg = getNetworkErrorMessage(netState);
          setApiError(errorMsg);
          setPollingStatus('No internet connection');
          setIsRetrying(false);
          
          // Show popup alert for network error with retry option
          if (attempt === 0) {
            setRetryCallback(() => () => fetchLocationWithRetry(0));
            setShowNoInternetModal(true);
            return;
          }
          return;
        }

        try {
          if (attempt > 0) {
            setIsRetrying(true);
            setPollingStatus(`Retrying... (attempt ${attempt}/${MAX_RETRIES})`);
          } else {
            setPollingStatus(`Fetching location for ${vehicleNumber}...`);
          }
          
          console.log('📡 [POLLING] Fetching location for vehicle:', vehicleNumber, attempt > 0 ? `(retry ${attempt})` : '');
          
          const baseUrl = config.apiBaseUrl.replace('/customer', '');
          const fullUrl = `${baseUrl}/valet-location/${vehicleNumber}`;
          console.log('📡 [POLLING] Full URL:', fullUrl);
          
          // Fetch with 10 second timeout
          const response = await fetchWithTimeout(fullUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }, 10000);
          
          console.log('📡 [POLLING] Response status:', response.status, response.statusText);
          
          // Check if response is OK before parsing
          if (!response.ok) {
            // Handle 429 (Rate Limit) - most important to handle properly
            if (response.status === 429) {
              console.warn('⚠️ [POLLING] Rate limited (429) - slowing down requests');
              setPollingStatus('Slowing down (rate limited)...');
              setLastApiResponse({ 
                status: 429, 
                message: 'Too many requests - polling slowed',
                note: 'Automatically reducing request frequency'
              });
              setApiError(null); // Don't show error, just slow down
              // Keep existing coords visible
              // The interval will continue but less frequently
              return;
            }
            
            // Handle 404 (no location data) differently from other errors
            if (response.status === 404) {
              const errorData = await response.json().catch(() => ({ message: 'No location data available' }));
              console.log('⚠️ [POLLING] No location data available yet (404):', errorData.message);
              
              // If we have existing coords, show "updating" instead of "waiting"
              const currentCoords = coordsRef.current;
              const currentLastUpdate = lastUpdateRef.current;
              if (currentCoords) {
                const secondsAgo = currentLastUpdate > 0 ? Math.floor((Date.now() - currentLastUpdate) / 1000) : 0;
                setPollingStatus(`Updating location... (last seen ${secondsAgo}s ago)`);
              } else {
                setPollingStatus(`Waiting for valet to share location...`);
              }
              
              setLastApiResponse({ 
                status: 404, 
                message: errorData.message,
                vehicleNumber: vehicleNumber,
                note: 'Valet app needs to start location polling for this vehicle'
              });
              setApiError(null); // Clear error if it's just "no data yet"
              // Don't clear coords - keep showing last known location
              // Keep polling to get updates when available
              return;
            }
            
            // Handle server errors (500, 502, 503, 504) - internal server issues
            if (response.status >= 500 && response.status < 600) {
              const serverErrorMessages: { [key: number]: string } = {
                500: 'Internal Server Error - Our servers encountered an issue',
                502: 'Bad Gateway - Server is temporarily unavailable',
                503: 'Service Unavailable - Server is under maintenance',
                504: 'Gateway Timeout - Server took too long to respond',
              };
              
              const errorMsg = serverErrorMessages[response.status] || `Server Error (${response.status})`;
              console.error('❌ [POLLING] Server error:', response.status, errorMsg);
              setPollingStatus(`Server Error: ${response.status}`);
              setLastApiResponse({ status: response.status, message: errorMsg });
              setApiError(errorMsg);
              
              // Show popup alert for server errors with retry option
              if (attempt === 0) {
                setErrorModalTitle('Server Error');
                setErrorModalMessage(`${errorMsg}. Please try again in a moment.`);
                setRetryCallback(() => {
                  const delay = BASE_DELAY * Math.pow(2, attempt);
                  setTimeout(() => {
                    fetchLocationWithRetry(attempt + 1);
                  }, delay);
                });
                setShowServerErrorModal(true);
              }
              return;
            }
            
            // For other errors, try to parse error message (handle non-JSON responses)
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                const errorMsg = errorData.message || 'Unknown error';
                console.error('❌ [POLLING] API error:', errorMsg);
                setPollingStatus(`API Error: ${response.status}`);
                setLastApiResponse({ status: response.status, message: errorMsg });
                setApiError(`API Error: ${errorMsg}`);
                
                // Show popup for other API errors (400, 401, 403, etc.)
                if (attempt === 0 && response.status >= 400 && response.status < 500) {
                  setErrorModalTitle('Request Error');
                  setErrorModalMessage(errorMsg || `Error ${response.status}: Please check your request and try again.`);
                  setRetryCallback(() => {
                    fetchLocationWithRetry(attempt + 1);
                  });
                  setShowRequestErrorModal(true);
                }
              } else {
                // HTML or other non-JSON response
                const errorText = await response.text();
                console.error('❌ [POLLING] Non-JSON response:', response.status, errorText.substring(0, 100));
                setPollingStatus(`API Error: ${response.status}`);
                setLastApiResponse({ status: response.status, message: `Server error (${response.status})` });
                setApiError(`Server returned error: ${response.status}`);
              }
            } catch (parseError) {
              console.error('❌ [POLLING] API error:', response.statusText);
              setPollingStatus(`API Error: ${response.status}`);
              setLastApiResponse({ status: response.status, message: response.statusText });
              setApiError(`API Error: ${response.status} ${response.statusText}`);
            }
            return;
          }
          
          const responseData = await response.json();
          console.log('📡 [POLLING] Response data:', responseData);
          setLastApiResponse(responseData);
          
          // Check if drop is completed - stop polling immediately
          if (responseData.dropCompleted === true) {
            console.log('🛑 [POLLING] Drop completed - stopping location polling immediately');
            setPollingStatus('Vehicle drop completed');
            setIsPolling(false);
            setApiError(null);
            // Clear any existing polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = null;
            }
            return;
          }
          
          if (responseData.success && responseData.data) {
            const data = responseData.data;
            console.log('✅ [POLLING] Location received:', data);
            
            // Clear any previous errors
            setApiError(null);
            
            if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
              const newCoords = { lat: data.latitude, lng: data.longitude };
              const now = Date.now();
              const previousCoords = coordsRef.current;
              
              // Check if valet has moved
              const hasMoved = previousCoords && (
                Math.abs(previousCoords.lat - newCoords.lat) > 0.00001 ||
                Math.abs(previousCoords.lng - newCoords.lng) > 0.00001
              );
              
              // Calculate car rotation - ALWAYS use polyline direction when available
              let bearing = 0;
              let rotationSource = 'none';
              
              // ALWAYS prioritize route path (polyline) for accurate direction
              if (routePath.length > 2) {
                bearing = calculateBearing(newCoords.lat, newCoords.lng, routePath);
                rotationSource = 'polyline';
                console.log('🧭 [ROTATION] Using polyline-based bearing:', bearing.toFixed(1), '°');
              } 
              // Fallback to movement direction ONLY if no route path available
              else if (hasMoved && previousCoords) {
                bearing = calculateBearingBetweenPoints(
                  previousCoords.lat,
                  previousCoords.lng,
                  newCoords.lat,
                  newCoords.lng
                );
                rotationSource = 'movement';
                console.log('🧭 [ROTATION] Using movement-based bearing (no polyline):', bearing.toFixed(1), '°');
              }
              
              // Apply rotation offset to align car image with polyline
              let targetRotation = carRotation;
              if (rotationSource !== 'none') {
                targetRotation = (bearing + ROTATION_OFFSET) % 360;
                console.log('🧭 [ROTATION] Car bearing updated from', rotationSource, ':', bearing.toFixed(1), '° → adjusted:', targetRotation.toFixed(1), '°');
              }
              
              // Smooth Zepto-like animation for car movement
              if (previousCoords && hasMoved) {
                // Stop any ongoing animation
                if (animationRef.current) {
                  animationRef.current.stop();
                }
                
                // Calculate distance for animation duration (Zepto uses smooth, natural timing)
                const distance = haversineMeters(
                  previousCoords.lat,
                  previousCoords.lng,
                  newCoords.lat,
                  newCoords.lng
                );
                
                // Zepto-like smooth animation: 1.5-4 seconds based on distance
                // This creates natural, fluid movement
                const baseDuration = 2000; // Base 2 seconds for smooth feel
                const distanceFactor = Math.min(distance / 15, 2); // Scale with distance, max 2x
                const duration = Math.min(Math.max(baseDuration * distanceFactor, 1500), 4000);
                
                // Animate position smoothly (Zepto style)
                // Rotation will update automatically via listeners as position changes along polyline
                animationRef.current = Animated.parallel([
                  Animated.timing(animatedLat, {
                    toValue: newCoords.lat,
                    duration: duration,
                    useNativeDriver: false, // Must be false for map coordinates
                  }),
                  Animated.timing(animatedLng, {
                    toValue: newCoords.lng,
                    duration: duration,
                    useNativeDriver: false,
                  }),
                ]);
                
                animationRef.current.start(() => {
                  animationRef.current = null;
                });
                
                console.log('🚗 [ANIMATION] Smooth movement started:', duration.toFixed(0), 'ms for', distance.toFixed(1), 'm');
              } else {
                // First time or no movement - set immediately
                animatedLat.setValue(newCoords.lat);
                animatedLng.setValue(newCoords.lng);
                animatedRotation.setValue(targetRotation);
                setAnimatedCoords({ lat: newCoords.lat, lng: newCoords.lng });
                setCarRotation(targetRotation);
              }
              
              setCoords(newCoords);
              setLastUpdate(now);
              coordsRef.current = newCoords;
              lastUpdateRef.current = now;
              previousCoordsForRotation.current = newCoords;
              setIsPolling(true);
              setIsValetSharingLocation(true); // Valet is actively sharing
              setValetInactiveTime(0); // Reset inactive time
              
              // Update status based on movement
              if (hasMoved) {
                setPollingStatus(`Tracking... (valet moving)`);
                console.log('🚗 [POLLING] Valet location updated - valet is moving');
              } else {
                setPollingStatus(`Tracking... (valet stationary)`);
                console.log('📍 [POLLING] Valet location updated - valet is stationary');
              }
              
              // ✅ PRODUCTION-READY: Use speed from API with validation, calculate only if not provided
              // Speed validation constants
              const MAX_REASONABLE_SPEED = 200; // km/h (reasonable max for vehicles)
              const MIN_REASONABLE_SPEED = 0;
              const MAX_CALCULATED_SPEED = 150; // km/h (safety limit for calculated speed)
              const MIN_TIME_DIFFERENCE = 0.5; // seconds (minimum for accurate calculation)
              const MAX_TIME_DIFFERENCE = 300; // seconds (5 minutes - suspicious if longer)
              
              let hasApiSpeed = data.speed !== undefined && data.speed !== null;
              let validatedSpeed: number | null = null;
              
              if (hasApiSpeed) {
                // API speed is in m/s, convert to km/h (same as valet app)
                const speedFromApi = typeof data.speed === 'number' ? data.speed * 3.6 : 0;
                
                // ✅ Validate speed is within reasonable range
                if (speedFromApi >= MIN_REASONABLE_SPEED && speedFromApi <= MAX_REASONABLE_SPEED) {
                  validatedSpeed = Math.round(speedFromApi * 10) / 10;
                  console.log('⚡ [SPEED] Using validated speed from API:', validatedSpeed.toFixed(1), 'km/h');
                } else {
                  console.warn('⚠️ [SPEED] API speed out of range:', speedFromApi.toFixed(1), 'km/h - using fallback calculation');
                  hasApiSpeed = false; // Force calculation fallback
                }
              }
              
              // Always update route points for distance calculation (and speed if API doesn't provide it)
              setRoutePoints(prev => {
                // ✅ Better timestamp validation
                const currentTime = Date.now();
                const apiTimestamp = data.timestamp && data.timestamp > 0 ? data.timestamp : null;
                
                // Validate timestamp is not in future (5 second tolerance)
                let validTimestamp: number;
                if (apiTimestamp && apiTimestamp <= currentTime + 5000) {
                  validTimestamp = apiTimestamp;
                } else if (apiTimestamp) {
                  console.warn('⚠️ [SPEED] Invalid future timestamp:', apiTimestamp, '- using current time');
                  validTimestamp = currentTime;
                } else {
                  validTimestamp = currentTime;
                }
                
                const newPoint = { 
                  latitude: data.latitude, 
                  longitude: data.longitude, 
                  ts: validTimestamp
                };
                
                const MIN_DISTANCE = 1;
                if (prev.length > 0) {
                  const lastPoint = prev[prev.length - 1];
                  const distance = haversineMeters(
                    lastPoint.latitude,
                    lastPoint.longitude,
                    newPoint.latitude,
                    newPoint.longitude
                  );
                  
                  if (distance < MIN_DISTANCE) {
                    return prev;
                  }
                  
                  // ✅ Only calculate speed from route points if API doesn't provide it
                  if (!hasApiSpeed) {
                    const dt = (newPoint.ts - lastPoint.ts) / 1000; // seconds
                    
                    // ✅ Validate time difference is reasonable
                    if (dt <= 0 || dt > MAX_TIME_DIFFERENCE) {
                      console.warn('⚠️ [SPEED] Invalid time difference:', dt.toFixed(2), 's - skipping speed calculation');
                      // Don't update speed, but still add point for distance tracking
                    } else {
                      const dtSafe = Math.max(MIN_TIME_DIFFERENCE, dt);
                      const dMeters = distance;
                      const mps = dMeters / dtSafe;
                      const calculatedKmh = mps * 3.6;
                      
                      // ✅ Apply maximum speed cap for calculated speed
                      const newSpeed = Math.max(0, Math.min(MAX_CALCULATED_SPEED, Math.round(calculatedKmh * 10) / 10));
                      validatedSpeed = newSpeed;
                      console.log('⚡ [SPEED] Calculated from route points:', newSpeed.toFixed(1), 'km/h');
                    }
                  }
                }
                
                // ✅ Update speed with validation and smoothing
                if (validatedSpeed !== null && validatedSpeed >= 0) {
                  const finalSpeed = validatedSpeed; // Type narrowing for TypeScript
                  // Apply speed smoothing (moving average of last 3 speeds)
                  setSpeedHistory(prevHistory => {
                    const updatedHistory = [...prevHistory, finalSpeed].slice(-3); // Keep last 3 speeds
                    
                    // Calculate smoothed speed
                    if (updatedHistory.length >= 2) {
                      const avg = updatedHistory.reduce((a, b) => a + b, 0) / updatedHistory.length;
                      const smoothed = Math.round(avg * 10) / 10;
                      setSpeedKmh(smoothed);
                      return updatedHistory;
                    } else {
                      setSpeedKmh(finalSpeed);
                      return updatedHistory;
                    }
                  });
                }
                
                const next = [...prev, newPoint];
                return next.length > 200 ? next.slice(next.length - 200) : next;
              });
            }
          } else {
            console.log('⚠️ [POLLING] No location data in response:', responseData.message);
            setPollingStatus(`No location data: ${responseData.message || 'Unknown'}`);
            setApiError(null); // Clear error if it's just "no data yet"
          }
          
          // Reset retry count on success
          setRetryCount(0);
          setIsRetrying(false);
          isFetching = false; // Reset fetching flag
        } catch (error: any) {
          console.error('❌ [POLLING] Error fetching location:', error);
          
          // Determine error type and message
          let errorMsg = 'Unknown error';
          let shouldRetry = false;
          let showAlert = false;
          let alertTitle = 'Connection Error';
          let alertMessage = '';
          
          if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
            errorMsg = 'Request timeout - server took too long to respond';
            alertTitle = 'Connection Timeout';
            alertMessage = 'The server took too long to respond. Please check your connection and try again.';
            shouldRetry = attempt < MAX_RETRIES;
            showAlert = attempt === 0;
          } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
            // Check actual network state
            const netState = await NetInfo.fetch();
            errorMsg = getNetworkErrorMessage(netState);
            alertTitle = 'Network Error';
            alertMessage = 'Unable to connect to the server. Please check your internet connection.';
            shouldRetry = !!netState.isConnected && netState.isInternetReachable !== false && attempt < MAX_RETRIES;
            showAlert = attempt === 0;
          } else if (error.message?.includes('Aborted') || error.message?.includes('cancelled')) {
            errorMsg = 'Request was cancelled';
            shouldRetry = false;
            showAlert = false;
          } else {
            errorMsg = error.message || 'Failed to fetch location';
            alertTitle = 'Error';
            alertMessage = errorMsg;
            shouldRetry = attempt < MAX_RETRIES;
            showAlert = attempt === 0;
          }
          
          setApiError(errorMsg);
          setPollingStatus(shouldRetry ? `Connecting... (attempt ${attempt + 1}/${MAX_RETRIES})` : errorMsg);
          setLastApiResponse({ error: errorMsg });
          
          // Show popup alert for connection errors
          if (showAlert) {
            setErrorModalTitle(alertTitle);
            setErrorModalMessage(alertMessage);
            setRetryCallback(() => {
              fetchLocationWithRetry(0);
            });
            setShowGenericErrorModal(true);
          }
          
          // Retry with exponential backoff
          if (shouldRetry) {
            const delay = BASE_DELAY * Math.pow(2, attempt);
            setRetryCount(attempt + 1);
            setIsRetrying(true);
            console.log(`🔄 [POLLING] Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            
            retryTimeoutRef.current = setTimeout(() => {
              fetchLocationWithRetry(attempt + 1);
            }, delay);
          } else {
            setIsRetrying(false);
            if (attempt >= MAX_RETRIES) {
              setApiError(`${errorMsg} - Max retries reached. Please check your connection.`);
              setPollingStatus('Failed to fetch location - max retries reached');
              
              // Show final error alert after max retries
              setRetryCallback(() => {
                // Reset and retry
                setRetryCount(0);
                isFetching = false; // Reset before retry
                fetchLocationWithRetry(0);
              });
              setShowConnectionFailedModal(true);
            }
          }
        } finally {
          // PRODUCTION-READY: Always reset fetching flag, even on error
          // This prevents duplicate calls from being blocked
          isFetching = false;
        }
      };
      
      const fetchLocation = () => fetchLocationWithRetry(0);
      
      // Check if we already have coords from previous session
      const existingCoords = coordsRef.current;
      const existingLastUpdate = lastUpdateRef.current;
      
      if (existingCoords) {
        // Restore existing coords and status immediately
        setCoords(existingCoords);
        setLastUpdate(existingLastUpdate);
        const secondsAgo = existingLastUpdate > 0 ? Math.floor((Date.now() - existingLastUpdate) / 1000) : 0;
        setPollingStatus(`Resuming tracking... (last seen ${secondsAgo}s ago)`);
        setIsPolling(true);
        console.log('🔄 [POLLING] Resuming with existing coords:', existingCoords);
        // Map will update automatically via useEffect when coords state changes
      } else {
        // No existing coords, start fresh
        setPollingStatus('Starting polling...');
        setIsPolling(true);
        console.log('🆕 [POLLING] Starting fresh polling');
      }
      
      // Start fetching immediately
      fetchLocation();
      // Poll every 10 seconds continuously (whether valet is moving or not)
      // Optimized interval to reduce API calls while maintaining good tracking experience
      pollingIntervalRef.current = setInterval(fetchLocation, 10000);
      
      console.log('✅ [POLLING] Started continuous polling for vehicle:', vehicleNumber);
      console.log('✅ [POLLING] Polling interval: Every 10 seconds (optimized for API efficiency)');
      console.log('✅ [POLLING] Polling will continue until screen loses focus');
      
      return () => {
        // Cleanup: stop polling when screen loses focus
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Clear retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        setIsRetrying(false);
        // NOTE: We intentionally DON'T clear coords or setIsPolling(false) here
        // so they persist when user navigates back
        console.log('⏸️ [POLLING] Stopped polling (screen unfocused) - coords preserved');
      };
    }, [vehicleInfo?.vehicleNumberFull, requestStatus?.vehicleNumber, isValetOnWay, vehicleRequestData?.requestStatus, requestStatus?.vehicleStatus, requestStatus?.requestStatus])
  );

  // Monitor valet location sharing status - detect if valet stops sharing (app closed/cleared)
  useEffect(() => {
    if (!isPolling || !lastUpdate) {
      setIsValetSharingLocation(false);
      setValetInactiveTime(0);
      return;
    }

    const checkValetActivity = () => {
      const now = Date.now();
      const timeSinceLastUpdate = Math.floor((now - lastUpdate) / 1000); // seconds
      setValetInactiveTime(timeSinceLastUpdate);

      // Background geolocation sends heartbeat every 60 seconds when stationary
      // So we allow up to 90 seconds before considering valet inactive
      // This accounts for: heartbeat interval (60s) + network delay + polling interval (10s)
      const INACTIVE_THRESHOLD = 90; // seconds
      const WARNING_THRESHOLD = 70; // seconds - show warning but still consider active
      
      // If no update for 90 seconds, valet likely stopped sharing
      // NOTE: Valet app uses background geolocation which continues even when force-killed
      // So if updates stop, it's likely due to: network issues, app force-stopped from Settings, or device issues
      if (timeSinceLastUpdate > INACTIVE_THRESHOLD) {
        setIsValetSharingLocation(false);
        const minutes = Math.floor(timeSinceLastUpdate / 60);
        const seconds = timeSinceLastUpdate % 60;
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        setPollingStatus(`⚠️ Valet stopped sharing location (${timeStr} ago)`);
        console.warn('⚠️ [VALET_STATUS] Valet has stopped sharing location');
        console.warn('⚠️ [VALET_STATUS] Possible reasons: Network disconnected, app force-stopped from Settings, or device issues');
        console.warn('⚠️ [VALET_STATUS] NOTE: Valet location should continue even if app is removed from recent apps (background geolocation enabled)');
      } else if (timeSinceLastUpdate > WARNING_THRESHOLD) {
        // Warning threshold - 70 seconds (longer than heartbeat interval)
        setIsValetSharingLocation(true); // Still sharing but slow (may be stationary)
        setPollingStatus(`⚠️ Slow updates (${timeSinceLastUpdate}s since last - valet may be stationary)`);
      } else {
        setIsValetSharingLocation(true);
      }
    };

    // Check immediately
    checkValetActivity();

    // Check every 5 seconds
    valetInactiveCheckRef.current = setInterval(checkValetActivity, 5000);

    return () => {
      if (valetInactiveCheckRef.current) {
        clearInterval(valetInactiveCheckRef.current);
        valetInactiveCheckRef.current = null;
      }
    };
  }, [isPolling, lastUpdate]);

  const region = coords ? {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  };

  // Helper function to find closest point on route to valet GPS position
  // Uses Haversine distance for accurate road snapping
  const findClosestPointOnRoute = (
    valetLat: number,
    valetLng: number,
    routePath: Array<[number, number]>
  ): [number, number] => {
    if (!routePath || routePath.length === 0) {
      return [valetLat, valetLng];
    }
    
    // Haversine distance function for accurate geographic distance
    const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000; // Earth radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    
    let minDistance = Infinity;
    let closestPoint: [number, number] = routePath[0];
    let closestIndex = 0;
    
    // Find closest point on route using Haversine distance
    for (let i = 0; i < routePath.length; i++) {
      const point = routePath[i];
      const distance = haversineDistance(valetLat, valetLng, point[0], point[1]);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
        closestIndex = i;
      }
    }
    
    // If we're between two route points, interpolate for smoother positioning
    if (closestIndex > 0 && closestIndex < routePath.length - 1) {
      const prevPoint = routePath[closestIndex - 1];
      const nextPoint = routePath[closestIndex + 1];
      
      // Calculate distance to previous and next points
      const distToPrev = haversineDistance(valetLat, valetLng, prevPoint[0], prevPoint[1]);
      const distToNext = haversineDistance(valetLat, valetLng, nextPoint[0], nextPoint[1]);
      
      // If we're closer to the line segment between points, interpolate
      if (distToPrev < minDistance * 1.5 || distToNext < minDistance * 1.5) {
        // Use the closer of the two adjacent points
        if (distToPrev < distToNext) {
          return prevPoint;
        } else {
          return nextPoint;
        }
      }
    }
    
    return closestPoint;
  };

  // Helper function to find position along route path for smooth movement
  const findPositionAlongRoute = (
    gpsLat: number,
    gpsLng: number,
    routePath: Array<[number, number]>
  ): { lat: number; lng: number; segmentIndex: number; progress: number } => {
    if (!routePath || routePath.length === 0) {
      return { lat: gpsLat, lng: gpsLng, segmentIndex: 0, progress: 0 };
    }

    const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Find closest segment on route
    let closestSegmentIndex = 0;
    let minDistance = Infinity;
    let closestProgress = 0;

    for (let i = 0; i < routePath.length - 1; i++) {
      const [lat1, lng1] = routePath[i];
      const [lat2, lng2] = routePath[i + 1];
      
      // Calculate distance from GPS point to line segment
      const segDist = haversineDistance(lat1, lng1, lat2, lng2);
      if (segDist < 0.1) continue; // Skip very short segments
      
      const distToStart = haversineDistance(gpsLat, gpsLng, lat1, lng1);
      const distToEnd = haversineDistance(gpsLat, gpsLng, lat2, lng2);
      
      // Project point onto segment
      const t = Math.max(0, Math.min(1, 
        (distToStart * distToStart - distToEnd * distToEnd + segDist * segDist) / (2 * segDist * segDist)
      ));
      
      const projLat = lat1 + (lat2 - lat1) * t;
      const projLng = lng1 + (lng2 - lng1) * t;
      const distToSegment = haversineDistance(gpsLat, gpsLng, projLat, projLng);
      
      if (distToSegment < minDistance) {
        minDistance = distToSegment;
        closestSegmentIndex = i;
        closestProgress = t;
      }
    }

    // Interpolate position along the closest segment
    const [lat1, lng1] = routePath[closestSegmentIndex];
    const [lat2, lng2] = routePath[Math.min(closestSegmentIndex + 1, routePath.length - 1)];
    
    const smoothLat = lat1 + (lat2 - lat1) * closestProgress;
    const smoothLng = lng1 + (lng2 - lng1) * closestProgress;

    return {
      lat: smoothLat,
      lng: smoothLng,
      segmentIndex: closestSegmentIndex,
      progress: closestProgress
    };
  };

  // Calculate bearing between two points
  const calculateBearingBetweenPoints = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  // Calculate bearing (direction) from current position to next point on route
  // Always looks FORWARD along the polyline so car front faces direction of travel
  const calculateBearing = (
    currentLat: number,
    currentLng: number,
    routePath: Array<[number, number]>
  ): number => {
    if (!routePath || routePath.length < 2) {
      return 0; // Default to 0 degrees (north) if no route
    }

    // Find closest point index
    let closestIndex = 0;
    let minDistance = Infinity;
    
    const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    for (let i = 0; i < routePath.length; i++) {
      const point = routePath[i];
      const distance = haversineDistance(currentLat, currentLng, point[0], point[1]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    // Always look FORWARD along the route (never backward)
    // Look ahead 3-5 points for smoother direction (like Zepto)
    let lookAheadPoints = 3;
    let nextIndex = closestIndex + lookAheadPoints;
    
    // If we're near the end, use the last point
    if (nextIndex >= routePath.length) {
      nextIndex = routePath.length - 1;
    }
    
    // Ensure we're looking forward (nextIndex should be > closestIndex)
    if (nextIndex <= closestIndex) {
      // If we can't look forward, try looking at least 1 point ahead
      if (closestIndex < routePath.length - 1) {
        nextIndex = closestIndex + 1;
      } else {
        // At the very end, use the last segment direction
        if (routePath.length >= 2) {
          nextIndex = routePath.length - 1;
          closestIndex = routePath.length - 2;
        } else {
          return 0; // Can't determine direction
        }
      }
    }

    const [nextLat, nextLng] = routePath[nextIndex];
    
    // Calculate bearing from current position to forward point on route
    const dLng = (nextLng - currentLng) * Math.PI / 180;
    const lat1 = currentLat * Math.PI / 180;
    const lat2 = nextLat * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    
    // Normalize to 0-360 degrees
    return (bearing + 360) % 360;
  };

  // Calculate map region to show both valet and customer
  const mapRegion = useMemo(() => {
    const currentCoords = coords || coordsRef.current;
    const valetLat = currentCoords?.lat || customerLocation?.lat || 12.9716;
    const valetLng = currentCoords?.lng || customerLocation?.lng || 77.5946;
    const customerLat = customerLocation?.lat || dest?.latitude || valetLat;
    const customerLng = customerLocation?.lng || dest?.longitude || valetLng;

    // Calculate bounds
    const minLat = Math.min(valetLat, customerLat);
    const maxLat = Math.max(valetLat, customerLat);
    const minLng = Math.min(valetLng, customerLng);
    const maxLng = Math.max(valetLng, customerLng);

    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [coords, customerLocation, dest]);

  // Map is now using Google Maps - no initialization needed

  // ✅ Fetch route with caching for production performance
  useEffect(() => {
    const fetchAndSetRoute = async () => {
      const currentCoords = coords || coordsRef.current;
      if (currentCoords && customerLocation) {
        // Create cache key from coordinates (rounded to 4 decimals for ~11m precision)
        const cacheKey = `${currentCoords.lat.toFixed(4)},${currentCoords.lng.toFixed(4)}-${customerLocation.lat.toFixed(4)},${customerLocation.lng.toFixed(4)}`;
        
        // Check cache first
        const cached = routeCacheRef.current.get(cacheKey);
        const CACHE_DURATION = 60000; // 1 minute cache
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('✅ [ROUTE-CACHE] Using cached route');
          setRoutePath(cached.route);
          return;
        }
        
        console.log('🗺️ [ROUTE] Fetching route between valet and customer');
        const route = await fetchRoute(
          currentCoords.lat,
          currentCoords.lng,
          customerLocation.lat,
          customerLocation.lng
        );
        if (route && route.length > 0) {
          // Cache the route
          routeCacheRef.current.set(cacheKey, {
            route,
            timestamp: Date.now()
          });
          
          // Limit cache size to 10 entries
          if (routeCacheRef.current.size > 10) {
            const firstKey = routeCacheRef.current.keys().next().value;
            if (firstKey) {
              routeCacheRef.current.delete(firstKey);
            }
          }
          
          setRoutePath(route);
          console.log('✅ [ROUTE] Route path set and cached, points:', route.length);
          console.log('✅ [ROUTE] First point:', route[0]);
          console.log('✅ [ROUTE] Last point:', route[route.length - 1]);
          console.log('✅ [ROUTE] This is a ROAD ROUTE with', route.length, 'points (not a straight line)');
          
          // Route will be updated dynamically by the useEffect below (no page reload)
        } else {
          // Route fetch failed - clear route (no direct line fallback)
          setRoutePath([]);
          console.log('⚠️ [ROUTE] Route fetch failed - no route line will be shown');
        }
      } else {
        // Clear route if locations not available
        setRoutePath([]);
      }
    };
    
    fetchAndSetRoute();
  }, [coords, customerLocation]);

  // Route updates automatically via React re-renders when routePath changes

  // Update car rotation when route path or coordinates change (ALWAYS face polyline)
  useEffect(() => {
    if (coords && routePath.length > 2) {
      const bearing = calculateBearing(coords.lat, coords.lng, routePath);
      const adjustedRotation = (bearing + ROTATION_OFFSET) % 360;
      setCarRotation(adjustedRotation);
      console.log('🧭 [ROTATION] Updated from polyline route path:', bearing.toFixed(1), '° → adjusted:', adjustedRotation.toFixed(1), '°');
    }
  }, [routePath, coords]);

  // Initialize animated coords when coords first appear
  useEffect(() => {
    if (coords && !animatedCoords) {
      animatedLat.setValue(coords.lat);
      animatedLng.setValue(coords.lng);
      setAnimatedCoords({ lat: coords.lat, lng: coords.lng });
      console.log('✅ [ANIMATION] Initialized animated coords');
    }
  }, [coords]);

  // Update animated coordinates from animated values for smooth Zepto-like movement
  // Also update rotation continuously as car moves along polyline (like Zepto)
  useEffect(() => {
    let lastRotationUpdate = 0;
    const ROTATION_UPDATE_THROTTLE = 50; // Update rotation every 50ms for smooth but efficient updates
    
    const latListener = animatedLat.addListener(({ value }) => {
      setAnimatedCoords(prev => {
        const currentLng = prev?.lng ?? ((animatedLng as any)._value || 0);
        const newCoords = { lat: value, lng: currentLng };
        
        // Continuously update rotation based on current animated position along polyline
        // Throttle updates for performance (like Zepto does)
        const now = Date.now();
        if (routePath.length > 2 && value !== 0 && currentLng !== 0 && (now - lastRotationUpdate > ROTATION_UPDATE_THROTTLE)) {
          const bearing = calculateBearing(value, currentLng, routePath);
          const adjustedRotation = (bearing + ROTATION_OFFSET) % 360;
          setCarRotation(adjustedRotation);
          lastRotationUpdate = now;
        }
        
        return newCoords;
      });
    });
    
    const lngListener = animatedLng.addListener(({ value }) => {
      setAnimatedCoords(prev => {
        const currentLat = prev?.lat ?? ((animatedLat as any)._value || 0);
        const newCoords = { lat: currentLat, lng: value };
        
        // Continuously update rotation based on current animated position along polyline
        // Throttle updates for performance (like Zepto does)
        const now = Date.now();
        if (routePath.length > 2 && currentLat !== 0 && value !== 0 && (now - lastRotationUpdate > ROTATION_UPDATE_THROTTLE)) {
          const bearing = calculateBearing(currentLat, value, routePath);
          const adjustedRotation = (bearing + ROTATION_OFFSET) % 360;
          setCarRotation(adjustedRotation);
          lastRotationUpdate = now;
        }
        
        return newCoords;
      });
    });
    
    return () => {
      animatedLat.removeListener(latListener);
      animatedLng.removeListener(lngListener);
    };
  }, [routePath]);

  // Auto-follow valet location when coordinates change
  useEffect(() => {
    if (mapRef.current && autoFollow && coords) {
      try {
        mapRef.current.animateToRegion({
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      } catch (error) {
        console.warn('⚠️ [MAP] Error animating to region:', error);
      }
    }
  }, [coords, autoFollow]);

  // Check if valet has reached customer location and show popup
  useEffect(() => {
    if (!coords || !customerLocation || arrivalPopupShownRef.current) {
      return; // Don't check if no coords, no customer location, or popup already shown
    }

    const distanceMeters = haversineMeters(
      coords.lat,
      coords.lng,
      customerLocation.lat,
      customerLocation.lng
    );

    // Show popup when valet is within 30 meters of customer
    const ARRIVAL_DISTANCE_THRESHOLD = 30; // 30 meters

    if (distanceMeters <= ARRIVAL_DISTANCE_THRESHOLD) {
      arrivalPopupShownRef.current = true;
      setShowValetArrivedModal(true);
      console.log('🎉 [ARRIVAL] Valet reached customer location! Distance:', distanceMeters.toFixed(1), 'meters');
    }
  }, [coords, customerLocation]);

  // Reset arrival popup when screen is focused (for new tracking session)
  useFocusEffect(
    useCallback(() => {
      // Reset arrival popup flag when screen is focused (new tracking session)
      arrivalPopupShownRef.current = false;
    }, [])
  );


  return (
    <ErrorBoundary>
      <View style={styles.container}>
      {/* Network Status Banner */}
      {showNetworkBanner && (
        <Animated.View style={[styles.networkBanner, { opacity: fadeAnim }]}>
          <View style={styles.networkBannerContent}>
            <Text style={styles.networkBannerIcon}>⚠️</Text>
            <View style={styles.networkBannerTextContainer}>
              <Text style={styles.networkBannerTitle}>No Internet Connection</Text>
              <Text style={styles.networkBannerMessage}>
                {apiError || 'Please check your network settings and try again.'}
              </Text>
              {isRetrying && (
                <Text style={styles.networkBannerRetry}>
                  Retrying... ({retryCount}/3)
                </Text>
              )}
            </View>
            {!isRetrying && (
              <TouchableOpacity
                style={styles.networkBannerRetryButton}
                onPress={() => {
                  const vnum = vehicleInfo?.vehicleNumberFull || requestStatus?.vehicleNumber;
                  if (vnum) {
                    setRetryCount(0);
                    const fetchLocation = async () => {
                      try {
                        const baseUrl = config.apiBaseUrl.replace('/customer', '');
                        const fullUrl = `${baseUrl}/valet-location/${vnum.toUpperCase().trim()}`;
                        const response = await fetch(fullUrl, {
                          method: 'GET',
                          headers: { 'Content-Type': 'application/json' },
                        });
                        if (response.ok) {
                          const data = await response.json();
                          if (data.success && data.data) {
                            setCoords({ lat: data.data.latitude, lng: data.data.longitude });
                            setLastUpdate(Date.now());
                            setShowNetworkBanner(false);
                            setApiError(null);
                          }
                        }
                      } catch (error) {
                        console.error('❌ [NETWORK] Manual retry failed:', error);
                      }
                    };
                    fetchLocation();
                  }
                }}
              >
                <Text style={styles.networkBannerRetryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
            {isRetrying && (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 8 }} />
            )}
          </View>
        </Animated.View>
      )}
      
      {/* Valet Inactive Warning Banner - appears below network banner */}
      {isPolling && !isValetSharingLocation && valetInactiveTime > 90 && (
        <Animated.View style={[
          styles.valetInactiveBanner, 
          { 
            opacity: fadeAnim,
            top: showNetworkBanner ? (Platform.OS === 'ios' ? 140 : 120) : (Platform.OS === 'ios' ? 60 : 40)
          }
        ]}>
          <View style={styles.valetInactiveBannerContent}>
            <Text style={styles.valetInactiveBannerIcon}>⚠️</Text>
            <View style={styles.valetInactiveBannerTextContainer}>
              <Text style={styles.valetInactiveBannerTitle}>Valet Stopped Sharing Location</Text>
              <Text style={styles.valetInactiveBannerMessage}>
                No location updates for {Math.floor(valetInactiveTime / 60)}m {valetInactiveTime % 60}s. 
                {'\n'}NOTE: Valet location should continue even if app is removed from recent apps.
                {'\n'}Possible reasons: Network disconnected, app force-stopped from Settings, or device issues.
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
      
      <View style={styles.map}>
        {showMap && (coords || customerLocation) ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1, width: '100%', height: '100%' }}
            initialRegion={mapRegion}
            region={autoFollow ? mapRegion : undefined}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={true}
            zoomEnabled={true}
            scrollEnabled={true}
            rotateEnabled={true}
            pitchEnabled={true}
            mapType="standard"
            onMapReady={() => {
              console.log('🗺️ TrackLive: Google Maps loaded successfully');
              setApiError(null);
              // Force map to show region after ready
              if (mapRef.current && mapRegion) {
                setTimeout(() => {
                  try {
                    mapRef.current?.animateToRegion(mapRegion, 500);
                  } catch (e) {
                    console.warn('⚠️ [MAP] Error setting region after ready:', e);
                  }
                }, 100);
              }
            }}
            onError={(error) => {
              console.error('❌ TrackLive: Map error:', error);
              const errorMessage = error?.message || 'Unknown error';
              if (errorMessage.includes('API key') || errorMessage.includes('API_KEY')) {
                setApiError('Google Maps API key error. Please check configuration.');
              } else {
                setApiError('Map failed to load. Please check your internet connection.');
              }
            }}
          >
            {/* Valet Marker - 3D Car like Uber */}
            {coords && (
              <Marker
                coordinate={{
                  latitude: (animatedCoords && animatedCoords.lat !== 0) ? animatedCoords.lat : coords.lat,
                  longitude: (animatedCoords && animatedCoords.lng !== 0) ? animatedCoords.lng : coords.lng,
                }}
                title="🚗 Valet"
                description={`Speed: ${speedKmh.toFixed(1)} km/h`}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={{ 
                  width: 60, 
                  height: 60,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {/* Shadow layer for 3D depth */}
                  <View style={{
                    position: 'absolute',
                    width: 45,
                    height: 20,
                    borderRadius: 45,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    bottom: -5,
                    transform: [{ scaleX: 1.2 }, { scaleY: 0.5 }],
                  }} />
                  
                  {/* 3D Car with perspective */}
                  <Animated.View style={{
                    width: 50,
                    height: 50,
                    transform: [
                      { rotate: `${carRotation}deg` },
                      { scale: 1.15 }, // Slight scale for depth effect
                    ],
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                    elevation: 10,
                  }}>
                    <Image
                      source={carImageUri.startsWith('http') || carImageUri.startsWith('file://') ? { uri: carImageUri } : mappingCarIcon}
                      style={{ 
                        width: 50, 
                        height: 50,
                      }}
                      resizeMode="contain"
                      onError={(error) => {
                        console.error('❌ [CAR_IMAGE] Failed to load car image:', carImageUri, error);
                        // Fallback to local asset if URL fails
                        if (carImageUri.startsWith('http') || carImageUri.startsWith('file://')) {
                          console.log('🔄 [CAR_IMAGE] Falling back to local asset');
                        }
                      }}
                      onLoad={() => {
                        console.log('✅ [CAR_IMAGE] Car image loaded successfully:', carImageUri);
                      }}
                    />
                  </Animated.View>
                  
                  {/* Highlight layer for 3D effect */}
                  <View style={{
                    position: 'absolute',
                    width: 30,
                    height: 15,
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    top: 5,
                    borderRadius: 10,
                    transform: [{ rotate: `${carRotation}deg` }],
                  }} />
                </View>
              </Marker>
            )}

            {/* Customer Marker */}
            {customerLocation && (
              <Marker
                coordinate={{
                  latitude: customerLocation.lat,
                  longitude: customerLocation.lng,
                }}
                title="📍 Your Location"
              />
            )}

            {/* Route Polyline */}
            {routePath.length > 2 && (
              <Polyline
                coordinates={routePath.map(([lat, lng]) => ({
                  latitude: lat,
                  longitude: lng,
                }))}
                strokeColor="#1E88E5"
                strokeWidth={8}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </MapView>
        ) : (
          // ✅ FIX #3: Better loading state with informative messages
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: pulseAnim }] }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#F0F4FF',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}>
                <ActivityIndicator size="large" color="#4285F4" />
              </View>
              <Text style={{ 
                fontSize: 18, 
                color: '#1F1B4E', 
                fontWeight: '700', 
                marginBottom: 8 
              }}>
                {'Loading live tracking map...'}
              </Text>
              <Text style={{ 
                fontSize: 14, 
                color: '#8E8E93', 
                textAlign: 'center', 
                paddingHorizontal: 40,
                lineHeight: 20
              }}>
                {!vehicleInfo?.vehicleNumberFull && !requestStatus?.vehicleNumber 
                  ? 'No vehicle assigned yet'
                  : !isValetOnWay && vehicleRequestData?.requestStatus !== 'ACCEPTED' && requestStatus?.vehicleStatus !== 'IN_TRANSIT' && requestStatus?.requestStatus !== 'ACCEPTED'
                    ? 'Waiting for valet to accept request...'
                    : !isPolling 
                      ? 'Connecting to tracking service...'
                      : coords
                        ? 'Initializing map view...'
                        : lastApiResponse?.status === 404
                          ? `Waiting for valet to start sharing location for vehicle: ${vehicleInfo?.vehicleNumberFull || requestStatus?.vehicleNumber || 'N/A'}. Make sure the valet app is running and has accepted the task.`
                          : 'Valet hasn\'t started sharing location yet. Map will appear once location is available.'
                }
              </Text>
              {apiError && (
                <Text style={{ 
                  fontSize: 13, 
                  color: '#EA4335', 
                  textAlign: 'center', 
                  paddingHorizontal: 40,
                  marginTop: 12,
                  fontWeight: '600'
                }}>
                  ⚠️ {apiError}
                </Text>
              )}
              {/* Always show polling status for debugging */}
              <Text style={{ 
                fontSize: 12, 
                color: '#8E8E93', 
                textAlign: 'center', 
                paddingHorizontal: 40,
                marginTop: 12
              }}>
                Status: {pollingStatus}
              </Text>
              {showDebug && lastApiResponse && (
                <View style={{ marginTop: 8, paddingHorizontal: 40 }}>
                  <Text style={{ fontSize: 11, color: '#8E8E93' }}>
                    Last Response: {JSON.stringify(lastApiResponse).substring(0, 150)}...
                  </Text>
                </View>
              )}
              {!vehicleInfo?.vehicleNumberFull && !requestStatus?.vehicleNumber && (
                <TouchableOpacity 
                  style={{ 
                    backgroundColor: '#4285F4', 
                    paddingHorizontal: 24, 
                    paddingVertical: 14, 
                    borderRadius: 25, 
                    marginTop: 24,
                    shadowColor: '#4285F4',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
                    Go Back
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        )}
      </View>

      {/* Info Bar */}
      <Animated.View style={[styles.infoBar, { opacity: fadeAnim }]}>
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Text style={styles.infoIcon}>⚡</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Speed</Text>
            <Text style={styles.infoValue}>{speedKmh.toFixed(1)} <Text style={styles.infoUnit}>km/h</Text></Text>
          </View>
        </View>
        
        <View style={styles.infoDivider} />
        
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Text style={styles.infoIcon}>📍</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>
              {(() => {
                if (!coords || !customerLocation) return '—';
                
                // If we have a route path, calculate remaining route distance
                if (routePath.length > 0) {
                  const remainingRouteDistance = calculateRemainingRouteDistance(
                    coords.lat,
                    coords.lng,
                    customerLocation.lat,
                    customerLocation.lng,
                    routePath
                  );
                  return remainingRouteDistance > 0 
                    ? (remainingRouteDistance / 1000).toFixed(2)
                    : '0.00';
                }
                
                // Fallback to straight-line distance if no route
                return (haversineMeters(coords.lat, coords.lng, customerLocation.lat, customerLocation.lng) / 1000).toFixed(2);
              })()} <Text style={styles.infoUnit}>km</Text>
            </Text>
          </View>
        </View>
        
        <View style={styles.infoDivider} />
        
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Text style={styles.infoIcon}>⏱️</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>ETA</Text>
            <Text style={styles.infoValue}>{formatEta(routePoints, customerLocation ? { latitude: customerLocation.lat, longitude: customerLocation.lng } : null, coords, routePath)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backBtn} 
        onPress={() => {
          console.log('🔙 TrackLive: Back button pressed, navigating back');
          navigation.goBack();
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      
      {/* Locate Me Button - Centers map on customer location */}
      <TouchableOpacity 
        style={styles.locateMeBtn} 
        onPress={() => {
          if (mapRef.current) {
            const locationToUse = customerLocation || coords || { lat: 12.9716, lng: 77.5946 };
            console.log('📍 [LOCATE] Centering map on location:', locationToUse);
            try {
              mapRef.current.animateToRegion({
                latitude: locationToUse.lat,
                longitude: locationToUse.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 500);
            } catch (error) {
              console.warn('⚠️ [MAP] Error centering map:', error);
            }
          }
        }}
        activeOpacity={0.7}
      >
        <Image 
          source={gupioLocationIcon} 
          style={styles.locateMeIcon}
          resizeMode="cover"
        />
      </TouchableOpacity>
      
      {/* Debug Toggle */}
      <TouchableOpacity 
        style={styles.debugToggleBtn} 
        onPress={() => setShowDebug(!showDebug)}
      >
        <Text style={styles.debugToggleBtnText}>
          {showDebug ? '✖' : 'ℹ️'}
        </Text>
      </TouchableOpacity>
      
      {/* Debug Overlay */}
      {showDebug && (
        <Animated.View style={[styles.debugOverlay, { opacity: fadeAnim }]}>
          <Text style={[styles.debugText, { color: '#4CAF50', fontWeight: 'bold', marginBottom: 16, fontSize: 16 }]}>
            📍 Tracking Information
          </Text>
          
          {/* Vehicle Number */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.debugText, { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Vehicle Number
            </Text>
            <Text style={[styles.debugText, { fontSize: 18, fontWeight: '700', color: '#FFFFFF' }]}>
              {vehicleInfo?.vehicleNumberFull || requestStatus?.vehicleNumber || 'Not assigned'}
            </Text>
          </View>

          {/* Connection Status */}
          <View>
            <Text style={[styles.debugText, { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Connection Status
            </Text>
            <Text style={[styles.debugText, { fontSize: 16, fontWeight: '600', color: isPolling && coords ? '#4CAF50' : lastApiResponse?.status === 404 ? '#FFA500' : '#4285F4' }]}>
              {isPolling && coords ? '✅ Connected' : lastApiResponse?.status === 404 ? '⏳ Waiting for valet' : '🔄 Connecting...'}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>

      {/* No Internet Connection Modal */}
      <ReusableModal
        visible={showNoInternetModal}
        onClose={() => setShowNoInternetModal(false)}
        title="No Internet Connection"
        subtitle="Please check your internet connection and try again."
        iconType="question"
        primaryButton={{
          text: 'Retry',
          onPress: () => {
            setShowNoInternetModal(false);
            if (retryCallback) {
              retryCallback();
            }
          },
        }}
        secondaryButton={{
          text: 'Cancel',
          onPress: () => setShowNoInternetModal(false),
        }}
      />

      {/* Server Error Modal */}
      <ReusableModal
        visible={showServerErrorModal}
        onClose={() => setShowServerErrorModal(false)}
        title={errorModalTitle}
        subtitle={errorModalMessage}
        iconType="question"
        primaryButton={{
          text: 'Retry',
          onPress: () => {
            setShowServerErrorModal(false);
            if (retryCallback) {
              retryCallback();
            }
          },
        }}
        secondaryButton={{
          text: 'Cancel',
          onPress: () => setShowServerErrorModal(false),
        }}
      />

      {/* Request Error Modal */}
      <ReusableModal
        visible={showRequestErrorModal}
        onClose={() => setShowRequestErrorModal(false)}
        title={errorModalTitle}
        subtitle={errorModalMessage}
        iconType="question"
        primaryButton={{
          text: 'Retry',
          onPress: () => {
            setShowRequestErrorModal(false);
            if (retryCallback) {
              retryCallback();
            }
          },
        }}
        secondaryButton={{
          text: 'Cancel',
          onPress: () => setShowRequestErrorModal(false),
        }}
      />

      {/* Generic Error Modal */}
      <ReusableModal
        visible={showGenericErrorModal}
        onClose={() => setShowGenericErrorModal(false)}
        title={errorModalTitle}
        subtitle={errorModalMessage}
        iconType="question"
        primaryButton={{
          text: 'Retry',
          onPress: () => {
            setShowGenericErrorModal(false);
            if (retryCallback) {
              retryCallback();
            }
          },
        }}
        secondaryButton={{
          text: 'Cancel',
          onPress: () => setShowGenericErrorModal(false),
        }}
      />

      {/* Connection Failed Modal */}
      <ReusableModal
        visible={showConnectionFailedModal}
        onClose={() => setShowConnectionFailedModal(false)}
        title="Connection Failed"
        subtitle="Unable to connect after multiple attempts. Please check your internet connection and try again."
        iconType="question"
        primaryButton={{
          text: 'Try Again',
          onPress: () => {
            setShowConnectionFailedModal(false);
            if (retryCallback) {
              retryCallback();
            }
          },
        }}
        secondaryButton={{
          text: 'Cancel',
          onPress: () => setShowConnectionFailedModal(false),
        }}
      />

      {/* Valet Arrived Modal */}
      <ReusableModal
        visible={showValetArrivedModal}
        onClose={() => setShowValetArrivedModal(false)}
        title="🎉 Valet Arrived!"
        subtitle="The valet has reached your location! Have a great day! 🚗✨"
        iconType="success"
        buttonText="OK"
        onButtonPress={() => setShowValetArrivedModal(false)}
      />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  map: { 
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA' // Fallback background color
  },
  infoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000435',
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 22,
  },
  infoContent: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoUnit: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  infoDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  backArrow: { 
    fontSize: 26,
    color: '#1F1B4E',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  locateMeBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 220 : 200, // Positioned above info bar
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000435',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 1001, // Higher than info bar
    borderWidth: 0,
    overflow: 'hidden', // Clip content to circle
    padding: 2, // Small padding to prevent edge clipping
  },
  locateMeIcon: {
    width: 46,
    height: 46,
    marginTop: 7,
    marginLeft: 3,
    // borderRadius removed - button handles clipping
  },
  debugToggleBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  debugToggleBtnText: {
    fontSize: 18,
  },
  debugOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(31, 27, 78, 0.95)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  networkBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: '#EA4335',
    borderRadius: 12,
    padding: 16,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  networkBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  networkBannerTextContainer: {
    flex: 1,
  },
  networkBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  networkBannerMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  networkBannerRetry: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  networkBannerRetryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  networkBannerRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  valetInactiveBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  valetInactiveBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valetInactiveBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  valetInactiveBannerTextContainer: {
    flex: 1,
  },
  valetInactiveBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  valetInactiveBannerMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
});

// Helper functions
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function totalDistanceMeters(points: Array<{ latitude: number; longitude: number }>): number {
  let d = 0;
  const MIN_DISTANCE = 10;
  
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1];
    const b = points[i];
    const segmentDist = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    
    if (segmentDist >= MIN_DISTANCE) {
      d += segmentDist;
    }
  }
  return d;
}

function averageSpeedKmh(points: Array<{ latitude: number; longitude: number; ts: number }>): number {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  const dt = Math.max(1, (last.ts - first.ts) / 1000);
  const d = totalDistanceMeters(points);
  const mps = d / dt;
  return mps * 3.6;
}

// Calculate remaining distance along route path
function calculateRemainingRouteDistance(
  currentLat: number,
  currentLng: number,
  destLat: number,
  destLng: number,
  routePath: Array<[number, number]>
): number {
  if (routePath.length === 0) {
    // Fallback to straight-line distance
    return haversineMeters(currentLat, currentLng, destLat, destLng);
  }
  
  // Find the closest point on route to current position
  let closestIndex = 0;
  let minDistance = Infinity;
  
  for (let i = 0; i < routePath.length; i++) {
    const [lat, lng] = routePath[i];
    const dist = haversineMeters(currentLat, currentLng, lat, lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }
  
  // Find the closest point to destination
  let destClosestIndex = routePath.length - 1;
  let destMinDistance = Infinity;
  
  for (let i = closestIndex; i < routePath.length; i++) {
    const [lat, lng] = routePath[i];
    const dist = haversineMeters(destLat, destLng, lat, lng);
    if (dist < destMinDistance) {
      destMinDistance = dist;
      destClosestIndex = i;
    }
  }
  
  // Calculate distance along route from current position to destination
  let totalDistance = 0;
  for (let i = closestIndex; i < destClosestIndex; i++) {
    const [lat1, lng1] = routePath[i];
    const [lat2, lng2] = routePath[i + 1];
    totalDistance += haversineMeters(lat1, lng1, lat2, lng2);
  }
  
  return totalDistance;
}

function formatEta(
  points: Array<{ latitude: number; longitude: number; ts: number }>, 
  dest: { latitude: number; longitude: number } | null,
  currentCoords?: { lat: number; lng: number } | null,
  routePath?: Array<[number, number]>
): string {
  if (!dest || points.length === 0) return '—';
  
  const last = points[points.length - 1];
  
  // Use route distance if available, otherwise straight-line
  let remainingMeters: number;
  if (currentCoords && routePath && routePath.length > 0) {
    remainingMeters = calculateRemainingRouteDistance(
      currentCoords.lat,
      currentCoords.lng,
      dest.latitude,
      dest.longitude,
      routePath
    );
  } else {
    remainingMeters = haversineMeters(last.latitude, last.longitude, dest.latitude, dest.longitude);
  }
  
  // Use current speed if available, otherwise calculate average
  const currentSpeed = points.length >= 2 
    ? averageSpeedKmh(points.slice(-10)) // Use last 10 points for more accurate speed
    : 0;
  
  const avgKmh = currentSpeed > 0 ? currentSpeed : Math.max(1, averageSpeedKmh(points));
  const hours = remainingMeters / 1000 / avgKmh;
  const mins = Math.round(hours * 60);
  
  if (mins <= 0) return '< 1 min';
  return `${mins} min`;
}

export default TrackLive;
