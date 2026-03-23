import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Platform,
  TouchableOpacity,
  StatusBar,
  Animated,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import InScreenDrawer from '../components/InScreenDrawer';
import WaveLayout from '../components/CommonUI';
import Greeting from '../components/Greeting';
import VehicleInfoCard from '../components/VehicleInfoCard/VehicleInfoCard';
import PrimaryButton from '../components/PrimaryButton';
import Button from '../components/Button';
import SuccessToast from '../components/SuccessToast';
import ReusableModal from '../components/ReusableModal';

import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useVehicle } from '../context/VehicleContext';
import { useDrawer } from '../components/DrawerProvider';

import { requestVehicleDrop, getVehicleRequestData, cancelDropRequest } from '../services/authApi';
import {
  getStoredVehicleInfo,
  clearStoredVehicleInfo,
  getStoredRequestStatus,
  clearStoredRequestStatus,
} from '../services/notificationHandler';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* ---------------------- Assets ---------------------- */
const logo = require('../assets/logo.png');
const carLogo = require('../assets/carLogo.png');
const humberger = require('../assets/humberger.png');

/* ---------------------- Constants / Helpers ---------------------- */
const DELIVERY_SUCCESS_KEY = '@delivery_success_shown';

const getDeliverySuccessFlag = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(DELIVERY_SUCCESS_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error getting delivery success flag:', error);
    return false;
  }
};

const setDeliverySuccessFlag = async (value: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(DELIVERY_SUCCESS_KEY, value.toString());
  } catch (error) {
    console.error('Error setting delivery success flag:', error);
  }
};

/* ---------------------- Navigation types ---------------------- */
type RootStackParamList = {
  Home: undefined;
  TrackVehicle: undefined;
  Login: undefined;
};

/* ---------------------- Component ---------------------- */
const Home: React.FC = () => {
  /* Error boundary */
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('Home');
  if (error) return ErrorBoundaryUI;

  /* Navigation & Contexts */
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, 'Home'>>();
  const { drawerOpen, setDrawerOpen } = useDrawer();
  const { token, customer } = useAuth();

  const {
    vehicleInfo,
    vehicleRequestData,
    requestStatus,
    updateVehicleInfo,
    updateRequestStatus,
    updateVehicleRequestData,
    clearVehicleInfo,
    isRequestPending,
    isValetOnWay,
    isDeliveryComplete,
  } = useVehicle();

  /* Local state */
  const [storedVehicleInfo, setStoredVehicleInfo] = useState<any>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [hasShownDeliverySuccess, setHasShownDeliverySuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  /* Modal states for replacing Alert messages */
  const [showVehicleDeliveredModal, setShowVehicleDeliveredModal] = useState(false);
  const [showManualDropLocationModal, setShowManualDropLocationModal] = useState(false);
  const [manualDropLocationToShow, setManualDropLocationToShow] = useState('');
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showAuthErrorModal, setShowAuthErrorModal] = useState(false);
  const [showCancelFailedModal, setShowCancelFailedModal] = useState(false);
  const [showRequestFailedModal, setShowRequestFailedModal] = useState(false);
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [requestErrorMessage, setRequestErrorMessage] = useState('');

  /* Animation for smooth button appearance - initialize at full visibility for stability */
  const buttonOpacity = React.useRef(new Animated.Value(1)).current;
  const buttonScale = React.useRef(new Animated.Value(1)).current;

  /* Responsive helpers */
  const { screenHeight } = useResponsive();
  const getResolution = () => {
    if (screenHeight <= 600) return '480p';
    if (screenHeight <= 800) return '720p';
    if (screenHeight <= 1200) return '1080p';
    return '1440p';
  };

  const resolution = getResolution();
  const is480p = resolution === '480p';
  const is720p = resolution === '720p';
  const is1080p = resolution === '1080p';
  const is1440p = resolution === '1440p';

  /* Load persisted delivery-success flag once */
  useEffect(() => {
    const loadDeliverySuccessFlag = async () => {
      try {
        const hasShown = await getDeliverySuccessFlag();
        setHasShownDeliverySuccess(hasShown);
      } catch (error) {
        console.error('🏠 Home: Error loading delivery success flag:', error);
      }
    };
    loadDeliverySuccessFlag();
  }, []);

  const loadStoredVehicleInfo = useCallback(async () => {
    try {
      const stored = await getStoredVehicleInfo();
      if (stored) {
        setStoredVehicleInfo(stored);
        updateVehicleInfo(stored);
      }
    } catch (error) {
      console.error('🏠 Home: Error loading stored vehicle info:', error);
    }
  }, [updateVehicleInfo]);

  const loadVehicleRequestData = useCallback(async () => {
    try {
      // first check stored request status (notifications)
      const storedStatus = await getStoredRequestStatus();
      if (storedStatus) {
        updateRequestStatus(storedStatus);
        await clearStoredRequestStatus();
      }

      // then call API if token exists
      if (token) {
        const vehicleDataResponse = await getVehicleRequestData(
          undefined,
          token,
        );

        if (vehicleDataResponse.success && vehicleDataResponse.data) {
          // If request is CANCELLED, don't show it on Home screen - only in notifications/history
          if (vehicleDataResponse.data.requestStatus === 'CANCELLED') {
            updateVehicleRequestData({
              hasRequest: false,
              requestStatus: undefined,
              message: undefined,
            });
            updateRequestStatus({
              hasRequest: false,
              requestStatus: undefined,
              message: undefined,
            });
            return; // Don't process further, cancellation only visible in notifications/history
          }

          updateVehicleRequestData(vehicleDataResponse.data);

          // if completed and success toast not shown before, clear and show alert
          if (
            vehicleDataResponse.data.requestStatus === 'COMPLETED' &&
            !hasShownDeliverySuccess
          ) {
            await clearStoredVehicleInfo();
            setStoredVehicleInfo(null);
            clearVehicleInfo();

            updateVehicleRequestData({
              hasRequest: false,
              requestStatus: 'COMPLETED',
              message: 'Vehicle has been delivered successfully.',
            });

            setHasShownDeliverySuccess(true);
            await setDeliverySuccessFlag(true);

            setShowVehicleDeliveredModal(true);
          }
        }
      }
    } catch (error: any) {
      const message =
        error?.message ||
        error?.response?.data?.message ||
        error?.response?.body?.message ||
        '';

      // When backend returns 404 "Vehicle not found", treat it as no active request
      if (message?.toLowerCase().includes('vehicle not found')) {
        await clearStoredVehicleInfo();
        setStoredVehicleInfo(null);
        clearVehicleInfo();
        updateVehicleRequestData({
          hasRequest: false,
          requestStatus: undefined,
          message: undefined,
        });
        updateRequestStatus({
          hasRequest: false,
          requestStatus: undefined,
          message: undefined,
        });
        return;
      }

      console.error('🏠 Home: Error loading vehicle request data:', error);
    }
  }, [
    token,
    updateRequestStatus,
    updateVehicleRequestData,
    clearVehicleInfo,
    hasShownDeliverySuccess,
  ]);

  const handleRequestVehicle = useCallback(async () => {
    try {
      if (!token) {
        setShowAuthErrorModal(true);
        return;
      }
      setShowSuccessToast(true);

      const response = await requestVehicleDrop(
        undefined,
        token || undefined,
      );

      if (response.success) {
        // Manual drop: valet had already saved drop location; show it in modal
        if (response.manualDropLocationRevealed && response.dropLocation) {
          setManualDropLocationToShow(response.dropLocation);
          setShowManualDropLocationModal(true);
          await clearStoredVehicleInfo();
          setStoredVehicleInfo(null);
          clearVehicleInfo();
          updateRequestStatus({
            hasRequest: false,
            requestStatus: 'COMPLETED',
            message: 'Vehicle is ready for pickup.',
          });
          updateVehicleRequestData({
            hasRequest: false,
            requestStatus: 'COMPLETED',
            message: 'Vehicle is ready for pickup.',
          });
          setHasShownDeliverySuccess(true);
          await setDeliverySuccessFlag(true);
          return;
        }

        updateRequestStatus({
          hasRequest: true,
          requestStatus: 'PENDING',
          message:
            'Request is pending. Waiting for valet response.',
        });

        setHasShownDeliverySuccess(false);
        await setDeliverySuccessFlag(false);
      }

      setTimeout(() => {
        navigation.navigate('TrackVehicle');
      }, 1200);
    } catch (e: any) {
      console.warn('Drop request failed:', e?.message);
      setRequestErrorMessage(e?.message || 'Failed to send drop request');
      setShowRequestFailedModal(true);
    }
  }, [token, navigation, updateRequestStatus, updateVehicleRequestData, clearVehicleInfo]);

  // Track polling interval
  const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const isScreenFocusedRef = React.useRef(false);

  // PRODUCTION-READY: Prevent duplicate API calls with ref tracking
  const hasInitialLoadRef = React.useRef(false);

  // Make initial API call when screen comes into focus (only once per focus)
  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;

      // Only load on first focus or if not already loaded
      if (!hasInitialLoadRef.current) {
        hasInitialLoadRef.current = true;
        // Load stored vehicle info and make initial API call when screen comes into focus
        loadStoredVehicleInfo();
        loadVehicleRequestData();
      }

      return () => {
        // Clear interval when screen loses focus
        isScreenFocusedRef.current = false;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Reset flag when screen loses focus so it loads again on next focus
        hasInitialLoadRef.current = false;
      };
    }, [loadStoredVehicleInfo, loadVehicleRequestData]),
  );

  // Manage polling based on request status - only poll when there's an active request
  React.useEffect(() => {
    // Only manage polling if screen is focused
    if (!isScreenFocusedRef.current) {
      return;
    }

    const shouldPoll =
      vehicleRequestData?.requestStatus === 'PENDING' ||
      vehicleRequestData?.requestStatus === 'ACCEPTED' ||
      isRequestPending ||
      isValetOnWay;

    const isCompleted =
      vehicleRequestData?.requestStatus === 'COMPLETED' ||
      vehicleRequestData?.requestStatus === 'RETURNED' ||
      vehicleRequestData?.requestStatus === 'CANCELLED' ||
      vehicleRequestData?.requestStatus === 'REJECTED' ||
      !vehicleRequestData?.hasRequest;

    // Start polling if there's an active request and no interval is running
    if (shouldPoll && !pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(() => {
        loadVehicleRequestData();
      }, 5000); // Poll every 15 seconds when there's an active request
    }

    // Stop polling when request is completed/cancelled
    if (isCompleted && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [
    vehicleRequestData?.requestStatus,
    vehicleRequestData?.hasRequest,
    isRequestPending,
    isValetOnWay,
    loadVehicleRequestData
  ]);

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

  /* Derived data */
  const currentVehicleInfo =
    vehicleRequestData?.requestStatus === 'COMPLETED' ||
      vehicleRequestData?.requestStatus === 'CANCELLED' ||
      vehicleRequestData?.requestStatus === 'RETURNED' ||
      vehicleRequestData?.requestStatus === 'REJECTED' ||
      requestStatus?.requestStatus === 'CANCELLED' ||
      requestStatus?.requestStatus === 'RETURNED' ||
      requestStatus?.requestStatus === 'REJECTED'
      ? null
      : vehicleRequestData?.vehicleInfo || vehicleInfo || storedVehicleInfo;
  const currentPickupInfo = vehicleRequestData?.pickupInfo;

  /* Animate buttons when they appear - keep them stable once visible */
  useEffect(() => {
    if (isRequestPending) {
      // Animate in smoothly when buttons first appear, then keep them stable
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Ensure buttons stay at full opacity after animation completes
        buttonOpacity.setValue(1);
        buttonScale.setValue(1);
      });
    }
    // Don't animate out - let conditional rendering handle visibility
    // This keeps buttons stable and visible while isRequestPending is true
  }, [isRequestPending, buttonOpacity, buttonScale]);

  /* Get pickup time - only show when request is ACCEPTED or COMPLETED */
  const getPickupTime = useCallback((): string => {
    // Only show pickup time when request is ACCEPTED or COMPLETED
    if (vehicleRequestData?.requestStatus === 'ACCEPTED') {
      // When request is ACCEPTED, show the acceptance time (when valet accepted the request)
      return formatAcceptanceTime(vehicleRequestData.updatedAt);
    }

    // For COMPLETED status, show the actual pickup time if available
    if (vehicleRequestData?.requestStatus === 'COMPLETED') {
      if (currentPickupInfo?.pickupTime) {
        return currentPickupInfo.pickupTime;
      }
      // Fallback to vehicleInfo time if available
      if (currentVehicleInfo?.pickupTime) {
        return currentVehicleInfo.pickupTime;
      }
    }

    // For PENDING or any other status, show "Not scheduled"
    return 'Not scheduled';
  }, [vehicleRequestData?.requestStatus, vehicleRequestData?.updatedAt, currentPickupInfo?.pickupTime, currentVehicleInfo?.pickupTime, formatAcceptanceTime]);

  /* Cancel request handler */
  const handleCancelRequest = useCallback(async () => {
    setShowCancelConfirmModal(true);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    setShowCancelConfirmModal(false);
    try {
      setIsCancelling(true);
      if (!token) {
        setShowAuthErrorModal(true);
        return;
      }

      // Call the API to cancel the request
      const response = await cancelDropRequest(
        vehicleRequestData?.vehicleNumber || undefined,
        token || undefined,
      );

      console.log('✅ Cancel request API response:', response);

      // Only update state if API call succeeded
      if (response?.success) {
        // Clear request state so cancellation message doesn't show on Home screen
        // Cancellation will only appear in notifications and history
        console.log('🔄 Clearing request state after cancellation');

        // Set status to CANCELLED first to trigger location service stop
        // Set status to CANCELLED first to trigger location service stop
        updateRequestStatus({
          hasRequest: false,
          requestStatus: 'CANCELLED',
          message: 'Request cancelled',
        });
        updateVehicleRequestData({
          hasRequest: false,
          requestStatus: 'CANCELLED',
          message: 'Request cancelled',
        });

        // Clear stored vehicle info and context info
        await clearStoredVehicleInfo();
        setStoredVehicleInfo(null);
        clearVehicleInfo();

        // Reload request data to ensure we have the latest state from backend
        setTimeout(() => {
          loadVehicleRequestData();
        }, 500);

        console.log('✅ State cleared after cancellation - location service should stop');
      } else {
        // API returned but with success: false
        const errorMessage = response?.message || 'Failed to cancel drop request';
        console.error('❌ Cancel request failed:', errorMessage);
        setCancelErrorMessage(errorMessage);
        setShowCancelFailedModal(true);
      }
    } catch (e: any) {
      console.error('❌ Cancel request error:', e);
      const errorMessage = e?.message || e?.response?.data?.message || 'Failed to cancel drop request. Please try again.';
      setCancelErrorMessage(errorMessage);
      setShowCancelFailedModal(true);
    } finally {
      setIsCancelling(false);
    }
  }, [token, vehicleRequestData, updateRequestStatus, updateVehicleRequestData, loadVehicleRequestData]);


  if (error) return ErrorBoundaryUI;

  /* ---------------------- Render ---------------------- */
  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <WaveLayout
        waveSectionStyle={StyleSheet.flatten({ minHeight: hp('30%') })}
        topContent={
          <>
            {/* Header with hamburger */}
            <View style={styles.header}>
              <TouchableOpacity
                style={StyleSheet.flatten(
                  [
                    styles.hamburgerWrapper,
                    is480p && styles.hamburgerWrapper480p,
                    is720p && styles.hamburgerWrapper720p,
                    is1080p && styles.hamburgerWrapper1080p,
                    is1440p && styles.hamburgerWrapper1440p,
                  ].filter(Boolean),
                )}
                onPress={() => setDrawerOpen(true)}
              >
                <Image
                  source={humberger}
                  style={StyleSheet.flatten(
                    [
                      styles.hamburger,
                      is480p && styles.hamburger480p,
                      is720p && styles.hamburger720p,
                      is1080p && styles.hamburger1080p,
                      is1440p && styles.hamburger1440p,
                    ].filter(Boolean),
                  )}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            {/* Logo background + logo (platform/resolution specific tweaks) */}
            <View
              style={StyleSheet.flatten(
                [
                  styles.logoBackground,
                  is480p && styles.logoBackground480p,
                  is720p && styles.logoBackground720p,
                  is1080p && styles.logoBackground1080p,
                  is1440p && styles.logoBackground1440p,

                  Platform.OS === 'ios' && styles.logoBackgroundIOS,
                  Platform.OS === 'ios' &&
                  is480p &&
                  styles.logoBackgroundIOS480p,
                  Platform.OS === 'ios' &&
                  is720p &&
                  styles.logoBackgroundIOS720p,
                  Platform.OS === 'ios' &&
                  is1080p &&
                  styles.logoBackgroundIOS1080p,
                  Platform.OS === 'ios' &&
                  is1440p &&
                  styles.logoBackgroundIOS1440p,

                  Platform.OS === 'android' && styles.logoBackgroundAndroid,
                  Platform.OS === 'android' &&
                  is480p &&
                  styles.logoBackgroundAndroid480p,
                  Platform.OS === 'android' &&
                  is720p &&
                  styles.logoBackgroundAndroid720p,
                  Platform.OS === 'android' &&
                  is1080p &&
                  styles.logoBackgroundAndroid1080p,
                  Platform.OS === 'android' &&
                  is1440p &&
                  styles.logoBackgroundAndroid1440p,
                ].filter(Boolean),
              )}
            >
              <Image
                source={logo}
                style={StyleSheet.flatten(
                  [
                    styles.logo,
                    is480p && styles.logo480p,
                    is720p && styles.logo720p,
                    is1080p && styles.logo1080p,
                    is1440p && styles.logo1440p,

                    Platform.OS === 'ios' && styles.logoIOS,
                    Platform.OS === 'ios' && is480p && styles.logoIOS480p,
                    Platform.OS === 'ios' && is720p && styles.logoIOS720p,
                    Platform.OS === 'ios' && is1080p && styles.logoIOS1080p,
                    Platform.OS === 'ios' && is1440p && styles.logoIOS1440p,

                    Platform.OS === 'android' && styles.logoAndroid,
                    Platform.OS === 'android' &&
                    is480p &&
                    styles.logoAndroid480p,
                    Platform.OS === 'android' &&
                    is720p &&
                    styles.logoAndroid720p,
                    Platform.OS === 'android' &&
                    is1080p &&
                    styles.logoAndroid1080p,
                    Platform.OS === 'android' &&
                    is1440p &&
                    styles.logoAndroid1440p,
                  ].filter(Boolean),
                )}
                resizeMode="contain"
              />
            </View>
          </>
        }
        topContainerStyle={StyleSheet.flatten(
          [
            styles.topContainer,
            is480p && styles.topContainer480p,
            is720p && styles.topContainer720p,
            is1080p && styles.topContainer1080p,
            is1440p && styles.topContainer1440p,
          ].filter(Boolean),
        )}
        topPlatformAdjust={
          Platform.OS === 'ios'
            ? is480p
              ? { marginTop: hp('2%') }
              : is720p
                ? { marginTop: hp('3%') }
                : { marginTop: hp('4%') }
            : is480p
              ? { marginTop: hp('8%') }
              : is720p
                ? { marginTop: hp('9%') }
                : { marginTop: hp('10%') }
        }
        bottomContent={
          <View
            style={StyleSheet.flatten(
              [
                styles.bottomContent,
                is480p && styles.bottomContent480p,
                is720p && styles.bottomContent720p,
                is1080p && styles.bottomContent1080p,
                is1440p && styles.bottomContent1440p,

                Platform.OS === 'ios' && styles.bottomContentIOS,
                Platform.OS === 'ios' && is480p && styles.bottomContentIOS480p,
                Platform.OS === 'ios' && is720p && styles.bottomContentIOS720p,
                Platform.OS === 'ios' &&
                is1080p &&
                styles.bottomContentIOS1080p,
                Platform.OS === 'ios' &&
                is1440p &&
                styles.bottomContentIOS1440p,

                Platform.OS === 'android' &&
                is480p &&
                styles.bottomContentAndroid480p, // small-screen android tweak
              ].filter(Boolean),
            )}
          >
            <Greeting name={customer?.fullName || 'Customer'} />

            {currentVehicleInfo ? (
              <VehicleInfoCard
                vehicleNumberFull={currentVehicleInfo.vehicleNumberFull}
                vehicleNumberMasked={currentVehicleInfo.vehicleNumberMasked}
                pickedBy={
                  vehicleRequestData?.requestStatus === 'ACCEPTED' ||
                    vehicleRequestData?.requestStatus === 'COMPLETED'
                    ? currentPickupInfo?.pickedBy ||
                    currentVehicleInfo.pickedBy ||
                    'Not assigned'
                    : 'Not assigned'
                }
                pickupTime={getPickupTime()}
                pickupLocation={
                  vehicleRequestData?.requestStatus === 'ACCEPTED' ||
                    vehicleRequestData?.requestStatus === 'COMPLETED'
                    ? currentPickupInfo?.pickupLocation ||
                    currentVehicleInfo.pickupLocation ||
                    'Not available'
                    : 'Not available'
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
            )}

            {isRequestPending || isValetOnWay ? (
              <View style={{ width: '100%', gap: is480p ? hp('1.2%') : is720p ? hp('1.3%') : hp('1.5%') }}>
                <Button
                  title="Track your vehicle"
                  onPress={() => {
                    navigation.navigate('TrackVehicle');
                  }}
                  containerStyle={StyleSheet.flatten(
                    [
                      {
                        backgroundColor: '#FFBF00',
                        width: '100%' as const,
                        borderRadius: is480p
                          ? hp('1%')
                          : is720p
                            ? hp('1.2%')
                            : hp('1.3%'),
                        paddingVertical: is480p
                          ? hp('1.5%')
                          : is720p
                            ? hp('1.7%')
                            : hp('1.9%'),
                      },
                      is480p && styles.updateButtonContainer480p,
                      is720p && styles.updateButtonContainer720p,
                      is1080p && styles.updateButtonContainer1080p,
                      is1440p && styles.updateButtonContainer1440p,
                    ].filter(Boolean),
                  )}
                  textStyle={StyleSheet.flatten(
                    [
                      {
                        fontSize: is480p
                          ? hp('1.6%')
                          : is720p
                            ? hp('1.7%')
                            : is1080p
                              ? hp('1.8%')
                              : hp('2%'),
                        fontWeight: '600' as const,
                        color: '#1F1B4E',
                      },
                      is480p && styles.updateButtonText480p,
                      is720p && styles.updateButtonText720p,
                      is1080p && styles.updateButtonText1080p,
                      is1440p && styles.updateButtonText1440p,
                    ].filter(Boolean),
                  )}
                />
                {isRequestPending && vehicleRequestData?.requestStatus === 'PENDING' && (
                  <Button
                    title={isCancelling ? 'Cancelling...' : 'Cancel Request'}
                    onPress={handleCancelRequest}
                    disabled={isCancelling}
                    loading={isCancelling}
                    containerStyle={StyleSheet.flatten(
                      [
                        {
                          width: '100%' as const,
                          backgroundColor: '#EF0000',
                          borderRadius: is480p
                            ? hp('1%')
                            : is720p
                              ? hp('1.2%')
                              : hp('1.3%'),
                          paddingVertical: is480p
                            ? hp('1.5%')
                            : is720p
                              ? hp('1.7%')
                              : hp('1.9%'),
                          opacity: isCancelling ? 0.6 : 1,
                        },
                      ].filter(Boolean),
                    )}
                    textStyle={StyleSheet.flatten(
                      [
                        {
                          fontSize: is480p
                            ? hp('1.6%')
                            : is720p
                              ? hp('1.7%')
                              : is1080p
                                ? hp('1.8%')
                                : hp('2%'),
                          fontWeight: '600' as const,
                          color: '#FFFFFF',
                        },
                      ].filter(Boolean),
                    )}
                  />
                )}
              </View>
            ) : (
              <PrimaryButton
                title="Request Your Vehicle"
                icon={carLogo}
                onPress={() => { }}
                onSwipeSuccess={handleRequestVehicle}
              />
            )}
          </View>
        }
      />

      <InScreenDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        setDrawerOpen={setDrawerOpen}
      />

      <SuccessToast
        visible={showSuccessToast}
        message="Request sent successfully!"
        onHide={() => setShowSuccessToast(false)}
        duration={1000}
      />

      {/* Vehicle Delivered Modal */}
      <ReusableModal
        visible={showVehicleDeliveredModal}
        onClose={() => {
          setShowVehicleDeliveredModal(false);
          updateRequestStatus({
            hasRequest: false,
            requestStatus: undefined,
            message: undefined,
          });
        }}
        title="Vehicle Delivered!"
        subtitle="Your vehicle has been delivered successfully. Thank you for using our valet service!"
        iconType="success"
        buttonText="OK"
        onButtonPress={() => {
          setShowVehicleDeliveredModal(false);
          updateRequestStatus({
            hasRequest: false,
            requestStatus: undefined,
            message: undefined,
          });
        }}
      />

      {/* Manual Drop Location Modal - shown when customer requests after valet saved drop location */}
      <ReusableModal
        visible={showManualDropLocationModal}
        onClose={() => {
          setShowManualDropLocationModal(false);
          setManualDropLocationToShow('');
        }}
        title="Your vehicle is ready"
        subtitle={`Your vehicle is parked at this location. Please go and take it.\n\n${manualDropLocationToShow || ''}`}
        iconType="success"
        buttonText="OK"
        onButtonPress={() => {
          setShowManualDropLocationModal(false);
          setManualDropLocationToShow('');
        }}
      />

      {/* Cancel Request Confirmation Modal */}
      <ReusableModal
        visible={showCancelConfirmModal}
        onClose={() => setShowCancelConfirmModal(false)}
        title="Cancel Request"
        subtitle="Are you sure you want to cancel this drop request?"
        iconType="question"
        primaryButton={{
          text: 'Yes, Cancel',
          onPress: handleConfirmCancel,
        }}
        secondaryButton={{
          text: 'No',
          onPress: () => setShowCancelConfirmModal(false),
        }}
      />

      {/* Authentication Error Modal */}
      <ReusableModal
        visible={showAuthErrorModal}
        onClose={() => setShowAuthErrorModal(false)}
        title="Authentication Error"
        subtitle="Please log in again"
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowAuthErrorModal(false)}
      />

      {/* Cancel Failed Modal */}
      <ReusableModal
        visible={showCancelFailedModal}
        onClose={() => setShowCancelFailedModal(false)}
        title="Cancel failed"
        subtitle={cancelErrorMessage}
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowCancelFailedModal(false)}
      />

      {/* Request Failed Modal */}
      <ReusableModal
        visible={showRequestFailedModal}
        onClose={() => setShowRequestFailedModal(false)}
        title="Request failed"
        subtitle={requestErrorMessage}
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowRequestFailedModal(false)}
      />
    </SafeAreaView>
  );
};

export default Home;

/* ---------------------- Styles ---------------------- */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F9',
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp('5%'),
    marginTop: Platform.OS === 'ios' ? hp('2%') : hp('-5%'),
    zIndex: 10,
  },

  logoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: hp('10%'),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  /* iOS (kept unchanged) */
  logoBackgroundIOS: { marginTop: hp('1.5%') },
  logoBackgroundIOS480p: { marginTop: hp('2.5%') },
  logoBackgroundIOS720p: { marginTop: hp('2%') },
  logoBackgroundIOS1080p: { marginTop: hp('1.2%') },
  logoBackgroundIOS1440p: { marginTop: hp('0.8%') },

  /* ANDROID: uplift container so logo appears higher */
  logoBackgroundAndroid: { marginTop: hp('-1%') },
  logoBackgroundAndroid480p: { marginTop: hp('-3.5%') }, // stronger uplift for small screens
  logoBackgroundAndroid720p: { marginTop: hp('-1.5%') },
  logoBackgroundAndroid1080p: { marginTop: hp('-1%') },
  logoBackgroundAndroid1440p: { marginTop: hp('-0.8%') },

  hamburgerWrapper: {
    width: wp('8%'),
    height: wp('8%'),
    minWidth: 24,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp('0.5%'),
  },

  hamburger: {
    width: '100%',
    height: '100%',
    tintColor: '#FFBF00',
  },

  logoWrapper: {
    flex: 1,
    alignItems: 'center',
  },

  logo: {
    width: wp('30%'),
    height: hp('3%'),
    maxWidth: 120,
    maxHeight: 25,
  },

  /* iOS: kept same */
  logoIOS: { marginTop: hp('1.2%') },
  logoIOS480p: { marginTop: hp('2.5%'), height: hp('4.2%') },
  logoIOS720p: { marginTop: hp('1.8%'), height: hp('3.8%') },
  logoIOS1080p: { marginTop: hp('1.2%'), height: hp('3.6%') },
  logoIOS1440p: { marginTop: hp('1%'), height: hp('3%') },

  /* ANDROID logo uplift */
  logoAndroid: { marginTop: hp('-1.2%') },
  logoAndroid480p: { marginTop: hp('5%'), height: hp('4.5%') }, // NOTE: kept as your provided value
  logoAndroid720p: { marginTop: hp('-2%') },
  logoAndroid1080p: { marginTop: hp('-1%') },
  logoAndroid1440p: { marginTop: hp('-0.6%') },

  spacer: { width: wp('8%'), minWidth: 24 },

  topContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    alignItems: 'center',
  },

  bottomContent: {
    flex: 1,
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('5%'),
    gap: hp('3.5%'),
    marginTop: hp('-3.8%'), // kept as provided
  },

  /* NEW: Android small-screen: shift bottom container slightly down so Greeting has more top space */
  bottomContentAndroid480p: {
    marginTop: hp('-2%'),
  },

  /* iOS bottomContent overrides (kept) */
  bottomContentIOS: { marginTop: hp('-3.5%') },
  bottomContentIOS480p: { marginTop: hp('-2%') },
  bottomContentIOS720p: { marginTop: hp('-3%') },
  bottomContentIOS1080p: { marginTop: hp('-4%') },
  bottomContentIOS1440p: { marginTop: hp('-5%') },

  /* 480p adjustments */
  header480p: { paddingHorizontal: wp('4%'), paddingTop: hp('1.5%') },
  logoBackground480p: {},
  hamburgerWrapper480p: {
    width: wp('7%'),
    height: wp('7%'),
    minWidth: 22,
    minHeight: 22,
    marginTop: hp('3%'),
  },
  hamburger480p: { width: '100%', height: '100%', tintColor: '#FFBF00' },
  logo480p: {
    width: wp('30%'),
    height: hp('4%'),
    maxWidth: 120,
    maxHeight: 25,
  },
  spacer480p: { width: wp('7%'), minWidth: 22 },
  topContainer480p: { paddingTop: 0 },
  bottomContent480p: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('3%'),
    gap: hp('2%'),
  },
  updateButtonContainer480p: {
    borderRadius: hp('1%'),
    paddingVertical: hp('1.5%'),
  },
  updateButtonText480p: { fontSize: hp('1.6%') },

  /* 720p adjustments */
  header720p: { paddingHorizontal: wp('4.5%'), paddingTop: hp('1.8%') },
  logoBackground720p: {},
  hamburgerWrapper720p: {
    width: wp('7.5%'),
    height: wp('7.5%'),
    minWidth: 26,
    minHeight: 26,
    marginTop: hp('2%'),
  },
  hamburger720p: { width: '100%', height: '100%', tintColor: '#FFBF00' },
  logo720p: {
    width: wp('35%'),
    height: hp('3.5%'),
    maxWidth: 130,
    maxHeight: 28,
  },
  spacer720p: { width: wp('7.5%'), minWidth: 26 },
  topContainer720p: { paddingTop: 0 },
  bottomContent720p: {
    paddingHorizontal: wp('4.5%'),
    paddingBottom: hp('4.5%'),
    gap: hp('3%'),
  },
  updateButtonContainer720p: {
    borderRadius: hp('1.2%'),
    paddingVertical: hp('1.7%'),
  },
  updateButtonText720p: { fontSize: hp('1.7%') },

  /* 1080p adjustments */
  header1080p: { paddingHorizontal: wp('5%'), paddingTop: hp('2%') },
  logoBackground1080p: {},
  hamburgerWrapper1080p: {
    width: wp('8%'),
    height: wp('8%'),
    minWidth: 28,
    minHeight: 28,
    marginTop: hp('0.5%'),
  },
  hamburger1080p: { width: '100%', height: '100%', tintColor: '#FFBF00' },
  logo1080p: {
    width: wp('35%'),
    height: hp('3.8%'),
    maxWidth: 135,
    maxHeight: 30,
  },
  spacer1080p: { width: wp('8%'), minWidth: 28 },
  topContainer1080p: { paddingTop: 0 },
  bottomContent1080p: {
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('5%'),
    gap: hp('1.9%'),
  },
  updateButtonContainer1080p: {
    borderRadius: hp('1.3%'),
    paddingVertical: hp('1.9%'),
  },
  updateButtonText1080p: { fontSize: hp('1.8%') },

  /* 1440p adjustments */
  header1440p: { paddingHorizontal: wp('5.5%'), paddingTop: hp('2.5%') },
  logoBackground1440p: {},
  hamburgerWrapper1440p: {
    width: wp('8.5%'),
    height: wp('8.5%'),
    minWidth: 30,
    minHeight: 30,
    marginTop: hp('0.6%'),
  },
  hamburger1440p: { width: '100%', height: '100%', tintColor: '#FFBF00' },
  logo1440p: {
    width: wp('28%'),
    height: hp('2.5%'),
    maxWidth: 135,
    maxHeight: 30,
  },
  spacer1440p: { width: wp('8.5%'), minWidth: 30 },
  topContainer1440p: { paddingTop: 0 },
  bottomContent1440p: {
    paddingHorizontal: wp('5.5%'),
    paddingBottom: hp('5.5%'),
    gap: hp('4%'),
  },
  updateButtonContainer1440p: {
    borderRadius: hp('1.4%'),
    paddingVertical: hp('2%'),
  },
  updateButtonText1440p: { fontSize: hp('2%') },
});
