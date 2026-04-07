import React from 'react';
import { createNativeStackNavigator } from '../lib/react-navigation-native-stack';
import type { ServiceStackParamList } from './types';
import ServicesHub from '../screens/Main/ServicesHub';
import { WarrantyStatus } from '../screens/ServiceAndWarrenty/WarrantyStatus';
import ServiceHistory from '../screens/ServiceAndWarrenty/ServiceHistory';
import NearbyPlaces from '../screens/ServiceAndWarrenty/NearbyPlaces';
import CheckChallan from '../screens/ServiceAndWarrenty/CheckChallan';

const Stack = createNativeStackNavigator<ServiceStackParamList>();

export function ServiceNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ServicesHome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="ServicesHome" component={ServicesHub} />
      <Stack.Screen name="WarrantyStatus" component={WarrantyStatus} />
      <Stack.Screen name="ServiceHistory" component={ServiceHistory} />
      <Stack.Screen name="NearbyPlaces" component={NearbyPlaces} />
      <Stack.Screen name="CheckChallan" component={CheckChallan} />
    </Stack.Navigator>
  );
}
