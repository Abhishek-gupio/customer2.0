import 'react-native-gesture-handler';
import { AppRegistry, NativeModules } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { headlessNotificationListener } from './src/services/notificationExpenseListener';
import { LogLevel, OneSignal } from 'react-native-onesignal';

// Initialize screens
enableScreens();

// Polyfill for legacy native modules that haven't updated to the new NativeEventEmitter requirements
// specifically for @react-native-voice/voice
if (NativeModules.Voice && !NativeModules.Voice.addListener) {
    NativeModules.Voice.addListener = () => { };
    NativeModules.Voice.removeListeners = () => { };
}

AppRegistry.registerComponent(appName, () => App);

// Initialize OneSignal
// Note: In production, store this App ID in .env
OneSignal.Debug.setLogLevel(LogLevel.Verbose);
OneSignal.initialize("YOUR_ONESIGNAL_APP_ID");
OneSignal.Notifications.requestPermission(true);

// Register headless task for background notification listening (Android only)
AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener,
);
