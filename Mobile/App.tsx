import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from './src/lib/react-navigation-native';
import { Provider } from './src/lib/react-redux';
import { store } from './src/store';
import { setUser } from './src/store/slices/authSlice';
import { getStoredAccessToken } from './src/services/authService';
import {
  getUserId,
  hydrateAuthFromPersistedStorage,
  setUserId,
} from './src/services/storage';
import { RootNavigator } from './src/navigation/RootNavigator';
import { VoiceOwnerProvider } from './src/context/VoiceOwnerContext';
import { setupNotifications } from './src/services/notification';
import NetworkBanner from './src/components/NetworkBanner';
import ErrorBoundary from './src/components/ErrorBoundary';

let RNAndroidNotificationListener: any = null;
if (Platform.OS === 'android') {
  try {
    RNAndroidNotificationListener =
      (require('react-native-android-notification-listener') as any).default;
  } catch {}
}

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

/** Run after hydrate so async-auth cache is filled; before navigator mounts so splash routing sees auth. */
function bootstrapAuthToRedux() {
  const token = getStoredAccessToken();
  let id = getUserId();
  if (token && !id) {
    id = tryDecodeUserIdFromJwt(token);
    if (id) setUserId(id);
  }
  if (token && id) {
    store.dispatch(setUser({ id, email: undefined }));
  }
}

const linking = {
  prefixes: ['gupio://'],
  config: {
    screens: {
      DocumentList: 'document-list',
    },
  },
};

function AppBoundaryTestCrash(): never {
  throw new Error('app boundary test');
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [storageReady, setStorageReady] = useState(false);
  const [appResetKey, setAppResetKey] = useState(0);
  const ENABLE_APP_BOUNDARY_TEST = __DEV__ && false;
  const forceAppBoundaryCrash = ENABLE_APP_BOUNDARY_TEST && appResetKey === 0;

  useEffect(() => {
    hydrateAuthFromPersistedStorage()
      .catch(() => {
        /* keep going; MMKV path still works */
      })
      .finally(() => {
        bootstrapAuthToRedux();
        setStorageReady(true);
        setupNotifications().catch(err => {
          console.error('Error during notification setup:', err);
        });
      });
  }, []);

  useEffect(() => {
    if (!storageReady || Platform.OS !== 'android' || !RNAndroidNotificationListener) {
      return;
    }

    let promptShown = false;

    const checkAndPromptNotificationPermission = async () => {
      if (promptShown) return;
      try {
        const status = await RNAndroidNotificationListener.getPermissionStatus();
        if (status === 'authorized') return;
        promptShown = true;
        Alert.alert(
          'Enable notification access',
          'Turn on notification access now so the app can auto-fetch your OTP from incoming messages and notifications.',
          [
            {
              text: 'Not now',
              style: 'cancel',
              onPress: () => {
                promptShown = false;
              },
            },
            {
              text: 'Open app settings',
              onPress: async () => {
                promptShown = false;
                try {
                  await Linking.openSettings();
                } catch {}
              },
            },
            {
              text: 'Grant Permission',
              onPress: () => {
                promptShown = false;
                RNAndroidNotificationListener.requestPermission();
              },
            },
          ],
        );
      } catch {
        // no-op
      }
    };

    checkAndPromptNotificationPermission().catch(() => {});
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkAndPromptNotificationPermission().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [storageReady]);

  const appContent = storageReady ? (
    <Provider store={store}>
      <GestureHandlerRootView style={styles.appRoot}>
        <View style={styles.appContent}>
          <SafeAreaProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <NetworkBanner />
            <NavigationContainer linking={linking}>
              <VoiceOwnerProvider>
                <RootNavigator />
              </VoiceOwnerProvider>
            </NavigationContainer>
          </SafeAreaProvider>
        </View>
      </GestureHandlerRootView>
    </Provider>
  ) : (
    <View style={styles.bootstrapLoader}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
  return (
    <ErrorBoundary
      level="app"
      boundaryName="mobile-app-root"
      fallbackTitle="Gupio could not recover"
      fallbackMessage="Try restarting this session. If the problem keeps happening, report it with the correlation id."
      onRetry={() => {
        setAppResetKey(current => current + 1);
      }}
    >
      <React.Fragment key={`${storageReady ? 'ready' : 'boot'}-${appResetKey}`}>
        {forceAppBoundaryCrash ? <AppBoundaryTestCrash /> : null}
        {appContent}
      </React.Fragment>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  appContent: {
    flex: 1,
  },
  bootstrapLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
});

export default App;
