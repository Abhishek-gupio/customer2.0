/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import * as React from 'react';
import { StatusBar, useColorScheme, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { QueryClientProvider } from '@tanstack/react-query';
import messaging from '@react-native-firebase/messaging';

// Context providers
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { VehicleProvider } from './src/context/VehicleContext';
import { DrawerProvider } from './src/components/DrawerProvider';
import { queryClient } from './src/lib/queryClient';

// Components
import ErrorBoundary from './src/components/ErrorBoundary';

// Screens
import Home from './src/screens/Home';
import TrackVehicle from './src/screens/TrackVehicle';
import TrackLive from './src/screens/TrackLive';
import Wellcome from './src/screens/Wellcome';
import Login from './src/screens/Login';
import OTP from './src/screens/OTP';
import LoginSuccessfull from './src/screens/LoginSuccessfull';
import SucessfullyLoggedIn from './src/screens/SucessfullyLoggedIn';
import QRCode from './src/screens/QRCode';
import MyProfile from './src/screens/MyProfile';
import History from './src/screens/history';
import Notification from './src/screens/Notification';
import Media from './src/screens/Media';

// Services
import { initializeNotificationListeners } from './src/services/notificationHandler';
import { registerBackgroundNotificationHandlers } from './src/services/backgroundNotificationService';

const Stack = createStackNavigator();

// Navigation wrapper that checks auth state
function AuthenticatedNavigation() {
  const { token, isHydrated } = useAuth();

  // Show loading while checking auth state
  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4D1C96' }}>
        <ActivityIndicator size="large" color="#FFBF00" />
      </View>
    );
  }

  // Determine initial route based on auth state
  const initialRoute = token ? 'Home' : 'Wellcome';

  console.log('🧭 [Navigation] Initial route:', initialRoute, { isAuthenticated: !!token });

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Wellcome" component={Wellcome} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="OTP" component={OTP} />
      <Stack.Screen
        name="LoginSuccessfull"
        component={LoginSuccessfull}
      />
      <Stack.Screen
        name="SucessfullyLoggedIn"
        component={SucessfullyLoggedIn}
      />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="TrackVehicle" component={TrackVehicle} />
      <Stack.Screen name="TrackLive" component={TrackLive} />
      <Stack.Screen name="QRCode" component={QRCode} />
      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="Notification" component={Notification} />
      <Stack.Screen name="Media" component={Media} />
    </Stack.Navigator>
  );
}

function App() {
  console.log('🚀 [CustomerApp] App component rendering...');
  
  const isDarkMode = useColorScheme() === 'dark';
  const [appReady, setAppReady] = React.useState(false);

  // Request notification permissions and initialize listeners on app start
  React.useEffect(() => {
    console.log('🔄 [CustomerApp] useEffect running...');
    
    const initializeApp = async () => {
      try {
        console.log('🚀 [CustomerApp] Starting initialization...');
        
        // Request notification permissions
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        console.log('🔔 [CustomerApp] Notification permission status:', authStatus);
        console.log('🔔 [CustomerApp] Notifications enabled:', enabled);

        if (enabled) {
          console.log('✅ [CustomerApp] Notification permissions granted');

          // Initialize notification listeners
          initializeNotificationListeners();

          // Register background notification handlers after a delay
          setTimeout(() => {
            try {
              registerBackgroundNotificationHandlers();
              console.log('✅ [CustomerApp] Background notification handlers registered');
            } catch (err) {
              console.warn('⚠️ [CustomerApp] Failed to register background handlers:', err);
            }
          }, 2000);
        } else {
          console.log('⚠️ [CustomerApp] Notification permissions not granted');
        }
        
        console.log('✅ [CustomerApp] Initialization complete');
      } catch (error) {
        console.error('❌ [CustomerApp] Error initializing app:', error);
        // Don't block app startup on notification errors
      } finally {
        setAppReady(true);
        console.log('✅ [CustomerApp] App marked as ready');
      }
    };

    initializeApp();
  }, []);
  
  // Show loading screen while app initializes
  if (!appReady) {
    console.log('⏳ [CustomerApp] Showing loading screen...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4D1C96' }}>
        <ActivityIndicator size="large" color="#FFBF00" />
        <Text style={{ color: '#FFFFFF', marginTop: 20 }}>Loading...</Text>
      </View>
    );
  }
  
  console.log('✅ [CustomerApp] Rendering main UI...');
  
  try {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        {/* PRODUCTION-READY: React Query for automatic retries, caching, and network handling */}
        <QueryClientProvider client={queryClient}>
          <DrawerProvider>
            <NavigationContainer>
              <ErrorBoundary>
                <AuthProvider>
                  <VehicleProvider>
                    <AuthenticatedNavigation />
                  </VehicleProvider>
                </AuthProvider>
              </ErrorBoundary>
            </NavigationContainer>
          </DrawerProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  } catch (error) {
    console.error('❌ [CustomerApp] Fatal error rendering app:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#4D1C96', padding: 20 }}>
        <Text style={{ color: '#FFBF00', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          App Error
        </Text>
        <Text style={{ color: '#FFFFFF', textAlign: 'center' }}>
          {String(error)}
        </Text>
      </View>
    );
  }
}

// Styles removed since they're not used

export default App;
