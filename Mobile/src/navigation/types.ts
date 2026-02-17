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
  UploadDocument: undefined;
  DocumentDetail: { documentId: string };
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
