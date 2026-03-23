let EncryptedStorage: any;
try {
  EncryptedStorage = require('react-native-encrypted-storage').default;
  console.log('✅ [authStorage] Using react-native-encrypted-storage');
} catch (error) {
  console.warn('⚠️ [authStorage] EncryptedStorage not available, falling back to AsyncStorage:', error);
  // Fallback to AsyncStorage if EncryptedStorage is not available
  EncryptedStorage = require('@react-native-async-storage/async-storage').default;
  console.log('✅ [authStorage] Using AsyncStorage as fallback');
}

const TOKEN_KEY = 'secure_customer_auth_session_v1';
const USER_KEY = 'secure_customer_user_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type TokenSession = {
  token: string;
  expiresAt: number; // epoch ms
};

export async function saveToken(token: string): Promise<void> {
  const session: TokenSession = {
    token,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
  };
  console.log('💾 [authStorage] Saving token with key:', TOKEN_KEY);
  console.log('💾 [authStorage] Expiration date:', new Date(session.expiresAt).toLocaleString());
  await EncryptedStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  console.log('✅ [authStorage] Token saved successfully');
}

export async function getToken(): Promise<string | null> {
  console.log('🔍 [authStorage] Getting token from storage with key:', TOKEN_KEY);
  const raw = await EncryptedStorage.getItem(TOKEN_KEY);
  console.log('🔍 [authStorage] Raw token data:', raw ? 'exists' : 'null');
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as TokenSession;
    console.log('🔍 [authStorage] Parsed session:', { hasToken: !!session.token, expiresAt: session.expiresAt, now: Date.now() });
    if (session.expiresAt > Date.now()) {
      const daysRemaining = Math.floor((session.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
      console.log(`🔑 Token valid for ${daysRemaining} more days (expires: ${new Date(session.expiresAt).toLocaleDateString()})`);
      return session.token;
    } else {
      console.log('❌ [authStorage] Token expired');
    }
  } catch (error) {
    console.log('❌ [authStorage] Error parsing token:', error);
  }
  // Expired or invalid -> clear
  await clearToken();
  return null;
}

export async function clearToken(): Promise<void> {
  try {
    console.log('🗑️ [authStorage] Clearing token with key:', TOKEN_KEY);
    await EncryptedStorage.removeItem(TOKEN_KEY);
    console.log('✅ [authStorage] Token cleared successfully');
  } catch (error) {
    console.log('❌ [authStorage] Error clearing token:', error);
  }
}

export async function saveUser(user: any): Promise<void> {
  try {
    console.log('💾 [authStorage] Saving user with key:', USER_KEY);
    await EncryptedStorage.setItem(USER_KEY, JSON.stringify(user));
    console.log('✅ [authStorage] User saved successfully');
  } catch (error) {
    console.log('❌ [authStorage] Error saving user:', error);
  }
}

export async function getUser<T = any>(): Promise<T | null> {
  try {
    console.log('🔍 [authStorage] Getting user from storage with key:', USER_KEY);
    const raw = await EncryptedStorage.getItem(USER_KEY);
    console.log('🔍 [authStorage] Raw user data:', raw ? 'exists' : 'null');
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.log('❌ [authStorage] Error getting user:', error);
    return null;
  }
}

export async function clearUser(): Promise<void> {
  try {
    console.log('🗑️ [authStorage] Clearing user with key:', USER_KEY);
    await EncryptedStorage.removeItem(USER_KEY);
    console.log('✅ [authStorage] User cleared successfully');
  } catch (error) {
    console.log('❌ [authStorage] Error clearing user:', error);
  }
}

/**
 * Migrate old auth data from previous storage format to new format with expiration
 */
export async function migrateOldAuthData(): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const OLD_STORAGE_KEY = '@customer_auth_v1';
    
    // Check if old data exists
    const oldData = await AsyncStorage.getItem(OLD_STORAGE_KEY);
    if (!oldData) return;
    
    // Check if new data already exists
    const newData = await EncryptedStorage.getItem(TOKEN_KEY);
    if (newData) return; // Don't migrate if new format already exists
    
    console.log('🔄 Migrating old auth data to new format with 30-day expiration...');
    
    // Parse old data
    const parsed = JSON.parse(oldData);
    if (parsed?.token) {
      // Save in new format with expiration
      await saveToken(parsed.token);
      if (parsed?.customer) {
        await saveUser(parsed.customer);
      }
      
      // Clear old data
      await AsyncStorage.removeItem(OLD_STORAGE_KEY);
      console.log('✅ Auth data migrated successfully');
    }
  } catch (error) {
    console.warn('⚠️ Failed to migrate old auth data:', error);
  }
}

/**
 * Clear all auth data (complete logout)
 */
export async function clearAllAuthData(): Promise<void> {
  console.log('🧹 [authStorage] Clearing all auth data...');
  await clearToken();
  await clearUser();
  
  // Also clear from regular AsyncStorage (old format)
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('@customer_auth_v1');
    await AsyncStorage.removeItem('@customer_fcm_token');
    console.log('✅ [authStorage] All auth data cleared');
  } catch (error) {
    console.log('⚠️ [authStorage] Error clearing AsyncStorage:', error);
  }
}

export const authStorage = { 
  saveToken, 
  getToken, 
  clearToken, 
  saveUser, 
  getUser, 
  clearUser,
  migrateOldAuthData,
  clearAllAuthData
};
export default authStorage;

