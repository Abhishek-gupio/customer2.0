import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config/environment';
import authStorage from './authStorage';

interface DeviceInfo {
  platform: string;
  appVersion: string;
  deviceModel?: string;
}

/**
 * Customer App Notification Service
 * Handles FCM token registration similar to valet app
 */
export class CustomerNotificationService {
  
  /**
   * Register FCM token for current customer (called automatically on login)
   */
  static async registerCurrentCustomerToken(deviceInfo?: DeviceInfo): Promise<boolean> {
    try {
      console.log('🚀 Starting FCM token registration for customer...');
      
      // Get FCM token with error handling
      let fcmToken;
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        fcmToken = await messaging().getToken();
      } catch (error) {
        console.error('❌ Failed to import Firebase messaging:', error);
        // For testing purposes, generate a mock token
        fcmToken = `mock_fcm_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('🔧 Using mock FCM token for testing:', fcmToken);
      }
      
      if (!fcmToken) {
        console.log('⚠️ No FCM token available for customer');
        return false;
      }

      console.log('🔑 FCM token obtained:', fcmToken.substring(0, 20) + '...');
      
      const baseUrl = config.apiBaseUrl;
      const url = `${baseUrl}/fcm/register`;
      console.log('🌐 API URL:', url);
      
      const authToken = await CustomerNotificationService.getAuthToken();
      if (!authToken) {
        console.log('⚠️ No auth token available for customer');
        return false;
      }
      
      console.log('🔐 Auth token obtained:', authToken.substring(0, 20) + '...');
      
      const requestBody = {
        token: fcmToken,
        deviceInfo: deviceInfo || {
          platform: 'react-native',
          appVersion: '1.0.0',
          deviceModel: 'Mobile Device'
        }
      };
      
      console.log('📤 Sending request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await response.json();
      console.log('📥 Response body:', JSON.stringify(result, null, 2));
      
      if (response.ok) {
        console.log('✅ Customer FCM token registered successfully');
        return true;
      } else {
        console.error('❌ Failed to register customer FCM token:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Error registering customer FCM token:', error);
      return false;
    }
  }

  /**
   * Unregister FCM token for current customer
   */
  static async unregisterCurrentCustomerToken(): Promise<boolean> {
    try {
      let fcmToken;
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        fcmToken = await messaging().getToken();
      } catch (error) {
        console.error('❌ Failed to import Firebase messaging:', error);
        // For testing purposes, generate a mock token
        fcmToken = `mock_fcm_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('🔧 Using mock FCM token for testing:', fcmToken);
      }
      
      if (!fcmToken) {
        console.log('⚠️ No FCM token available to unregister');
        return false;
      }

      console.log('🔑 Unregistering FCM token for customer:', fcmToken.substring(0, 20) + '...');
      
      const baseUrl = config.apiBaseUrl;
      const url = `${baseUrl}/fcm/unregister`;
      
      const authToken = await CustomerNotificationService.getAuthToken();
      if (!authToken) {
        console.log('⚠️ No auth token available for customer');
        return false;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: fcmToken
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Customer FCM token unregistered successfully');
        return true;
      } else {
        console.error('❌ Failed to unregister customer FCM token:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Error unregistering customer FCM token:', error);
      return false;
    }
  }

  /**
   * Get stored auth token (with 30-day expiration check)
   */
  private static async getAuthToken(): Promise<string | null> {
    try {
      // Use authStorage which checks for 30-day expiration
      const token = await authStorage.getToken();
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }
}

// Export convenience functions
export const registerCurrentCustomerToken = CustomerNotificationService.registerCurrentCustomerToken;
export const unregisterCurrentCustomerToken = CustomerNotificationService.unregisterCurrentCustomerToken;
