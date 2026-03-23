import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { registerCurrentCustomerToken, unregisterCurrentCustomerToken } from '../services/notificationService';
import { clearAllNotificationData } from '../services/notificationHandler';
import authStorage from '../services/authStorage';
import { logout as apiLogout } from '../services/authApi';

type AuthState = {
  token: string | null;
  customer: {
    id: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
};

type AuthContextType = {
  token: string | null;
  customer: AuthState['customer'];
  isHydrated: boolean;
  signIn: (token: string, customer?: AuthState['customer']) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  token: null,
  customer: null,
  isHydrated: false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  signIn: async () => { },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  signOut: async () => { },
});

const STORAGE_KEY = '@customer_auth_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ token: null, customer: null });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        console.log('🔄 [AuthContext] Starting auth hydration...');

        // Migrate old auth data if it exists
        await authStorage.migrateOldAuthData();

        // Use authStorage which checks for 30-day expiration
        const token = await authStorage.getToken();
        const customer = await authStorage.getUser();

        console.log('🔍 [AuthContext] Hydration result:', {
          hasToken: !!token,
          hasCustomer: !!customer,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
        });

        if (token && customer) {
          setState({ token, customer });
          console.log('✅ [AuthContext] User authenticated from storage');
        } else {
          console.log('⚠️ [AuthContext] No valid auth data found in storage');
        }
      } catch (error) {
        console.warn('❌ [AuthContext] Failed to hydrate auth state:', error);
      } finally {
        setIsHydrated(true);
        console.log('✅ [AuthContext] Hydration complete');
      }
    })();
  }, []);

  const ensureFcmRegistered = useCallback(async (auth: AuthState) => {
    try {
      console.log('🔄 AuthContext: Starting FCM registration process...');
      console.log('🔄 AuthContext: Auth state:', { hasToken: !!auth.token, hasCustomer: !!auth.customer });

      // Use static import for Firebase messaging
      let fcmToken;
      try {
        const authStatus = await messaging().requestPermission();
        console.log('🔔 AuthContext: FCM permission status:', authStatus);

        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (!enabled) {
          console.log('⚠️ AuthContext: FCM permission not granted');
          return;
        }

        fcmToken = await messaging().getToken();
        if (!fcmToken) {
          console.log('⚠️ AuthContext: No FCM token available');
          return;
        }

        console.log('🔑 AuthContext: FCM token obtained:', fcmToken.substring(0, 20) + '...');
      } catch (error) {
        console.error('❌ AuthContext: Failed to use Firebase messaging:', error);
        // For testing purposes, generate a mock token
        fcmToken = `mock_fcm_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('🔧 AuthContext: Using mock FCM token for testing:', fcmToken);
      }

      // Use the new notification service similar to valet app
      console.log('🚀 AuthContext: Calling registerCurrentCustomerToken...');
      const success = await registerCurrentCustomerToken({
        platform: 'react-native',
        appVersion: '1.0.0',
        deviceModel: 'Mobile Device'
      });

      if (success) {
        await AsyncStorage.setItem('@customer_fcm_token', fcmToken);
        console.log('✅ AuthContext: Customer FCM token registered and stored successfully');
      } else {
        console.log('⚠️ AuthContext: Failed to register customer FCM token');
      }
    } catch (e) {
      console.log('❌ AuthContext: Error registering customer FCM token:', e);
    }
  }, []);

  // Auto-register FCM if session is restored and no token registered yet
  useEffect(() => {
    (async () => {
      if (!isHydrated) return;
      if (!state.token) return;
      try {
        const existing = await AsyncStorage.getItem('@customer_fcm_token');
        if (!existing) {
          await ensureFcmRegistered(state);
        }
      } catch { }
    })();
  }, [isHydrated, state.token, ensureFcmRegistered]);


  const signIn = useCallback(async (token: string, customer?: AuthState['customer']) => {
    console.log('🔐 AuthContext: signIn called with token:', token.substring(0, 20) + '...');
    console.log('🔐 AuthContext: signIn called with customer:', customer);

    const next: AuthState = { token, customer: customer ?? null };
    setState(next);

    // Save token with 30-day expiration and customer data
    await authStorage.saveToken(token);
    if (customer) {
      await authStorage.saveUser(customer);
    }

    console.log('💾 AuthContext: Auth state saved to storage with 30-day expiration');

    // Fire and forget FCM registration
    console.log('🚀 AuthContext: Starting FCM registration after signIn...');
    ensureFcmRegistered(next);
  }, [ensureFcmRegistered]);

  const signOut = useCallback(async () => {
    console.log('🚪 [AuthContext] Starting signOut process...');

    // First: unregister FCM token while we still have the auth token
    try {
      console.log('🔄 [AuthContext] Unregistering FCM token...');
      const success = await unregisterCurrentCustomerToken();
      if (success) {
        await AsyncStorage.removeItem('@customer_fcm_token');
        console.log('✅ [AuthContext] Customer FCM token unregistered successfully');
      } else {
        console.warn('⚠️ [AuthContext] Failed to unregister customer FCM token (likely expired on server)');
        await AsyncStorage.removeItem('@customer_fcm_token');
      }
    } catch (e) {
      console.log('⚠️ [AuthContext] Error unregistering customer FCM token:', e);
      try {
        await AsyncStorage.removeItem('@customer_fcm_token');
      } catch { }
    }

    // Second: Clear all notification data (local storage + displayed notifications)
    try {
      console.log('🧹 [AuthContext] Clearing all notification data...');
      await clearAllNotificationData();
      console.log('✅ [AuthContext] Notification data cleared successfully');
    } catch (e) {
      console.warn('⚠️ [AuthContext] Error clearing notification data:', e);
    }

    // Then: notify backend to revoke the session token (best-effort)
    try {
      await apiLogout();
      console.log('✅ [AuthContext] Backend logout successful');
    } catch (e) {
      console.warn('⚠️ [AuthContext] Backend logout failed (continuing locally):', e);
    }

    // Clear state first
    setState({ token: null, customer: null });
    console.log('✅ [AuthContext] State cleared');

    // Clear all auth data (encrypted storage + old AsyncStorage)
    await authStorage.clearAllAuthData();

    console.log('✅ [AuthContext] SignOut complete - all auth data cleared');
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    token: state.token,
    customer: state.customer,
    isHydrated,
    signIn,
    signOut,
  }), [state, isHydrated, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


