import React from 'react';
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
import DocumentList from '../screens/Documents/DocumentList';
import UploadDocument from '../screens/Documents/UploadDocument';
import DocumentDetail from '../screens/Documents/DocumentDetail';
import MyProfile from '../screens/Profile/MyProfile';
import HelpSupport from '../screens/Profile/HelpSupport';
import Settings from '../screens/Profile/Settings';
import VehicleList from '../screens/Vehicles/VehicleList';
import VehicleDetails from '../screens/Vehicles/VehicleDetails';
import AddVehicle from '../screens/Vehicles/AddVehicle';
import Challans from '../screens/Vehicles/Challans';
import { MainBottomTabs } from './MainBottomTabs';
import ExpensesList from '../screens/Expenses/ExpenseList';
import addExpense from '../screens/Expenses/AddExpense';
import ExpenseAnalytics from '../screens/Expenses/ExpenseAnalytics';
import BudgetSettings from '../screens/Expenses/BudgetSettings';
import ServiceHistory from '../screens/ServiceAndWarrenty/ServiceHistory';
import { WarrantyStatus } from '../screens/ServiceAndWarrenty/WarrantyStatus';
// import AiBotHome from '../screens/AiBot/HomeScreen';
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
        {({ navigation }: NativeStackScreenProps<RootStackParamList, 'Splash'>) => (
          <SplashScreen
            onComplete={() => {
              navigation.replace('SigninFirst');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SigninFirst" component={SigninFirst} />
      <Stack.Screen name="Signin" component={Signin} />
      <Stack.Screen name="Signup" component={Signup} />
      <Stack.Screen name="OTP" component={OTP} />
      <Stack.Screen name="LoginSuccessfull" component={LoginSuccessfull} />
      <Stack.Screen name="DocumentList" component={DocumentList} />
      <Stack.Screen name="VehicleList" component={VehicleList} />
      <Stack.Screen name="VehicleDetails" component={VehicleDetails} />
      <Stack.Screen name="AddVehicle" component={AddVehicle} />
      <Stack.Screen name="Challans" component={Challans} />
      <Stack.Screen name="UploadDocument" component={UploadDocument} />
      <Stack.Screen name="DocumentDetail" component={DocumentDetail} />
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="Expenses" component={ExpensesList} />
      <Stack.Screen name="addExpense" component={addExpense} options={{
        presentation: 'transparentModal',
      }} />

      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="HelpSupport" component={HelpSupport} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="BudgetSettings" component={BudgetSettings} options={{
        presentation: 'transparentModal',
      }} />
      <Stack.Screen name="ExpenseAnalytics" component={ExpenseAnalytics} />
      <Stack.Screen name="ServiceHistory" component={ServiceHistory} />
      <Stack.Screen name="WarrantyStatus" component={WarrantyStatus} />

      {/* <Stack.Screen name="AiBotHome" component={AiBotHome} /> */}


    </Stack.Navigator>
  );
}
