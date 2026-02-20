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
  UploadDocument: undefined;
  DocumentDetail: { documentId: string };
  Expenses: undefined;
  addExpense: undefined;
  ExpenseAnalytics: undefined;
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
    interface RootParamList extends RootStackParamList {}
  }
}

export type BillStatus = "verified" | "pending";

export interface Bill {
  id: string;
  title: string;
  amount: number;
  status: BillStatus;
  uploadedAt: string;
  warrantyMonths?: number | null;
  image?: string | number | null; // string = remote, number = local require()
}
