import React, { useRef, useEffect } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '../lib/react-navigation-native-stack';
import type { RootStackParamList } from './types';
import SplashScreen from '../components/SplashScreen';
import SigninFirst from '../screens/Auth/Signin_first';
import Signin from '../screens/Auth/Signin';
import Signup from '../screens/Auth/Signup';
import OTP from '../screens/Auth/OTP';
import LoginSuccessfull from '../screens/Auth/LoginSuccessfull';
import Home from '../screens/Main/Home';
import { ProtectedRoute } from './ProtectedRoute';
import { useAppSelector } from '../store/hooks';
import type { RootState } from '../store';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainScreen() {
  return (
    <ProtectedRoute>
      <Home />
    </ProtectedRoute>
  );
}

export function RootNavigator() {
  const isAuthenticated = useAppSelector((state: RootState) => state.auth.isAuthenticated);
  const authRef = useRef(isAuthenticated);
  useEffect(() => {
    authRef.current = isAuthenticated;
  }, [isAuthenticated]);

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash">
        {({
          navigation,
        }: NativeStackScreenProps<RootStackParamList, 'Splash'>) => (
          <SplashScreen
            onComplete={() => {
              if (authRef.current) {
                navigation.replace('Main', { screen: 'Home' });
              } else {
                navigation.replace('SigninFirst');
              }
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SigninFirst" component={SigninFirst} />
      <Stack.Screen name="Signin" component={Signin} />
      <Stack.Screen name="Signup" component={Signup} />
      <Stack.Screen name="OTP" component={OTP} />
      <Stack.Screen name="LoginSuccessfull" component={LoginSuccessfull} />
      <Stack.Screen name="Main" component={MainScreen} />
    </Stack.Navigator>
  );
}
