import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '../lib/react-navigation-native-stack';
import type { RootStackParamList } from './types';
import SplashScreen from '../components/SplashScreen';
import Login from '../screens/Auth/Login';
import { ProtectedRoute } from './ProtectedRoute';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainScreen() {
  return (
    <ProtectedRoute>
      <View style={styles.main}>
        <Text style={styles.text}>Main</Text>
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 18, color: '#333' },
});

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash">
        {({
          navigation,
        }: NativeStackScreenProps<RootStackParamList, 'Splash'>) => (
          <SplashScreen onComplete={() => navigation.replace('Login')} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Main" component={MainScreen} />
    </Stack.Navigator>
  );
}
