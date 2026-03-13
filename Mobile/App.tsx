import React, { useEffect } from 'react';
import { StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from './src/lib/react-navigation-native';
import { Provider } from './src/lib/react-redux';
import { store } from './src/store';
import { setUser } from './src/store/slices/authSlice';
import { getStoredAccessToken } from './src/services/authService';
import { getUserId } from './src/services/storage';
import  RootNavigator  from './src/navigation/RootNavigator';

function AuthRestore() {
  useEffect(() => {
    const token = getStoredAccessToken();
    const id = getUserId();
    if (token && id) {
      store.dispatch(setUser({ id, email: undefined }));
    }
  }, []);
  return <RootNavigator />;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <SafeAreaProvider>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <NavigationContainer>
              <AuthRestore />
            </NavigationContainer>
          </SafeAreaProvider>
        </View>
      </GestureHandlerRootView>
    </Provider>
  );
}

export default App;
