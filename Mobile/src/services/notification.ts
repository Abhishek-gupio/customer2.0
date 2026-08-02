import messaging, { getToken, requestPermission } from '@react-native-firebase/messaging';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getStoredAccessToken } from './authService';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { navigateTo } from '../navigation/navigationRef';

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

    const authStatus = await requestPermission(messaging()).catch(() => messaging().requestPermission());
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      try {
        if (typeof messaging().setForegroundNotificationPresentationOptions === 'function') {
          await messaging().setForegroundNotificationPresentationOptions({
            alert: true,
            badge: true,
            sound: true,
          });
        }

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

    const handleNotificationNavigation = (remoteMessage: any) => {
      if (!remoteMessage?.data) return;
      const conversationId = remoteMessage.data.conversationId || remoteMessage.data.id;
      const isGuest = remoteMessage.data.isGuest === 'true' || remoteMessage.data.type === 'GUEST_MESSAGE';
      const link = remoteMessage.data.link;

      if (conversationId) {
        if (isGuest) {
          navigateTo('GuestConversation', { conversationId });
        } else {
          navigateTo('ChatConversation', { conversationId });
        }
      } else if (link && typeof link === 'string') {
        const match = link.match(/\/conversations\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          navigateTo('ChatConversation', { conversationId: match[1] });
        } else {
          navigateTo('VehicleInbox');
        }
      } else {
        navigateTo('VehicleInbox');
      }
    };

    // 4. Handle Foreground Messages
    messaging().onMessage(async (remoteMessage: any) => {
      console.log('FCM Message received in Foreground:', remoteMessage);

      // The urgent full-screen alert is only for someone scanning this vehicle's QR
      // code and messaging in as a guest — not for every push notification (payment
      // confirmations, reminders, etc. shouldn't trigger a siren-style modal).
      const isGuestVehicleMessage = remoteMessage?.data?.type === 'VEHICLE_GUEST_MESSAGE';
      if (!isGuestVehicleMessage) return;

      const title = remoteMessage?.notification?.title || remoteMessage?.data?.title || '🚨 Vehicle Alert';
      const body = remoteMessage?.notification?.body || remoteMessage?.data?.body || 'New alert received!';
      const conversationId = remoteMessage?.data?.conversationId || remoteMessage?.data?.id;

      if (typeof (globalThis as any).triggerTestBanner === 'function') {
        (globalThis as any).triggerTestBanner(title, body, conversationId);
      }
    });

    // 5. Handle notification opened when app is in background/quit
    messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('Notification caused app to open from background:', remoteMessage);
      handleNotificationNavigation(remoteMessage);
    });

    messaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
          setTimeout(() => handleNotificationNavigation(remoteMessage), 1000);
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

import { api } from './api';

export const registerDeviceWithBackend = async (fcmToken?: string) => {
  try {
    const targetToken = fcmToken || (await getToken(messaging()).catch(() => messaging().getToken().catch(() => null)));
    if (!targetToken) return;

    await api.post('/v1/customer/device', {
      platform: Platform.OS.toLowerCase(),
      deviceToken: targetToken,
      deviceInfo: JSON.stringify({
        model: Platform.OS,
        systemVersion: Platform.Version,
        isEmulator: false,
      }),
    });
    console.log('Device token successfully registered with backend.');
  } catch (err) {
    console.warn('Failed to register device token with backend:', err);
  }
};
