import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from './src/lib/react-navigation-native';
import { Provider } from './src/lib/react-redux';
import { store } from './src/store';
import { setUser } from './src/store/slices/authSlice';
import { getStoredAccessToken } from './src/services/authService';
import {
  clearAuthStorage,
  getAuthPersistedAt,
  getUserId,
  hydrateAuthFromPersistedStorage,
  setUserId,
} from './src/services/storage';
import { RootNavigator } from './src/navigation/RootNavigator';
import { VoiceOwnerProvider } from './src/context/VoiceOwnerContext';

function tryDecodeUserIdFromJwt(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const base64 = b64 + pad;
    if (!globalThis.atob) return undefined;
    const json = globalThis.atob(base64);
    const payload = JSON.parse(json) as { id?: string };
    return payload.id;
  } catch {
    return undefined;
  }
}

function AuthRestore() {
  useEffect(() => {
    const persistedAt = getAuthPersistedAt();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (persistedAt && Date.now() - persistedAt > THIRTY_DAYS_MS) {
      clearAuthStorage();
      return;
    }
    const token = getStoredAccessToken();
    let id = getUserId();
    if (token && !id) {
      id = tryDecodeUserIdFromJwt(token);
      if (id) setUserId(id);
    }
    if (token && id) {
      store.dispatch(setUser({ id, email: undefined }));
    }
  }, []);
  return <RootNavigator />;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    if (typeof hydrateAuthFromPersistedStorage === 'function') {
      hydrateAuthFromPersistedStorage().finally(() => setStorageReady(true));
    } else {
      console.warn('[App] hydrateAuthFromPersistedStorage is undefined, skipping...');
      setStorageReady(true);
    }
  }, []);

  if (!storageReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <SafeAreaProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <NavigationContainer>
              <VoiceOwnerProvider>
                <AuthRestore />
              </VoiceOwnerProvider>
            </NavigationContainer>
          </SafeAreaProvider>
        </View>
      </GestureHandlerRootView>
    </Provider>
  );
}

export default App;
