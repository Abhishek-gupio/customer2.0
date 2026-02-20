import React from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '../lib/react-navigation-native-stack';
import type { RootStackParamList } from './types';
import SplashScreen from '../components/SplashScreen';
// import SigninFirst from '../screens/Auth/Signin_first';
// import Signin from '../screens/Auth/Signin';
// import Signup from '../screens/Auth/Signup';
// import OTP from '../screens/Auth/OTP';
// import LoginSuccessfull from '../screens/Auth/LoginSuccessfull';
import DocumentList from '../screens/Documents/DocumentList';
import UploadDocument from '../screens/Documents/UploadDocument';
import DocumentDetail from '../screens/Documents/DocumentDetail';
import MyProfile from '../screens/Profile/MyProfile';
import HelpSupport from '../screens/Profile/HelpSupport';
import Settings from '../screens/Profile/Settings';
import { MainBottomTabs } from './MainBottomTabs';
// import { ProtectedRoute } from './ProtectedRoute';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainScreen() {
  return <MainBottomTabs />;
}

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
          <SplashScreen
            onComplete={() => {
              navigation.replace('Main', { screen: 'Home' });
            }}
          />
        )}
      </Stack.Screen>
      {/* <Stack.Screen name="SigninFirst" component={SigninFirst} /> */}
      {/* <Stack.Screen name="Signin" component={Signin} /> */}
      {/* <Stack.Screen name="Signup" component={Signup} /> */}
      {/* <Stack.Screen name="OTP" component={OTP} /> */}
      {/* <Stack.Screen name="LoginSuccessfull" component={LoginSuccessfull} /> */}
      <Stack.Screen name="DocumentList" component={DocumentList} />
      <Stack.Screen name="VehicleList" component={VehicleList} />
      <Stack.Screen name="VehicleDetails" component={VehicleDetails} />
      <Stack.Screen name="AddVehicle" component={AddVehicle} />
      <Stack.Screen name="UploadDocument" component={UploadDocument} />
      <Stack.Screen name="DocumentDetail" component={DocumentDetail} />
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="HelpSupport" component={HelpSupport} />
      <Stack.Screen name="Settings" component={Settings} />
    </Stack.Navigator>
  );
}
