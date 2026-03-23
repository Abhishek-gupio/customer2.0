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
import MyProfile from '../screens/Profile/MyProfile';
import HelpSupport from '../screens/Profile/HelpSupport';
import LiveChat from '../screens/Profile/LiveChat';
import ContactSupport from '../screens/Profile/ContactSupport';
import TicketHistory from '../screens/Profile/TicketHistory';
import TicketDetail from '../screens/Profile/TicketDetail';
import Settings from '../screens/Profile/Settings';
import GupioGarageApp from '../screens/Vehicles/GupioGarageApp';
// NOTE: VehicleDetails and AddVehicle are self-contained inside GupioGarageApp.
// Do not register them as separate stack screens — all vehicle navigation is
// handled internally by GupioGarageApp's own screen state machine.
import Challans from '../screens/Vehicles/Challans';
import { MainBottomTabs } from './MainBottomTabs';
import ExpensesList from '../screens/Expenses/ExpenseList';
import addExpense from '../screens/Expenses/AddExpense';
import ExpenseAnalytics from '../screens/Expenses/ExpenseAnalytics';
import BudgetSettings from '../screens/Expenses/BudgetSettings';
import ServiceHistory from '../screens/ServiceAndWarrenty/ServiceHistory';
import { WarrantyStatus } from '../screens/ServiceAndWarrenty/WarrantyStatus';
import AiBotHome from '../screens/AiBot/HomeScreen';
import ChatSessionsScreen from '../screens/AiBot/ChatSessionsScreen';
import DrivingSummary from '../screens/Telematics/DrivingSummary';
import DrivingTimeline from '../screens/Telematics/DrivingTimeline';
import TripDetail from '../screens/Telematics/TripDetail';
import SOSButton from '../components/SOSButton';
import ActiveSOS from '../screens/Profile/ActiveSOS';
import Alerts from '../screens/Main/Alerts';

const Stack = createNativeStackNavigator<RootStackParamList>();


export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash">
        {({ navigation }: NativeStackScreenProps<RootStackParamList, 'Splash'>) => (
          <SplashScreen
            onComplete={() => navigation.replace('SigninFirst')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SigninFirst" component={SigninFirst} />
      <Stack.Screen name="Signin" component={Signin} />
      <Stack.Screen name="Signup" component={Signup} />
      <Stack.Screen name="OTP" component={OTP} />
      <Stack.Screen name="LoginSuccessfull" component={LoginSuccessfull} />
      <Stack.Screen name="DocumentList" component={DocumentList} />

      {/* All vehicle screens are handled internally by GupioGarageApp */}
      <Stack.Screen name="VehicleList" component={GupioGarageApp} />
      <Stack.Screen name="VehicleDetails" component={GupioGarageApp} />
      <Stack.Screen name="AddVehicle" component={GupioGarageApp} />
      <Stack.Screen name="Challans" component={Challans} />
      <Stack.Screen name="Main" component={MainBottomTabs} />
      <Stack.Screen name="Expenses" component={ExpensesList} />
      <Stack.Screen name="addExpense" component={addExpense} options={{ presentation: 'transparentModal' }} />
      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="HelpSupport" component={HelpSupport} />
      <Stack.Screen name="LiveChat" component={LiveChat} />
      <Stack.Screen name="ContactSupport" component={ContactSupport} />
      <Stack.Screen name="TicketHistory" component={TicketHistory} />
      <Stack.Screen name="TicketDetail" component={TicketDetail} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="BudgetSettings" component={BudgetSettings} options={{ presentation: 'transparentModal' }} />
      <Stack.Screen name="ExpenseAnalytics" component={ExpenseAnalytics} />
      <Stack.Screen name="ServiceHistory" component={ServiceHistory} />
      <Stack.Screen name="WarrantyStatus" component={WarrantyStatus} />
      <Stack.Screen name="AiBotHome" component={AiBotHome} />
      <Stack.Screen name="ChatSessions" component={ChatSessionsScreen} />

      <Stack.Screen name="DrivingSummary" component={DrivingSummary} />
      <Stack.Screen name="DrivingTimeline" component={DrivingTimeline} />
      {/* <Stack.Screen name="TripDetail" component={TripDetail} /> */}
      <Stack.Screen name="SOS" component={SOSButton} />
      <Stack.Screen name="ActiveSOS" component={ActiveSOS} />
    </Stack.Navigator>
  );
}
