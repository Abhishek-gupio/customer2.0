import type { NavigatorScreenParams } from '../lib/react-navigation-native';

export type RootStackParamList = {
  Splash: undefined;
  SigninFirst: undefined;
  Signin: undefined;
  Signup: undefined;
  OTP: { phone?: string; otp?: string; otpExpiresIn?: number };
  LoginSuccessfull: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Valet: undefined;
  DocumentList: undefined;
  VehicleList: undefined;
  VehicleDetails: { vehicleId: string; initialTab?: 'Alerts' | 'Details' };
  AddVehicle: { registrationNumber?: string };
  VehicleSearch: undefined;
  Challans: { vehicle: any };
  Expenses: undefined;
  addExpense: undefined;
  ExpenseAnalytics: undefined;
  MyProfile: undefined;
  HelpSupport: undefined;
  TermsConditions: undefined;
  PrivacyPolicy: undefined;
  LiveChat: undefined;
  ContactSupport: { category?: string };
  TicketHistory: undefined;
  TicketDetail: { ticketId: string };
  DigiLockerKYC: { url: string; client_id: string };
  Settings: undefined;
  BudgetSettings: undefined;
  ServiceHistory: { selectedPartType?: string } | undefined;
  WarrantyStatus: undefined;
  AiBotHome: undefined;
  ChatSessions: undefined;
  DrivingSummary: undefined;
  DrivingTimeline: undefined;
  TripDetail: { tripId: string };
  Alerts: undefined;
  SOS: undefined;
  ActiveSOS: { sosId: string; type: string; lat: number; lon: number };
  TripExpense: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  my_garage: undefined;
  Services: undefined;
  AIAssistant: {
    userMessage?: string;
    sessionId?: string;
  } | undefined;
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
