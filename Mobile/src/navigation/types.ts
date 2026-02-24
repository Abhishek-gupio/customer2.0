import type { NavigatorScreenParams } from '../lib/react-navigation-native';

export type RootStackParamList = {
  Splash: undefined;
  SigninFirst: undefined;
  Signin: undefined;
  Signup: undefined;
  OTP: { phone?: string; otp?: string };
  LoginSuccessfull: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  DocumentList: undefined;
  VehicleList: undefined;
  VehicleDetails: { vehicleId: string };
  AddVehicle: undefined;
  Challans: { vehicle: any };
  UploadDocument: undefined;
  DocumentDetail: { documentId: string };
  Expenses: undefined;
  AddExpense: undefined;
  ExpenseAnalytics: undefined;
  ServiceHistory: undefined;
  WarrantyStatus: undefined;
  OptionModal: undefined;
  Analytics: undefined;
  MyProfile: undefined;
  HelpSupport: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  AIAssistant: undefined;
  Alerts: undefined;
  History: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}


export interface Bill {
  id: string;
  title: string;
  amount: number;
  uploadedAt: string;
  warrantyMonths?: number | null;
  image?: string | number | null; // string = remote, number = local require()
}


export interface Bill {
  id: string;
  title: string;
  amount: number;
  uploadedAt: string;
  warrantyMonths?: number | null;
  image?: string | number | null; // string = remote, number = local require()
}
