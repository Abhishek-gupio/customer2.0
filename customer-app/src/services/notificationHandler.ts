import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { customerLocationService } from './customerLocationService';

let listenersInitialized = false;
let channelReady = false;

// Initialize notification listeners
export const initializeNotificationListeners = () => {
  if (listenersInitialized) return;
  listenersInitialized = true;

  console.log('🔧 [CustomerApp] Initializing customer notification listeners');

  // Ensure Android channel exists (safe to call multiple times)
  const ensureChannel = async () => {
    if (channelReady) return;
    try {
      await notifee.createChannel({
        id: 'customer_default',
        name: 'Customer Notifications',
        description: 'Customer app notifications',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
      channelReady = true;
      console.log('✅ [CustomerApp] Notification channel created');
    } catch (error) {
      console.log('❌ [CustomerApp] Error creating notification channel:', error);
    }
  };
  void ensureChannel();

  // Request Android 13+ notification permission
  const requestNotificationPermission = async () => {
    try {
      await notifee.requestPermission();
      console.log('✅ [CustomerApp] Notification permission requested');
    } catch (error) {
      console.log('❌ [CustomerApp] Error requesting notification permission:', error);
    }
  };
  void requestNotificationPermission();

  // Handle foreground messages
  messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.log('📱 [CustomerApp] Customer received foreground message:', remoteMessage);

    // Extract notification data
    const title = remoteMessage?.notification?.title ||
      (typeof remoteMessage?.data?.title === 'string' ? remoteMessage.data.title : 'Customer Notification');
    const body = remoteMessage?.notification?.body ||
      (typeof remoteMessage?.data?.body === 'string' ? remoteMessage.data.body : 'You have a new notification');

    // Store notification in backend so it appears on Notification page
    try {
      const { storeNotification } = require('./notificationApi');
      await storeNotification(title, body, remoteMessage?.data || {});
    } catch (error) {
      console.log('⚠️ [CustomerApp] Failed to store notification in backend:', error);
    }

    // Show local notification in foreground
    try {
      await notifee.displayNotification({
        title,
        body,
        android: {
          channelId: 'customer_default',
          smallIcon: 'ic_launcher',
          pressAction: {
            id: 'customer_default',
            launchActivity: 'default',
          },
        },
        data: {
          ...(remoteMessage?.data || {}),
          id: `customer_fg_notification_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
        },
      });
      console.log('✅ [CustomerApp] Foreground notification displayed');
    } catch (error) {
      console.log('❌ [CustomerApp] Error displaying foreground notification:', error);
    }

    // Process notification data for vehicle updates
    if (remoteMessage.data) {
      await handleNotificationData(remoteMessage.data);
    }
  });

  // Handle notification opened from background/quit state
  messaging().onNotificationOpenedApp(async (remoteMessage) => {
    console.log('📱 [CustomerApp] Customer notification opened from background:', remoteMessage);

    // Store notification in backend when opened
    const title = remoteMessage?.notification?.title ||
      (typeof remoteMessage?.data?.title === 'string' ? remoteMessage.data.title : 'Customer Notification');
    const body = remoteMessage?.notification?.body ||
      (typeof remoteMessage?.data?.body === 'string' ? remoteMessage.data.body : 'You have a new notification');

    try {
      const { storeNotification } = require('./notificationApi');
      await storeNotification(title, body, remoteMessage?.data || {});
    } catch (error) {
      console.log('⚠️ [CustomerApp] Failed to store notification in backend:', error);
    }

    if (remoteMessage.data) {
      handleNotificationData(remoteMessage.data);
    }
  });

  // Handle notification when app is in quit state
  messaging()
    .getInitialNotification()
    .then(async (remoteMessage) => {
      if (remoteMessage) {
        console.log('📱 [CustomerApp] Customer notification received while app was quit:', remoteMessage);

        // Store notification in backend when app opens from quit state
        const title = remoteMessage?.notification?.title ||
          (typeof remoteMessage?.data?.title === 'string' ? remoteMessage.data.title : 'Customer Notification');
        const body = remoteMessage?.notification?.body ||
          (typeof remoteMessage?.data?.body === 'string' ? remoteMessage.data.body : 'You have a new notification');

        try {
          const { storeNotification } = require('./notificationApi');
          await storeNotification(title, body, remoteMessage?.data || {});
        } catch (error) {
          console.log('⚠️ [CustomerApp] Failed to store notification in backend:', error);
        }

        if (remoteMessage.data) {
          handleNotificationData(remoteMessage.data);
        }
      }
    });

  // Handle Notifee notification clicks
  notifee.onForegroundEvent((event) => {
    console.log('🔔 [CustomerApp] Foreground notification clicked:', event);
    if (event.type === 1) { // PRESS event
      const notification = event.detail.notification;
      const data = notification?.data;
      if (data) {
        handleNotificationData(data);
      }
    }
  });

  notifee.onBackgroundEvent(async (event) => {
    console.log('🔔 [CustomerApp] Background notification clicked:', event);
    // Handle background click - data will be processed when app becomes active
  });
};

// Handle notification data and update vehicle state
const handleNotificationData = async (data: any) => {
  try {
    console.log('📋 Processing notification data:', data);

    // Check if this is a request acceptance notification
    if (data.type === 'REQUEST_ACCEPTED' || data.status === 'accepted') {
      console.log('✅ Processing request acceptance notification');

      // Extract vehicle information from notification
      const vehicleInfo = extractVehicleInfoFromNotification(data);

      if (vehicleInfo) {
        // Store in AsyncStorage and let the Home screen pick it up
        await storeVehicleInfo(vehicleInfo);
      }
    }

    // Check if this is a vehicle delivered notification
    if (data.type === 'VEHICLE_DELIVERED') {
      console.log('✅ Processing vehicle delivered notification');

      // Stop customer location polling immediately when delivery is complete
      try {
        customerLocationService.stopPolling();
        console.log('✅ [NotificationHandler] Customer location polling stopped');
      } catch (e) {
        console.error('⚠️ [NotificationHandler] Failed to stop location polling:', e);
      }

      // Clear stored vehicle info since delivery is complete
      await clearStoredVehicleInfo();

      // Don't show alert here - let the screens handle the success modal
      // The Home screen will handle refreshing request status and showing success modal
    }

    // Check if this is a vehicle dropped notification (manual drop by valet)
    if (data.type === 'VEHICLE_DROPPED') {
      console.log('✅ Processing vehicle dropped notification');
      console.log('📍 Drop location:', data.dropLocation);

      // Stop customer location polling immediately when drop is complete
      try {
        customerLocationService.stopPolling();
        console.log('✅ [NotificationHandler] Customer location polling stopped');
      } catch (e) {
        console.error('⚠️ [NotificationHandler] Failed to stop location polling:', e);
      }

      // Clear stored vehicle info since drop is complete
      await clearStoredVehicleInfo();

      // Store notification for user to view
      await storeRequestStatusUpdate({
        hasRequest: false,
        requestStatus: 'completed',
        message: `Your vehicle ${data.vehicleNumber} has been dropped at ${data.dropLocation}`,
        vehicleNumber: data.vehicleNumber,
        dropLocation: data.dropLocation,
        updatedAt: new Date().toISOString()
      });
    }

    // Check if this is a drop request status update
    if (data.type === 'DROP_REQUEST_STATUS_UPDATE' || data.requestStatus) {
      console.log('✅ Processing drop request status update:', data.requestStatus);

      // Store the status update for screens to pick up
      await storeRequestStatusUpdate({
        hasRequest: true,
        requestStatus: data.requestStatus,
        message: data.message || `Request status: ${data.requestStatus}`,
        vehicleNumber: data.vehicleNumber,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Error processing notification data:', error);
  }
};

// Extract vehicle information from notification data
const extractVehicleInfoFromNotification = (data: any) => {
  try {
    // Based on typical notification structure for request acceptance
    const vehicleNumber = data.vehicleNumber || data.vehicle_number;
    const valetName = data.valetName || data.valet_name || data.pickedBy || 'Valet Team';
    const pickupTime = data.pickupTime || data.pickup_time || new Date().toLocaleTimeString();
    const pickupLocation = data.pickupLocation || data.pickup_location || 'Parking Area';

    if (!vehicleNumber) {
      console.log('⚠️ No vehicle number in notification data');
      return null;
    }

    // Create masked vehicle number (show first few characters)
    const maskedNumber = vehicleNumber.length > 4
      ? vehicleNumber.substring(0, 4) + ' *****'
      : vehicleNumber;

    return {
      vehicleNumberFull: vehicleNumber,
      vehicleNumberMasked: maskedNumber,
      pickedBy: valetName,
      pickupTime,
      pickupLocation,
      valetName,
      status: 'picked_up' as const,
    };
  } catch (error) {
    console.error('❌ Error extracting vehicle info from notification:', error);
    return null;
  }
};

// Store vehicle info in AsyncStorage for the Home screen to pick up
const storeVehicleInfo = async (vehicleInfo: any) => {
  try {
    await AsyncStorage.setItem('@customer_vehicle_info', JSON.stringify(vehicleInfo));
    console.log('💾 Stored vehicle info in AsyncStorage');
  } catch (error) {
    console.error('❌ Error storing vehicle info:', error);
  }
};

// Get stored vehicle info from AsyncStorage
export const getStoredVehicleInfo = async () => {
  try {
    const stored = await AsyncStorage.getItem('@customer_vehicle_info');
    if (stored) {
      const vehicleInfo = JSON.parse(stored);
      console.log('📖 Retrieved stored vehicle info:', vehicleInfo);
      return vehicleInfo;
    }
  } catch (error) {
    console.error('❌ Error retrieving stored vehicle info:', error);
  }
  return null;
};

// Clear stored vehicle info
export const clearStoredVehicleInfo = async () => {
  try {
    await AsyncStorage.removeItem('@customer_vehicle_info');
    console.log('🗑️ Cleared stored vehicle info');
  } catch (error) {
    console.error('❌ Error clearing stored vehicle info:', error);
  }
};

// Store request status update
const storeRequestStatusUpdate = async (statusUpdate: any) => {
  try {
    await AsyncStorage.setItem('@customer_request_status', JSON.stringify(statusUpdate));
    console.log('💾 Request status stored:', statusUpdate);
  } catch (error) {
    console.error('❌ Error storing request status:', error);
  }
};

// Get stored request status
export const getStoredRequestStatus = async () => {
  try {
    const stored = await AsyncStorage.getItem('@customer_request_status');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('❌ Error getting stored request status:', error);
    return null;
  }
};

// Clear stored request status
export const clearStoredRequestStatus = async () => {
  try {
    await AsyncStorage.removeItem('@customer_request_status');
    console.log('🗑️ Request status cleared');
  } catch (error) {
    console.error('❌ Error clearing request status:', error);
  }
};

/**
 * Clear all notification data on logout
 * This prevents notification data from persisting across customer sessions
 */
export const clearAllNotificationData = async () => {
  try {
    console.log('🧹 [NotificationHandler] Starting comprehensive notification cleanup...');

    // Clear local notification storage
    await clearStoredVehicleInfo();
    await clearStoredRequestStatus();

    // Cancel all displayed notifications in system tray
    try {
      await notifee.cancelAllNotifications();
      console.log('✅ [NotificationHandler] All displayed notifications canceled');
    } catch (error) {
      console.error('⚠️ [NotificationHandler] Error canceling notifications:', error);
    }

    console.log('✅ [NotificationHandler] Notification cleanup complete');
  } catch (error) {
    console.error('❌ [NotificationHandler] Error during notification cleanup:', error);
  }
};
