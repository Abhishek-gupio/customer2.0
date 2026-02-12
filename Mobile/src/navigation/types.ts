import type { NavigatorScreenParams } from '../lib/react-navigation-native';

export type RootStackParamList = {
  Splash: undefined;
  SigninFirst: undefined;
  Signin: undefined;
  Signup: undefined;
  OTP: { phone?: string; otp?: string };
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type MainTabParamList = {
  Home: undefined;
  Notifications: undefined;
  More: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
