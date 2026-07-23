import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { connectAndJoin } from '../services/realtime/socketClient';
import { useParkingStore } from '../store/parkingStore';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '../lib/react-navigation-native-stack';
import HeyGupioOverlay from '../components/HeyGupioOverlay';
import ErrorBoundary from '../components/ErrorBoundary';
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
import TermsConditions from '../screens/Profile/TermsConditions';
import PrivacyPolicy from '../screens/Profile/PrivacyPolicy';
import LiveChat from '../screens/Profile/LiveChat';
import ContactSupport from '../screens/Profile/ContactSupport';
import TicketHistory from '../screens/Profile/TicketHistory';
import TicketDetail from '../screens/Profile/TicketDetail';
import Settings from '../screens/Profile/Settings';
import DigiLockerKYC from '../screens/Documents/DigiLockerKYC';
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
import ValetService from '../screens/Main/ValetService';
import VehicleSearch from '../screens/Main/VehicleSearch';
import TripExpenseScreen from '../screens/Other/TripExpenseScreen';
import TripPlannerInsightsScreen from '../screens/Other/TripPlannerInsightsScreen';
import DLVerification from '../screens/ServiceAndWarrenty/DLVerification';
import Fastag from '../screens/ServiceAndWarrenty/Fastag';
import DIYGuides from '../screens/ServiceAndWarrenty/DIYGuides';
import InboxScreen from '../screens/Messaging/InboxScreen';
import ScanQrScreen from '../screens/Messaging/ScanQrScreen';
import ChatScreen from '../screens/Messaging/ChatScreen';
import MyQrCodeScreen from '../screens/Messaging/MyQrCodeScreen';
import GuestConversationScreen from '../screens/Messaging/GuestConversationScreen';
import CommunityFeedScreen from '../screens/Community/CommunityFeedScreen';
import CommunitiesDiscoverScreen from '../screens/Community/CommunitiesDiscoverScreen';
import PostComposerScreen from '../screens/Community/PostComposerScreen';
import PostDetailScreen from '../screens/Community/PostDetailScreen';
import { store } from '../store';
import { withErrorBoundary } from '../components/withErrorBoundary';

const Stack = createNativeStackNavigator<RootStackParamList>();

const DocumentListScreen = withErrorBoundary(DocumentList, {
  boundaryName: 'documents-document-list',
  fallbackTitle: 'Documents could not load',
  fallbackMessage:
    'Retry the document locker or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const DigiLockerKYCScreen = withErrorBoundary(DigiLockerKYC, {
  boundaryName: 'documents-digilocker-kyc',
  fallbackTitle: 'DigiLocker verification could not load',
  fallbackMessage:
    'Retry the DigiLocker flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const ExpensesListScreen = withErrorBoundary(ExpensesList, {
  boundaryName: 'payments-expenses-list',
  fallbackTitle: 'Expenses could not load',
  fallbackMessage:
    'Retry the expense view or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const AddExpenseScreen = withErrorBoundary(addExpense, {
  boundaryName: 'payments-add-expense',
  fallbackTitle: 'Expense entry could not load',
  fallbackMessage:
    'Retry the payment entry flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const BudgetSettingsScreen = withErrorBoundary(BudgetSettings, {
  boundaryName: 'payments-budget-settings',
  fallbackTitle: 'Budget settings could not load',
  fallbackMessage:
    'Retry the budget settings flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const ExpenseAnalyticsScreen = withErrorBoundary(ExpenseAnalytics, {
  boundaryName: 'payments-expense-analytics',
  fallbackTitle: 'Expense analytics could not load',
  fallbackMessage:
    'Retry the analytics view or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const ChallansScreen = withErrorBoundary(Challans, {
  boundaryName: 'payments-challans',
  fallbackTitle: 'Challan payments could not load',
  fallbackMessage:
    'Retry the challan flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const FastagScreen = withErrorBoundary(Fastag, {
  boundaryName: 'payments-fastag',
  fallbackTitle: 'Fastag payments could not load',
  fallbackMessage:
    'Retry the Fastag flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const DLVerificationScreen = withErrorBoundary(DLVerification, {
  boundaryName: 'payments-dl-verification',
  fallbackTitle: 'Driving licence verification could not load',
  fallbackMessage:
    'Retry the licence verification flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const AiBotHomeScreen = withErrorBoundary(AiBotHome, {
  boundaryName: 'chat-ai-bot-home',
  fallbackTitle: 'AI chat home could not load',
  fallbackMessage:
    'Retry the AI assistant flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const ChatSessionsBoundaryScreen = withErrorBoundary(ChatSessionsScreen, {
  boundaryName: 'chat-sessions',
  fallbackTitle: 'Chat sessions could not load',
  fallbackMessage:
    'Retry the chat session list or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const DrivingSummaryScreen = withErrorBoundary(DrivingSummary, {
  boundaryName: 'telematics-driving-summary',
  fallbackTitle: 'Driving summary could not load',
  fallbackMessage:
    'Retry the driving insights flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const DrivingTimelineScreen = withErrorBoundary(DrivingTimeline, {
  boundaryName: 'telematics-driving-timeline',
  fallbackTitle: 'Driving timeline could not load',
  fallbackMessage:
    'Retry the trip timeline or refresh this section. If the issue keeps happening, report it with the correlation id.',
});

const TripDetailScreen = withErrorBoundary(TripDetail, {
  boundaryName: 'telematics-trip-detail',
  fallbackTitle: 'Trip details could not load',
  fallbackMessage:
    'Retry the trip detail flow or refresh this section. If the issue keeps happening, report it with the correlation id.',
});


export function RootNavigator() {
  const [overlayResetKey, setOverlayResetKey] = React.useState(0);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const notifyBookingChanged = useParkingStore((s) => s.notifyBookingChanged);

  // A booking-confirmed push/notification was previously wired all the way
  // to the server emitting it and to a real FCM push landing on the device —
  // but nothing on the client ever turned that into a UI update. The
  // in-app copy right after checkout literally promises "it'll show as
  // Confirmed in a few seconds"; without this, the only thing that actually
  // delivered on that promise was the customer manually pulling to refresh.
  // Wired here (not inside a specific screen) so it fires regardless of
  // which screen the customer is looking at when the webhook lands —
  // notably including the payment-processing screen itself.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const socket = connectAndJoin(user.id);
    const onNewNotification = (notif: { type?: string; metadata?: { bookingId?: string } }) => {
      if (notif?.type === 'PARKING') {
        notifyBookingChanged(notif.metadata?.bookingId);
      }
    };
    socket.on('new_notification', onNewNotification);
    return () => {
      socket.off('new_notification', onNewNotification);
    };
  }, [isAuthenticated, user?.id, notifyBookingChanged]);

  return (
    <View style={{ flex: 1 }}>
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash">
        {({ navigation }: NativeStackScreenProps<RootStackParamList, 'Splash'>) => (
          <SplashScreen
            onComplete={() => {
              const { isAuthenticated } = store.getState().auth;
              if (isAuthenticated) {
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
      <Stack.Screen name="DocumentList" component={DocumentListScreen} />
      <Stack.Screen name="DigiLockerKYC" component={DigiLockerKYCScreen} />
      <Stack.Screen name="Valet" component={ValetService} />

      {/* All vehicle screens are handled internally by GupioGarageApp */}
      <Stack.Screen name="VehicleList" component={GupioGarageApp} />
      <Stack.Screen name="VehicleDetails" component={GupioGarageApp} />
      <Stack.Screen name="AddVehicle" component={GupioGarageApp} />
      <Stack.Screen name="Challans" component={ChallansScreen} />
      <Stack.Screen name="Main" component={MainBottomTabs} />
      <Stack.Screen name="Expenses" component={ExpensesListScreen} />
      <Stack.Screen name="addExpense" component={AddExpenseScreen} options={{ presentation: 'transparentModal' }} />
      <Stack.Screen name="MyProfile" component={MyProfile} />
      <Stack.Screen name="HelpSupport" component={HelpSupport} />
      <Stack.Screen name="TermsConditions" component={TermsConditions} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      <Stack.Screen name="LiveChat" component={LiveChat} />
      <Stack.Screen name="ContactSupport" component={ContactSupport} />
      <Stack.Screen name="TicketHistory" component={TicketHistory} />
      <Stack.Screen name="TicketDetail" component={TicketDetail} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="BudgetSettings" component={BudgetSettings} options={{ presentation: 'transparentModal' }} />
      <Stack.Screen name="ExpenseAnalytics" component={ExpenseAnalytics} />
      <Stack.Screen name="ServiceHistory" component={ServiceHistory} />
      <Stack.Screen name="WarrantyStatus" component={WarrantyStatus} />
      <Stack.Screen name="AiBotHome" component={AiBotHomeScreen} />
      <Stack.Screen name="ChatSessions" component={ChatSessionsBoundaryScreen} />

      <Stack.Screen name="DrivingSummary" component={DrivingSummaryScreen} />
      <Stack.Screen name="DrivingTimeline" component={DrivingTimelineScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="Alerts" component={Alerts} />
      <Stack.Screen name="SOS" component={SOSButton} />
      <Stack.Screen name="ActiveSOS" component={ActiveSOS} />
      <Stack.Screen name="VehicleSearch" component={VehicleSearch} />
      <Stack.Screen name="TripExpense" component={TripExpenseScreen} />
      <Stack.Screen name="TripPlannerInsights" component={TripPlannerInsightsScreen} />
      <Stack.Screen name="DLVerification" component={DLVerificationScreen} />
      <Stack.Screen name="Fastag" component={FastagScreen} />
      <Stack.Screen name="VehicleInbox" component={InboxScreen} />
      <Stack.Screen name="ScanQr" component={ScanQrScreen} />
      <Stack.Screen name="ChatConversation" component={ChatScreen} />
      <Stack.Screen name="MyVehicleQrCode" component={MyQrCodeScreen} />
      <Stack.Screen name="GuestConversation" component={GuestConversationScreen} />
      <Stack.Screen name="CommunityFeed" component={CommunityFeedScreen} />
      <Stack.Screen name="CommunitiesDiscover" component={CommunitiesDiscoverScreen} />
      <Stack.Screen name="PostComposer" component={PostComposerScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
    </Stack.Navigator>
    <ErrorBoundary
      level="widget"
      boundaryName="chat-hey-gupio-overlay"
      fallbackTitle="Assistant overlay is unavailable"
      fallbackMessage="You can keep using the app normally. Retry the overlay or report the issue if it keeps happening."
      onRetry={() => {
        setOverlayResetKey(current => current + 1);
      }}
      onSoftRefresh={() => {
        setOverlayResetKey(current => current + 1);
      }}
    >
      <HeyGupioOverlay key={overlayResetKey} />
    </ErrorBoundary>
    </View>
  );
}
