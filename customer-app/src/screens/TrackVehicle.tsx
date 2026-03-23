// TEMP: Error trigger for testing error boundary
const throwError = () => {
  throw new Error('Test error for ErrorBoundary');
};
{
  /* TEMP: Button to trigger error for testing ErrorBoundary */
}
<Button
  title="Trigger Error (Test)"
  onPress={throwError}
  containerStyle={{
    backgroundColor: '#EF0000',
    marginBottom: 16,
    borderRadius: 8,
  }}
  textStyle={{ color: '#fff', fontWeight: '700' }}
/>;
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import {
  StyleSheet,
  View,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useResponsive } from '../hooks/useResponsive';
import WaveLayout from '../components/CommonUI';
import Greeting from '../components/Greeting';
import VehicleInfoCard from '../components/VehicleInfoCard/VehicleInfoCard';
import PrimaryButton from '../components/PrimaryButton';
import Button from '../components/Button';
import CustomModal from '../components/CustomModal';
import CircularTimer from '../components/CircularTimer';
import InScreenDrawer from '../components/InScreenDrawer';
import ReusableModal from '../components/ReusableModal';
import { useDrawer } from '../components/DrawerProvider';
import { useVehicle } from '../context/VehicleContext';
import { useAuth } from '../context/AuthContext';
import { getRequestStatus, getVehicleRequestData } from '../services/authApi';
import { useNavigation } from '@react-navigation/native';
// import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import createSocket from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
// hii
const logo = require('../assets/logo.png');
const carLogo = require('../assets/carLogo.png');
const callLogo = require('../assets/PhoneOutgoing.png');

const TOTAL_TIME = 15 * 60; // 15 min
const TIMER_START_TIME_KEY = '@vehicle_timer_start_time';

const hamburgerIcon = require('../assets/humberger.png'); // Add a hamburger icon in your assets

const TrackVehicle: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  /* Modal states for replacing Alert messages */
  const [showVehicleDeliveredModal, setShowVehicleDeliveredModal] = useState(false);
  const [showPendingStatusModal, setShowPendingStatusModal] = useState(false);
  const [showPhoneUnavailableModal, setShowPhoneUnavailableModal] = useState(false);
  const [showInvalidPhoneModal, setShowInvalidPhoneModal] = useState(false);
  const [showDialerUnavailableModal, setShowDialerUnavailableModal] = useState(false);
  const [showUnableToOpenDialerModal, setShowUnableToOpenDialerModal] = useState(false);
  const [showUnableToMakeCallModal, setShowUnableToMakeCallModal] = useState(false);
  const [phoneNumberForManualDial, setPhoneNumberForManualDial] = useState('');
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('TrackVehicle');
  const { drawerOpen, openDrawer, closeDrawer, setDrawerOpen } = useDrawer();
  const { token, customer } = useAuth();
  const navigation = useNavigation();
  const {
    vehicleInfo,
    requestStatus,
    vehicleRequestData,
    updateRequestStatus,
    updateVehicleRequestData,
    isRequestPending,
    isValetOnWay,
    isDeliveryComplete
  } = useVehicle();
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleCoords, setVehicleCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isValetSharingLocation, setIsValetSharingLocation] = useState<boolean>(false);
  const [valetInactiveTime, setValetInactiveTime] = useState<number>(0); // seconds since last update
  const [lastSocketUpdate, setLastSocketUpdate] = useState<number>(0);
  const socketRef = useRef<any>(null);
  const valetInactiveCheckRef = useRef<any>(null);

  // Timer state - persist across modal open/close and app restarts
  const timerStartTimeRef = useRef<number | null>(null);
  const [timerTimeLeft, setTimerTimeLeft] = useState<number>(TOTAL_TIME);

  // Load timer start time from AsyncStorage on mount
  useEffect(() => {
    const loadTimerStartTime = async () => {
      try {
        const storedStartTime = await AsyncStorage.getItem(TIMER_START_TIME_KEY);
        if (storedStartTime) {
          const startTime = parseInt(storedStartTime, 10);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, TOTAL_TIME - elapsed);

          if (remaining > 0) {
            // Timer is still valid, restore it
            timerStartTimeRef.current = startTime;
            setTimerTimeLeft(remaining);
          } else {
            // Timer has expired, clear it
            await AsyncStorage.removeItem(TIMER_START_TIME_KEY);
            timerStartTimeRef.current = null;
            setTimerTimeLeft(0);
          }
        }
      } catch (error) {
        console.error('Error loading timer start time:', error);
      }
    };

    loadTimerStartTime();
  }, []);

  // Initialize timer when valet accepts the request
  useEffect(() => {
    if ((isValetOnWay || vehicleRequestData?.requestStatus === 'ACCEPTED') && !timerStartTimeRef.current) {
      // Start timer when request is accepted
      const startTime = Date.now();
      timerStartTimeRef.current = startTime;
      setTimerTimeLeft(TOTAL_TIME);

      // Store start time in AsyncStorage for persistence
      AsyncStorage.setItem(TIMER_START_TIME_KEY, startTime.toString()).catch(error => {
        console.error('Error saving timer start time:', error);
      });
    }
  }, [isValetOnWay, vehicleRequestData?.requestStatus]);

  // Clear timer when request is completed, cancelled, or rejected
  useEffect(() => {
    const shouldClearTimer =
      vehicleRequestData?.requestStatus === 'COMPLETED' ||
      vehicleRequestData?.requestStatus === 'RETURNED' ||
      vehicleRequestData?.requestStatus === 'CANCELLED' ||
      vehicleRequestData?.requestStatus === 'REJECTED' ||
      isDeliveryComplete;

    if (shouldClearTimer && timerStartTimeRef.current) {
      timerStartTimeRef.current = null;
      setTimerTimeLeft(TOTAL_TIME);
      AsyncStorage.removeItem(TIMER_START_TIME_KEY).catch(error => {
        console.error('Error clearing timer start time:', error);
      });
    }
  }, [vehicleRequestData?.requestStatus, isDeliveryComplete]);

  // Update timer every second - calculate remaining time based on start time
  useEffect(() => {
    if (!timerStartTimeRef.current) return;

    const updateTimer = () => {
      if (!timerStartTimeRef.current) return;

      const elapsed = Math.floor((Date.now() - timerStartTimeRef.current) / 1000);
      const remaining = Math.max(0, TOTAL_TIME - elapsed);
      setTimerTimeLeft(remaining);

      if (remaining === 0) {
        // Timer completed, clear stored start time
        timerStartTimeRef.current = null;
        AsyncStorage.removeItem(TIMER_START_TIME_KEY).catch(error => {
          console.error('Error clearing timer start time:', error);
        });
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isValetOnWay, vehicleRequestData?.requestStatus]); // Re-run when valet status changes

  // Responsive design
  const { screenHeight } = useResponsive();

  // Detect resolution based on screen height
  const getResolution = () => {
    if (screenHeight <= 600) return '480p'; // 480p: height <= 600
    if (screenHeight <= 800) return '720p'; // 720p: height <= 800
    if (screenHeight <= 1200) return '1080p'; // 1080p: height <= 1200
    return '1440p'; // 1440p: height > 1200
  };

  const resolution = getResolution();
  const is480p = resolution === '480p';
  const is720p = resolution === '720p';
  const is1080p = resolution === '1080p';
  const is1440p = resolution === '1440p';

  /* Helper function to format acceptance time */
  const formatAcceptanceTime = useCallback((dateString: string | undefined): string => {
    if (!dateString) return 'Not scheduled';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting acceptance time:', error);
      return 'Not scheduled';
    }
  }, []);

  /* Get pickup time - only show when request is ACCEPTED or COMPLETED */
  const getPickupTime = useCallback((): string => {
    // Only show pickup time when request is ACCEPTED or COMPLETED
    if (vehicleRequestData?.requestStatus === 'ACCEPTED') {
      // When request is ACCEPTED, show the acceptance time (when valet accepted the request)
      return formatAcceptanceTime(vehicleRequestData.updatedAt);
    }

    // For COMPLETED status, show the actual pickup time if available
    if (vehicleRequestData?.requestStatus === 'COMPLETED') {
      if (vehicleRequestData?.pickupInfo?.pickupTime) {
        return vehicleRequestData.pickupInfo.pickupTime;
      }
      // Fallback to vehicleInfo time if available
      if (vehicleInfo?.pickupTime) {
        return vehicleInfo.pickupTime;
      }
    }

    // For PENDING or any other status, show "Not scheduled"
    return 'Not scheduled';
  }, [vehicleRequestData?.requestStatus, vehicleRequestData?.updatedAt, vehicleRequestData?.pickupInfo?.pickupTime, vehicleInfo?.pickupTime, formatAcceptanceTime]);

  // Refresh vehicle request data periodically
  useEffect(() => {
    const refreshVehicleData = async () => {
      if (!token) return;

      try {
        setRefreshing(true);
        const vehicleDataResponse = await getVehicleRequestData(undefined, token);
        if (vehicleDataResponse.success && vehicleDataResponse.data) {
          console.log('🔄 TrackVehicle: Refreshed vehicle request data:', vehicleDataResponse.data);
          updateVehicleRequestData(vehicleDataResponse.data);

          // Note: Success modal will be shown by the Home screen
          // This screen will just update the UI to show "Vehicle Delivered" status
        }
      } catch (error: any) {
        // Handle rate limiting gracefully - don't show as error
        const errorMessage = error?.message || error?.toString() || '';
        const isRateLimit = errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('rate limited') ||
          errorMessage.toLowerCase().includes('too many requests') ||
          error?.status === 429;

        if (isRateLimit) {
          console.warn('⚠️ TrackVehicle: Rate limited - will retry later');
          // Don't log as error, just skip this update
        } else {
          // Only log actual errors (not rate limits)
          console.error('🔄 TrackVehicle: Error refreshing vehicle data:', error);
        }
      } finally {
        setRefreshing(false);
      }
    };

    // Refresh immediately
    refreshVehicleData();

    // Increased to 15 seconds to avoid rate limiting (was 10s)
    const interval = setInterval(refreshVehicleData, 15000);

    return () => clearInterval(interval);
  }, [token, updateVehicleRequestData, isDeliveryComplete]);

  // Show success modal when delivery is complete
  useEffect(() => {
    if (isDeliveryComplete) {
      setShowSuccessModal(true);
      // Auto-navigate to Home after 3 seconds
      const timeout = setTimeout(() => {
        setShowSuccessModal(false);
        updateRequestStatus({
          hasRequest: false,
          requestStatus: undefined,
          message: undefined
        });
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' as never }],
        });
      }, 3000);
      return () => clearTimeout(timeout);
    } else {
      setShowSuccessModal(false);
    }
  }, [isDeliveryComplete, navigation, updateRequestStatus]);

  // Socket live tracking subscription - ONLY start after valet accepts
  useEffect(() => {
    const vnum = vehicleInfo?.vehicleNumberFull || requestStatus?.vehicleNumber;
    if (!vnum) {
      console.log('⏳ TrackVehicle: No vehicle number - socket not started');
      return;
    }

    // Check if valet has accepted the request
    const hasValetAccepted = isValetOnWay ||
      vehicleRequestData?.requestStatus === 'ACCEPTED' ||
      requestStatus?.vehicleStatus === 'IN_TRANSIT' ||
      requestStatus?.requestStatus === 'ACCEPTED';

    if (!hasValetAccepted) {
      console.log('⏳ TrackVehicle: Valet has not accepted yet - socket not started');
      // Disconnect any existing socket
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
          socketRef.current = null;
        } catch (e) {
          console.log('Socket disconnect error (non-fatal):', e);
        }
      }
      return;
    }

    console.log('✅ TrackVehicle: Valet has accepted - starting socket connection process');
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const socket = createSocket();
      socketRef.current = socket;
      const roomVehicle = String(vnum).toUpperCase();

      socket.on('connect', () => {
        const transport = socket.io?.engine?.transport?.name || 'unknown';
        console.log(`✅ TrackVehicle: Socket connected! [ID: ${socket.id}] [Transport: ${transport}]`);

        // Join room AFTER connection is established
        socket.emit('join', { role: 'customer', vehicleNumber: roomVehicle });
        console.log('📡 TrackVehicle: Join request sent for vehicle room:', roomVehicle);
      });

      socket.on('connect_error', (err: any) => {
        console.error('❌ TrackVehicle: Socket connection error details:', {
          message: err.message,
          type: err.type,
          description: err.description,
          context: err.context
        });

        // If it's a transport error, it might be logged as "xhr poll error" but now with websocket as primary
        if (err.message === 'xhr poll error') {
          console.log('⚠️ TrackVehicle: Falling back or retrying due to transport error...');
        }
      });

      socket.on('reconnect_attempt', (attempt: number) => {
        console.log(`🔄 TrackVehicle: Socket reconnection attempt #${attempt}`);
      });

      socket.on('reconnect', (attempt: number) => {
        console.log(`✅ TrackVehicle: Socket reconnected after ${attempt} attempts`);
        socket.emit('join', { role: 'customer', vehicleNumber: roomVehicle });
      });

      // Listen for valet location updates
      socket.on('vehicle:location', (payload: any) => {
        if ((payload?.vehicleNumber || '').toUpperCase() !== roomVehicle) {
          console.log('⚠️ TrackVehicle: Ignoring location for different vehicle:', payload?.vehicleNumber);
          return;
        }

        if (typeof payload?.latitude === 'number' && typeof payload?.longitude === 'number') {
          console.log(`📍 TrackVehicle: Received location for ${roomVehicle}: ${payload.latitude}, ${payload.longitude}`);
          const now = Date.now();
          setVehicleCoords({ lat: payload.latitude, lng: payload.longitude });
          setLastSocketUpdate(now);
          setIsValetSharingLocation(true);
          setValetInactiveTime(0);
        } else {
          console.warn('❌ TrackVehicle: Received malformed location payload:', payload);
        }
      });

      socket.on('disconnect', (reason: string) => {
        console.log('❌ TrackVehicle: Socket disconnected. Reason:', reason);
        if (reason === 'io server disconnect') {
          // the disconnection was initiated by the server, you need to reconnect manually
          socket.connect();
        }
      });

    } catch (e) {
      console.error('❌ TrackVehicle: Failed to initialize socket:', e);
    }

    return () => {
      if (socketRef.current) {
        console.log('🧹 TrackVehicle: Cleaning up socket on unmount');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [vehicleInfo?.vehicleNumberFull, requestStatus?.vehicleNumber, isValetOnWay, vehicleRequestData?.requestStatus, requestStatus?.vehicleStatus, requestStatus?.requestStatus]);

  // Monitor valet location sharing status via socket - detect if valet stops sharing (app closed/cleared)
  useEffect(() => {
    if (!lastSocketUpdate || !isValetOnWay) {
      setIsValetSharingLocation(false);
      setValetInactiveTime(0);
      return;
    }

    const checkValetActivity = () => {
      const now = Date.now();
      const timeSinceLastUpdate = Math.floor((now - lastSocketUpdate) / 1000); // seconds
      setValetInactiveTime(timeSinceLastUpdate);

      // Background geolocation sends heartbeat every 60 seconds when stationary
      // So we allow up to 90 seconds before considering valet inactive
      // This accounts for: heartbeat interval (60s) + network delay + socket reconnection
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
        console.warn('⚠️ [VALET_STATUS] Valet has stopped sharing location via socket');
        console.warn('⚠️ [VALET_STATUS] Possible reasons: Network disconnected, app force-stopped from Settings, or device issues');
        console.warn('⚠️ [VALET_STATUS] NOTE: Valet location should continue even if app is removed from recent apps (background geolocation enabled)');
      } else if (timeSinceLastUpdate > WARNING_THRESHOLD) {
        // Warning threshold - 70 seconds (longer than heartbeat interval)
        setIsValetSharingLocation(true); // Still sharing but slow (may be stationary)
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
  }, [lastSocketUpdate, isValetOnWay]);

  if (error) return ErrorBoundaryUI;
  return (
    <ErrorBoundary>
      {/* Valet Inactive Warning Banner */}
      {isValetOnWay && !isValetSharingLocation && valetInactiveTime > 30 && (
        <View style={styles.valetInactiveBanner}>
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
        </View>
      )}
      <InScreenDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        setDrawerOpen={setDrawerOpen}
      />
      <WaveLayout
        waveSectionStyle={StyleSheet.flatten([
          {
            width: '100%' as const,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
          },
          is480p && { minHeight: hp('30%') },
          is720p && { minHeight: hp('30%') },
          is1080p && { minHeight: hp('30%') },
          is1440p && { minHeight: hp('30%') },
        ].filter(Boolean))}
        topContent={
          <View style={StyleSheet.flatten([
            {
              flex: 1,
              width: '100%' as const,
              position: 'relative' as const,
            },
          ])}>
            {/* Left Hamburger Icon - Absolute positioned at top left */}
            <TouchableOpacity
              style={StyleSheet.flatten([
                {
                  position: 'absolute' as const,
                  top: 0,
                  left: 0,
                  zIndex: 10,
                  justifyContent: 'center' as const,
                  alignItems: 'center' as const,
                },
                is480p && {
                  width: wp('9%'),
                  height: hp('5%'),
                  paddingLeft: wp('4%'),
                  paddingTop: hp('1%'),
                },
                is720p && {
                  width: wp('10%'),
                  height: hp('8%'),
                  paddingLeft: wp('5%'),
                  paddingTop: hp('1%'),
                },
                is1080p && {
                  width: wp('12%'),
                  height: hp('12%'),
                  paddingLeft: wp('5%'),
                  marginTop: Platform.OS === 'ios' ? hp('1%') : hp('-3%'),
                  // paddingTop: Platform.OS === 'ios' ? hp('1%') : hp('-10%'),
                },
                is1440p && {
                  width: 30,
                  height: 30,
                  paddingLeft: wp('5%'),
                  paddingTop: hp('1%'),
                },
              ].filter(Boolean))}
              onPress={openDrawer}
            >
              <Image
                source={hamburgerIcon}
                style={StyleSheet.flatten([
                  {
                    width: '100%' as const,
                    height: '100%' as const,
                  },
                ])}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* Center Logo */}
            <View style={StyleSheet.flatten([
              {
                flex: 1,
                justifyContent: 'center' as const,
                alignItems: 'center' as const,
                width: '100%' as const,
              },
            ])}>
              <Image
                source={logo}
                style={StyleSheet.flatten([
                  {
                    resizeMode: 'contain' as const,
                  },
                  is480p && { width: wp('35%'), height: hp('4%') },
                  is720p && { width: wp('35%'), height: hp('4%') },
                  is1080p && { width: wp('35%'), height: hp('4%') },
                  is1440p && { width: wp('35%'), height: hp('4%') },
                ].filter(Boolean))}
                resizeMode="contain"
              />
            </View>
          </View>
        }
        topContainerStyle={StyleSheet.flatten([
          {
            flex: 1,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            width: '100%' as const,
            paddingHorizontal: 0,
            paddingTop: 0,
          },
        ])}
        topPlatformAdjust={StyleSheet.flatten([
          Platform.OS === 'ios'
            ? { paddingTop: 0 }
            : { paddingTop: 0 }
        ])}
        bottomContent={
          <View style={styles.bottomContent}>
            <Greeting name={customer?.fullName || "Customer"} />

            {/* Show vehicle info if available */}
            {(() => {
              // Only show vehicle info if the request is not completed
              const currentVehicleInfo = (vehicleRequestData?.requestStatus === 'COMPLETED')
                ? null
                : (vehicleRequestData?.vehicleInfo || vehicleInfo);
              const currentPickupInfo = vehicleRequestData?.pickupInfo;

              return currentVehicleInfo ? (
                <VehicleInfoCard
                  vehicleNumberFull={currentVehicleInfo.vehicleNumberFull}
                  vehicleNumberMasked={currentVehicleInfo.vehicleNumberMasked}
                  pickedBy={
                    (vehicleRequestData?.requestStatus === 'ACCEPTED' || vehicleRequestData?.requestStatus === 'COMPLETED')
                      ? (currentPickupInfo?.pickedBy || currentVehicleInfo.pickedBy || "Not assigned")
                      : "Not assigned"
                  }
                  pickupTime={getPickupTime()}
                  pickupLocation={
                    (vehicleRequestData?.requestStatus === 'ACCEPTED' || vehicleRequestData?.requestStatus === 'COMPLETED')
                      ? (currentPickupInfo?.pickupLocation || currentVehicleInfo.pickupLocation || "Not available")
                      : "Not available"
                  }
                />
              ) : (
                <VehicleInfoCard
                  vehicleNumberFull="No vehicle requested"
                  vehicleNumberMasked="No vehicle requested"
                  pickedBy="Not assigned"
                  pickupTime="Not scheduled"
                  pickupLocation="Not available"
                />
              );
            })()}


            {/* Dynamic button based on status */}
            <Button
              title={
                isDeliveryComplete
                  ? "Vehicle Delivered"
                  : isValetOnWay
                    ? "Valet is on the way"
                    : isRequestPending
                      ? "Request Pending"
                      : "Track Your Vehicle"
              }
              onPress={() => {
                console.log('Button pressed - isValetOnWay:', isValetOnWay, 'requestStatus:', requestStatus?.vehicleStatus);
                try {
                  if (isValetOnWay || requestStatus?.vehicleStatus === 'IN_TRANSIT') {
                    console.log('Opening modal...');
                    setOpen(true);
                  } else if (isDeliveryComplete) {
                    setShowVehicleDeliveredModal(true);
                  } else {
                    setShowPendingStatusModal(true);
                  }
                } catch (error) {
                  console.error('Error in button press:', error);
                }
              }}
              disabled={!isValetOnWay && !isDeliveryComplete}
              containerStyle={StyleSheet.flatten([
                {
                  backgroundColor: isValetOnWay ? '#FFBF00' : isDeliveryComplete ? '#11AC21' : '#FFBF00',
                  width: 'auto' as const,
                  alignSelf: 'center' as const,
                },
                is480p && {
                  borderRadius: hp('1%'),
                  paddingHorizontal: wp('8%'),
                  paddingVertical: hp('1.5%')
                },
                is720p && {
                  borderRadius: hp('1.2%'),
                  paddingHorizontal: wp('8%'),
                  paddingVertical: hp('1.5%')
                },
                is1080p && {
                  borderRadius: hp('1.3%'),
                  paddingHorizontal: wp('8%'),
                  paddingVertical: hp('1.5%')
                },
                is1440p && {
                  borderRadius: 10,
                  paddingHorizontal: 30,
                  paddingVertical: hp('1.5%')
                },
              ].filter(Boolean))}
              textStyle={StyleSheet.flatten([
                {
                  fontWeight: '600' as const,
                  color: isDeliveryComplete ? '#FFFFFF' : '#1F1B4E',
                },
                is480p && { fontSize: hp('1.5%') },
                is720p && { fontSize: hp('1.5%') },
                is1080p && { fontSize: hp('1.5%') },
                is1440p && { fontSize: 15 },
              ].filter(Boolean))}
            />

            <CustomModal
              isVisible={open}
              onClose={() => {
                console.log('Closing modal...');
                setOpen(false);
              }}
              width={is480p ? '55%' : is720p ? '55%' : is1080p ? '65%' : '70%'}
              modalContentStyle={{
                backgroundColor: '#F5F8FE',
                borderRadius: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.3%'),
                alignItems: 'center' as const,
                gap: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.5%'),
                justifyContent: 'center' as const,
              }}
              iosModalContentStyle={StyleSheet.flatten([
                {
                  shadowColor: '#000',
                  shadowOpacity: 0.2,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 },
                },
                is480p && { paddingHorizontal: wp('4%'), paddingVertical: hp('3%'), paddingTop: hp('4%') },
                is720p && { paddingHorizontal: wp('5%'), paddingVertical: hp('4%'), paddingTop: hp('5%') },
                is1080p && { paddingHorizontal: wp('5%'), paddingVertical: hp('4.5%'), paddingTop: hp('5.5%') },
                is1440p && { paddingHorizontal: wp('6%'), paddingVertical: hp('5%'), paddingTop: hp('6%') },
              ].filter(Boolean))}
              androidModalContentStyle={StyleSheet.flatten([
                {
                  elevation: 6,
                },
                is480p && { paddingHorizontal: wp('3%'), paddingVertical: hp('3%'), paddingTop: hp('3.5%') },
                is720p && { paddingHorizontal: wp('4%'), paddingVertical: hp('4%'), paddingTop: hp('3.5%') },
                is1080p && { paddingHorizontal: wp('4.5%'), paddingVertical: hp('4.5%'), paddingTop: hp('3.5%') },
                is1440p && { paddingHorizontal: wp('5%'), paddingVertical: hp('5%'), paddingTop: hp('4%') },
              ].filter(Boolean))}
              height="auto"
            >
              {/* Custom Title with two lines */}
              <View style={{ alignItems: 'center', marginBottom: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.5%') }}>
                <Text style={StyleSheet.flatten([
                  { color: '#3730A5', fontWeight: '700' as const, textAlign: 'center' as const },
                  is480p && { fontSize: hp('1.6%') },
                  is720p && { fontSize: hp('1.7%') },
                  is1080p && { fontSize: hp('1.8%') },
                  is1440p && { fontSize: hp('2%') },
                ].filter(Boolean))}>
                  Estimated time until vehicle
                </Text>
                <Text style={StyleSheet.flatten([
                  { color: '#3730A5', fontWeight: '700' as const, textAlign: 'center' as const },
                  is480p && { fontSize: hp('1.6%') },
                  is720p && { fontSize: hp('1.7%') },
                  is1080p && { fontSize: hp('1.8%') },
                  is1440p && { fontSize: hp('2%') },
                ].filter(Boolean))}>
                  returns
                </Text>
              </View>
              <CircularTimer
                totalTime={TOTAL_TIME}
                initialTimeLeft={timerTimeLeft}
                size={is480p ? 70 : is720p ? 75 : is1080p ? 100 : 110}
                strokeWidth={is480p ? 5 : is720p ? 6 : is1080p ? 7 : 8}
                progressColor="#00D160"
                trackColor="#E1E7FD"
                textStyle={StyleSheet.flatten([
                  {
                    color: '#3730A5',
                    fontWeight: '600' as const,
                  },
                  is480p && { fontSize: hp('2%') },
                  is720p && { fontSize: hp('2%') },
                  is1080p && { fontSize: hp('2.2%') },
                  is1440p && { fontSize: hp('2.2%') },
                ].filter(Boolean))}
                containerStyle={StyleSheet.flatten([
                  { alignSelf: 'center' as const },
                  is480p && { marginBottom: hp('1.5%') },
                  is720p && { marginBottom: hp('2%') },
                  is1080p && { marginBottom: hp('3%') },
                  is1440p && { marginBottom: hp('3.5%') },
                ].filter(Boolean))}
              />
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: is480p ? wp('3%') : is720p ? wp('3.5%') : is1080p ? wp('4%') : wp('4.5%') }}>
                <Button
                  title="Track Live"
                  onPress={() => navigation.navigate('TrackLive' as never)}
                  disabled={false}
                  containerStyle={StyleSheet.flatten([
                    {
                      backgroundColor: '#FFBF00',
                      width: 'auto' as const,
                      borderRadius: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.3%'),
                      alignSelf: 'center' as const,
                    },
                    is480p && { paddingHorizontal: wp('8%'), paddingVertical: hp('1.2%') },
                    is720p && { paddingHorizontal: wp('9%'), paddingVertical: hp('1.4%') },
                    is1080p && { paddingHorizontal: wp('10%'), paddingVertical: hp('1.6%') },
                    is1440p && { paddingHorizontal: wp('11%'), paddingVertical: hp('1.8%') },
                  ].filter(Boolean))}
                  textStyle={StyleSheet.flatten([
                    {
                      fontWeight: '600' as const,
                      color: '#1F1B4E',
                    },
                    is480p && { fontSize: hp('1.4%') },
                    is720p && { fontSize: hp('1.5%') },
                    is1080p && { fontSize: hp('1.6%') },
                    is1440p && { fontSize: hp('1.8%') },
                  ].filter(Boolean))}
                />
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    {
                      backgroundColor: '#1F1B4E',
                      justifyContent: 'center' as const,
                      alignItems: 'center' as const,
                      padding: is480p ? hp('0.6%') : is720p ? hp('0.7%') : is1080p ? hp('0.8%') : hp('0.9%'),
                    },
                    is480p && {
                      height: hp('4%'),
                      width: hp('4%'),
                      borderRadius: hp('2%'),
                    },
                    is720p && {
                      height: hp('4.5%'),
                      width: hp('4.5%'),
                      borderRadius: hp('2.25%'),
                    },
                    is1080p && {
                      height: hp('5%'),
                      width: hp('5%'),
                      borderRadius: hp('2.5%'),
                    },
                    is1440p && {
                      height: hp('5.5%'),
                      width: hp('5.5%'),
                      borderRadius: hp('2.75%'),
                    },
                  ].filter(Boolean))}
                  onPress={async () => {
                    // Get valet phone number from vehicleRequestData
                    const valetPhone = vehicleRequestData?.pickupInfo?.valetPhone;

                    if (!valetPhone || valetPhone === 'N/A') {
                      setShowPhoneUnavailableModal(true);
                      return;
                    }

                    try {
                      // Clean phone number - remove spaces, dashes, parentheses, etc.
                      // Keep only digits and + sign for international numbers
                      let cleanPhone = valetPhone.replace(/[\s\-()]/g, '');

                      // If phone doesn't start with +, ensure it's properly formatted
                      // For Indian numbers, if it starts with 0, remove it
                      if (cleanPhone.startsWith('0')) {
                        cleanPhone = cleanPhone.substring(1);
                      }

                      // Ensure phone number is not empty
                      if (!cleanPhone || cleanPhone.length < 10) {
                        setShowInvalidPhoneModal(true);
                        return;
                      }

                      // Create tel: URL
                      const phoneUrl = `tel:${cleanPhone}`;

                      // Try to open the dialer directly
                      // Note: canOpenURL can be unreliable on physical devices, so we try to open directly
                      // and handle errors gracefully
                      try {
                        await Linking.openURL(phoneUrl);
                      } catch (openError: any) {
                        // If direct open fails, check if it's a capability issue
                        const errorMessage = openError?.message || openError?.toString() || 'Unknown error';
                        console.error('Error opening phone dialer:', openError);

                        // Check if it's a permission or capability issue
                        if (
                          errorMessage.includes('No Activity found') ||
                          errorMessage.includes('No app') ||
                          errorMessage.includes('ActivityNotFoundException') ||
                          errorMessage.includes('not found')
                        ) {
                          setShowDialerUnavailableModal(true);
                        } else {
                          // For other errors, show the phone number so user can dial manually
                          setPhoneNumberForManualDial(cleanPhone);
                          setShowUnableToOpenDialerModal(true);
                        }
                      }
                    } catch (error: any) {
                      console.error('Error processing phone number:', error);
                      const errorMessage = error?.message || error?.toString() || 'Unknown error';

                      // Provide helpful error messages
                      if (
                        errorMessage.includes('No Activity found') ||
                        errorMessage.includes('No app') ||
                        errorMessage.includes('ActivityNotFoundException')
                      ) {
                        setShowDialerUnavailableModal(true);
                      } else {
                        setShowUnableToMakeCallModal(true);
                      }
                    }
                  }}
                >
                  <Image
                    source={callLogo}
                    style={StyleSheet.flatten([
                      {
                        tintColor: '#FFFFFF',
                      },
                      is480p && { width: hp('1.8%'), height: hp('1.8%') },
                      is720p && { width: hp('2%'), height: hp('2%') },
                      is1080p && { width: hp('2.2%'), height: hp('2.2%') },
                      is1440p && { width: hp('2.4%'), height: hp('2.4%') },
                    ].filter(Boolean))}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              {/* Live Map Preview - Commented out to match first image design */}
              {/* <View style={StyleSheet.flatten([
                {
                  marginTop: is480p ? hp('1.5%') : is720p ? hp('1.8%') : hp('2%'),
                  borderRadius: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.3%'),
                  overflow: 'hidden' as const,
                },
                is480p && { height: hp('18%') },
                is720p && { height: hp('20%') },
                is1080p && { height: hp('22%') },
                is1440p && { height: hp('24%') },
              ].filter(Boolean))}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
                  <Text style={StyleSheet.flatten([
                    {
                      fontWeight: 'bold' as const,
                      color: '#333',
                      marginBottom: is480p ? hp('0.8%') : hp('1%'),
                    },
                    is480p && { fontSize: hp('1.5%') },
                    is720p && { fontSize: hp('1.6%') },
                    is1080p && { fontSize: hp('1.7%') },
                    is1440p && { fontSize: hp('1.9%') },
                  ].filter(Boolean))}>
                    Valet Location
                  </Text>
                  {vehicleCoords ? (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={StyleSheet.flatten([
                        { color: '#666' },
                        is480p && { fontSize: hp('1.3%') },
                        is720p && { fontSize: hp('1.4%') },
                        is1080p && { fontSize: hp('1.5%') },
                        is1440p && { fontSize: hp('1.6%') },
                      ].filter(Boolean))}>
                        📍 {vehicleCoords.lat.toFixed(4)}, {vehicleCoords.lng.toFixed(4)}
                      </Text>
                      <TouchableOpacity 
                        style={StyleSheet.flatten([
                          {
                            backgroundColor: '#007BFF',
                            borderRadius: is480p ? hp('0.8%') : hp('1%'),
                            marginTop: is480p ? hp('0.8%') : hp('1%'),
                          },
                          is480p && { paddingHorizontal: wp('3%'), paddingVertical: hp('0.8%') },
                          is720p && { paddingHorizontal: wp('3.5%'), paddingVertical: hp('0.9%') },
                          is1080p && { paddingHorizontal: wp('4%'), paddingVertical: hp('1%') },
                          is1440p && { paddingHorizontal: wp('4.5%'), paddingVertical: hp('1.1%') },
                        ].filter(Boolean))}
                        onPress={() => {
                          const url = `https://www.openstreetmap.org/?mlat=${vehicleCoords.lat}&mlon=${vehicleCoords.lng}&zoom=15`;
                          Linking.openURL(url);
                        }}
                      >
                        <Text style={StyleSheet.flatten([
                          {
                            color: 'white',
                            fontWeight: 'bold' as const,
                          },
                          is480p && { fontSize: hp('1.1%') },
                          is720p && { fontSize: hp('1.2%') },
                          is1080p && { fontSize: hp('1.3%') },
                          is1440p && { fontSize: hp('1.4%') },
                        ].filter(Boolean))}>
                          View on Map
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={StyleSheet.flatten([
                      { color: '#666' },
                      is480p && { fontSize: hp('1.3%') },
                      is720p && { fontSize: hp('1.4%') },
                      is1080p && { fontSize: hp('1.5%') },
                      is1440p && { fontSize: hp('1.6%') },
                    ].filter(Boolean))}>
                      Waiting for valet location...
                    </Text>
                  )}
                </View>
                {!vehicleCoords && (
                  <View style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0, 
                    backgroundColor: 'rgba(0,0,0,0.7)', 
                    justifyContent: 'center', 
                    alignItems: 'center' 
                  }}>
                    <Text style={StyleSheet.flatten([
                      {
                        color: 'white',
                        textAlign: 'center' as const,
                      },
                      is480p && { fontSize: hp('1.3%') },
                      is720p && { fontSize: hp('1.4%') },
                      is1080p && { fontSize: hp('1.5%') },
                      is1440p && { fontSize: hp('1.6%') },
                    ].filter(Boolean))}>
                      Waiting for valet location...
                    </Text>
                  </View>
                )}
              </View> */}
            </CustomModal>

            {/* Success Modal for Vehicle Delivery */}
            <CustomModal
              isVisible={showSuccessModal}
              onClose={() => {
                setShowSuccessModal(false);
                updateRequestStatus({
                  hasRequest: false,
                  requestStatus: undefined,
                  message: undefined
                });
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' as never }],
                });
              }}
              hideCloseButton={true}
              disableBackdropPress={true}
              title="Vehicle Delivered Successfully!"
              titleStyle={StyleSheet.flatten([
                { color: '#4CAF50', fontWeight: '600' as const },
                is480p && { fontSize: hp('1.7%') },
                is720p && { fontSize: hp('1.8%') },
                is1080p && { fontSize: hp('1.9%') },
                is1440p && { fontSize: hp('2.1%') },
              ].filter(Boolean))}
              width={is480p ? '85%' : is720p ? '80%' : is1080p ? '75%' : '70%'}
              modalContentStyle={StyleSheet.flatten([
                {
                  backgroundColor: '#F1F8E9',
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                },
                is480p && { borderRadius: hp('1.2%'), gap: hp('1.5%'), paddingVertical: hp('2.5%') },
                is720p && { borderRadius: hp('1.4%'), gap: hp('1.8%'), paddingVertical: hp('3%') },
                is1080p && { borderRadius: hp('1.5%'), gap: hp('2%'), paddingVertical: hp('3.5%') },
                is1440p && { borderRadius: hp('1.6%'), gap: hp('2.2%'), paddingVertical: hp('4%') },
              ].filter(Boolean))}
              iosModalContentStyle={StyleSheet.flatten([
                {
                  shadowColor: '#4CAF50',
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                },
                is480p && { paddingHorizontal: wp('6%'), paddingVertical: hp('3.5%'), paddingTop: hp('4.5%') },
                is720p && { paddingHorizontal: wp('7%'), paddingVertical: hp('4%'), paddingTop: hp('5%') },
                is1080p && { paddingHorizontal: wp('7.5%'), paddingVertical: hp('4.5%'), paddingTop: hp('5.5%') },
                is1440p && { paddingHorizontal: wp('8%'), paddingVertical: hp('5%'), paddingTop: hp('6%') },
              ].filter(Boolean))}
              androidModalContentStyle={StyleSheet.flatten([
                {
                  elevation: 8,
                },
                is480p && { paddingHorizontal: wp('5%'), paddingVertical: hp('3.5%'), paddingTop: hp('4.5%') },
                is720p && { paddingHorizontal: wp('6%'), paddingVertical: hp('4%'), paddingTop: hp('5%') },
                is1080p && { paddingHorizontal: wp('6.5%'), paddingVertical: hp('4.5%'), paddingTop: hp('5.5%') },
                is1440p && { paddingHorizontal: wp('7%'), paddingVertical: hp('5%'), paddingTop: hp('6%') },
              ].filter(Boolean))}
              height="auto"
            >
              <View style={styles.successContent}>
                <Text style={StyleSheet.flatten([
                  is480p && { fontSize: hp('4%') },
                  is720p && { fontSize: hp('4.5%') },
                  is1080p && { fontSize: hp('5%') },
                  is1440p && { fontSize: hp('5.5%') },
                  { marginBottom: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.5%') },
                ].filter(Boolean))}>🎉</Text>
                <Text style={StyleSheet.flatten([
                  {
                    fontWeight: '700' as const,
                    color: '#4CAF50',
                    textAlign: 'center' as const,
                    marginBottom: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.5%'),
                  },
                  is480p && { fontSize: hp('2%') },
                  is720p && { fontSize: hp('2.2%') },
                  is1080p && { fontSize: hp('2.4%') },
                  is1440p && { fontSize: hp('2.6%') },
                ].filter(Boolean))}>Congratulations!</Text>
                <Text style={StyleSheet.flatten([
                  {
                    color: '#2E7D32',
                    textAlign: 'center' as const,
                    lineHeight: is480p ? hp('2%') : is720p ? hp('2.2%') : hp('2.4%'),
                    marginBottom: is480p ? hp('1.5%') : is720p ? hp('1.8%') : hp('2%'),
                  },
                  is480p && { fontSize: hp('1.4%') },
                  is720p && { fontSize: hp('1.5%') },
                  is1080p && { fontSize: hp('1.6%') },
                  is1440p && { fontSize: hp('1.8%') },
                ].filter(Boolean))}>
                  Your vehicle has been delivered successfully. Thank you for using our valet service!
                </Text>
                <Button
                  title="OK"
                  onPress={() => {
                    setShowSuccessModal(false);
                    // Clear the request status and reset UI
                    updateRequestStatus({
                      hasRequest: false,
                      requestStatus: undefined,
                      message: undefined
                    });
                    // Navigate to Home using reset to clear navigation stack
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Home' as never }],
                    });
                  }}
                  containerStyle={StyleSheet.flatten([
                    {
                      backgroundColor: '#4CAF50',
                      width: 'auto' as const,
                      borderRadius: is480p ? hp('1%') : is720p ? hp('1.2%') : hp('1.3%'),
                    },
                    is480p && { paddingHorizontal: wp('8%'), paddingVertical: hp('1.2%'), marginTop: hp('1%') },
                    is720p && { paddingHorizontal: wp('9%'), paddingVertical: hp('1.4%'), marginTop: hp('1.2%') },
                    is1080p && { paddingHorizontal: wp('10%'), paddingVertical: hp('1.6%'), marginTop: hp('1.5%') },
                    is1440p && { paddingHorizontal: wp('11%'), paddingVertical: hp('1.8%'), marginTop: hp('2%') },
                  ].filter(Boolean))}
                  textStyle={StyleSheet.flatten([
                    {
                      fontWeight: '600' as const,
                      color: '#FFFFFF',
                    },
                    is480p && { fontSize: hp('1.4%') },
                    is720p && { fontSize: hp('1.5%') },
                    is1080p && { fontSize: hp('1.6%') },
                    is1440p && { fontSize: hp('1.8%') },
                  ].filter(Boolean))}
                />
              </View>
            </CustomModal>
          </View>
        }
      />
      {/* Vehicle Delivered Modal */}
      <ReusableModal
        visible={showVehicleDeliveredModal}
        onClose={() => setShowVehicleDeliveredModal(false)}
        title="Success"
        subtitle="Your vehicle has been delivered successfully!"
        iconType="success"
        buttonText="OK"
        onButtonPress={() => setShowVehicleDeliveredModal(false)}
      />

      {/* Pending Status Modal */}
      <ReusableModal
        visible={showPendingStatusModal}
        onClose={() => setShowPendingStatusModal(false)}
        title="Status"
        subtitle="Your request is still pending. Please wait for valet response."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowPendingStatusModal(false)}
      />

      {/* Phone Unavailable Modal */}
      <ReusableModal
        visible={showPhoneUnavailableModal}
        onClose={() => setShowPhoneUnavailableModal(false)}
        title="Phone Number Unavailable"
        subtitle="Valet phone number is not available at this time."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowPhoneUnavailableModal(false)}
      />

      {/* Invalid Phone Modal */}
      <ReusableModal
        visible={showInvalidPhoneModal}
        onClose={() => setShowInvalidPhoneModal(false)}
        title="Invalid Phone Number"
        subtitle="The phone number format is invalid."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowInvalidPhoneModal(false)}
      />

      {/* Dialer Unavailable Modal */}
      <ReusableModal
        visible={showDialerUnavailableModal}
        onClose={() => setShowDialerUnavailableModal(false)}
        title="Phone Dialer Unavailable"
        subtitle="Your device does not have a phone dialer app installed or phone calls are not supported on this device."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowDialerUnavailableModal(false)}
      />

      {/* Unable to Open Dialer Modal */}
      <ReusableModal
        visible={showUnableToOpenDialerModal}
        onClose={() => setShowUnableToOpenDialerModal(false)}
        title="Unable to Open Dialer"
        subtitle={phoneNumberForManualDial ? `Please dial ${phoneNumberForManualDial} manually.` : 'Please dial the number manually.'}
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowUnableToOpenDialerModal(false)}
      />

      {/* Unable to Make Call Modal */}
      <ReusableModal
        visible={showUnableToMakeCallModal}
        onClose={() => setShowUnableToMakeCallModal(false)}
        title="Unable to Make Call"
        subtitle="Failed to open phone dialer. Please try dialing the number manually or check your device settings."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowUnableToMakeCallModal(false)}
      />
    </ErrorBoundary>
  );
};

export default TrackVehicle;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  hamburgerWrapper: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: {
    width: '100%',
    height: '100%',
  },
  logoWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 33,
  },
  spacer: {
    width: 30,
  },
  topContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    alignItems: 'center',
  },
  bottomContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 30,
  },
  successContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valetInactiveBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    zIndex: 1001,
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
