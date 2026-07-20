import React from 'react';
import { createNativeStackNavigator } from '../lib/react-navigation-native-stack';
import ServicesHub from '../screens/Main/ServicesHub';
import { WarrantyStatus } from '../screens/ServiceAndWarrenty/WarrantyStatus';
import ServiceHistory from '../screens/ServiceAndWarrenty/ServiceHistory';
import NearbyPlaces from '../screens/ServiceAndWarrenty/NearbyPlaces';
import CheckChallan from '../screens/ServiceAndWarrenty/CheckChallan';
import ParkingSearchScreen from '../screens/Parking/ParkingSearchScreen';
import ParkingListingDetailScreen from '../screens/Parking/ParkingListingDetailScreen';
import MyParkingBookingsScreen from '../screens/Parking/MyParkingBookingsScreen';
import WashSearchScreen from '../screens/CarWash/WashSearchScreen';
import WashCenterDetailScreen from '../screens/CarWash/WashCenterDetailScreen';
import DoorstepBookingScreen from '../screens/CarWash/DoorstepBookingScreen';
import MyWashBookingsScreen from '../screens/CarWash/MyWashBookingsScreen';

const Stack = createNativeStackNavigator();

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
      <Stack.Screen name="ParkingSearch" component={ParkingSearchScreen} />
      <Stack.Screen name="ParkingListingDetail" component={ParkingListingDetailScreen} />
      <Stack.Screen name="MyParkingBookings" component={MyParkingBookingsScreen} />
      <Stack.Screen name="WashSearch" component={WashSearchScreen} />
      <Stack.Screen name="WashCenterDetail" component={WashCenterDetailScreen} />
      <Stack.Screen name="DoorstepBooking" component={DoorstepBookingScreen} />
      <Stack.Screen name="MyWashBookings" component={MyWashBookingsScreen} />
    </Stack.Navigator>
  );
}
