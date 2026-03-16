import type { NavigatorScreenParams } from '../lib/react-navigation-native';

export type RootStackParamList = {
  Splash: undefined;
  SigninFirst: undefined;
  Signin: undefined;
  Signup: undefined;
  OTP: { phone?: string; otp?: string; otpExpiresIn?: number };
  LoginSuccessfull: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  DocumentList: undefined;
  VehicleList: undefined;
  VehicleDetails: { vehicleId: string };
  AddVehicle: undefined;
  Challans: { vehicle: any };
  Expenses: undefined;
  addExpense: undefined;
  ExpenseAnalytics: undefined;
  MyProfile: undefined;
  HelpSupport: undefined;
  LiveChat: undefined;
  ContactSupport: { category?: string };
  TicketHistory: undefined;
  TicketDetail: { ticketId: string };
  Settings: undefined;
  BudgetSettings: undefined;
  ServiceHistory: undefined;
  WarrantyStatus: undefined;
  AiBotHome: undefined;
  ChatSessions: undefined;
  DrivingSummary: undefined;
  DrivingTimeline: undefined;
  TripDetail: { tripId: string };
  SOSButton: undefined;
  Alerts: undefined;
  Odometer: undefined;
  // AiBotChat: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Services: undefined;
  AIAssistant: {
    userMessage?: string;
    sessionId?: string;
  } | undefined;
  Alerts: undefined;
  Odometer: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}

export type BillStatus = "verified" | "pending";

export interface Bill {
  id: string;
  title: string;
  amount: number;
  status: BillStatus;
  createdAt?: string;
  updatedAt?: string;
  uploadedAt: string;
  warrantyMonths?: number | null;
  image?: string | number | null; // string = remote, number = local require()
}
