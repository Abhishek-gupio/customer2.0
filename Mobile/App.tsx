import React, { useEffect } from 'react';
import { StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from './src/lib/react-navigation-native';
import { Provider } from './src/lib/react-redux';
import { store } from './src/store';
import { setUser } from './src/store/slices/authSlice';
import { getStoredAccessToken } from './src/services/authService';
import { getUserId } from './src/services/storage';
import { RootNavigator } from './src/navigation/RootNavigator';

import { telematicsService } from './src/services/telematicsService';
import { telematicsApi } from './src/api/telematics';
import { vehicleService } from './src/services/vehicleService';
import { Platform } from 'react-native';

function AuthRestore() {
  useEffect(() => {
    const initTelematicsFlow = async (userId: string) => {
      try {
        const hasPermissions = await telematicsService.requestPermissions();
        if (hasPermissions) {
          const deviceToken = await telematicsApi.registerUser(userId);
          if (deviceToken) {
            await telematicsService.initSDK(deviceToken);

            // Fetch user's vehicles to link telematics to the primary one
            const vehicles = await vehicleService.getVehicles();
            const primaryVehicle = vehicles.find((v: any) => v.isPrimary) || vehicles[0];

            if (primaryVehicle) {
              // We use deviceToken as instanceId since SDK instance handles it natively from setting deviceId
              await telematicsApi.linkDevice(primaryVehicle.id, deviceToken, deviceToken, Platform.OS);
            } else {
              console.warn("No vehicle found for the user to link telematics.");
            }
          }
        }
      } catch (error) {
        console.error("Telematics Initialization Error:", error);
      }
    };

    const token = getStoredAccessToken();
    const id = getUserId();
    if (token && id) {
      store.dispatch(setUser({ id, email: undefined }));
      initTelematicsFlow(id);
    }
  }, []);
  return <RootNavigator />;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <View style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <NavigationContainer>
            <AuthRestore />
          </NavigationContainer>
        </SafeAreaProvider>
      </View>
    </Provider>
  );
}

export default App;
