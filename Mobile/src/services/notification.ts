import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getStoredAccessToken } from './authService';
import { Platform, PermissionsAndroid } from 'react-native';

const isInstallationsAuthError = (error: unknown) => {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as any).message)
        : '';
  return /FIS_AUTH_ERROR|messaging\/unknown|ExecutionException|java\.io\.IOException/i.test(message);
};

export const setupNotifications = async () => {
  try {
    // 1. Request permission for Android 13+
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('User denied notification permissions');
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      try {
        // 2. Get FCM token
        const fcmToken = await messaging().getToken();
        console.log('Firebase Cloud Messaging Token:', fcmToken);

        // 3. Register device with backend
        await registerDeviceWithBackend(fcmToken);

        // Listen for token refresh
        messaging().onTokenRefresh((token: string) => {
          registerDeviceWithBackend(token);
        });
      } catch (tokenError) {
        if (isInstallationsAuthError(tokenError)) {
          console.warn('FCM token unavailable (Firebase Installations auth/config issue). Continuing without push token.');
        } else {
          console.warn('FCM token setup failed:', tokenError);
        }
      }
    }

    // 4. Handle Foreground Messages
    messaging().onMessage(async (remoteMessage: any) => {
      console.log('FCM Message received in Foreground:', remoteMessage);
    });

    // 5. Handle notification opened when app is in background/quit
    messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('Notification caused app to open from background:', remoteMessage);
    });

    messaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
        }
      });

  } catch (error) {
    if (isInstallationsAuthError(error)) {
      console.warn('Notification setup skipped due to Firebase Installations auth/config issue.');
      return;
    }
    console.warn('Notification Setup Error:', error);
  }
};

const registerDeviceWithBackend = async (fcmToken: string) => {
  const token = getStoredAccessToken();
  if (!token) return;

  try {
    await axios.post(`${API_BASE_URL}/api/v1/customers/device`, {
      platform: Platform.OS.toLowerCase(),
      deviceToken: fcmToken,
      deviceInfo: {
        model: Platform.OS,
        systemVersion: Platform.Version,
        isEmulator: false, // You can add actual checks here
      }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Device token successfully registered with backend.');
  } catch (err) {
    console.warn('Failed to register device token with backend. User might not be logged in yet or server unreachable.');
  }
};
