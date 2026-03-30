import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import axios from 'axios';
import { PermissionsAndroid, Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { getStoredAccessToken } from './authService';

type NotificationsCleanup = () => void;
type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

export const setupNotifications = async (): Promise<NotificationsCleanup> => {
  const messaging = getMessaging(getApp());
  const subscriptions: NotificationsCleanup[] = [];

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

    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      // 2. Get FCM token
      const fcmToken = await getToken(messaging);
      console.log('Firebase Cloud Messaging Token:', fcmToken);

      // 3. Register device with backend
      await registerDeviceWithBackend(fcmToken);

      // Listen for token refresh
      subscriptions.push(
        onTokenRefresh(messaging, (token: string) => {
          void registerDeviceWithBackend(token);
        }),
      );
    }

    // 4. Handle Foreground Messages
    subscriptions.push(onMessage(messaging, async (remoteMessage: RemoteMessage) => {
      console.log('FCM Message received in Foreground:', remoteMessage);
    }));

    // 5. Handle notification opened when app is in background/quit
    subscriptions.push(onNotificationOpenedApp(messaging, (remoteMessage: RemoteMessage) => {
      console.log('Notification caused app to open from background:', remoteMessage);
    }));

    const remoteMessage = await getInitialNotification(messaging);
    if (remoteMessage) {
      console.log('Notification caused app to open from quit state:', remoteMessage);
    }
  } catch (error) {
    console.error('Notification Setup Error:', error);
  }

  return () => {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }
  };
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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log(
      `Device token not registered with backend yet. User might not be logged in or server may be unreachable. ${errorMessage}`,
    );
  }
};
