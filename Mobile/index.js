import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { headlessNotificationListener } from './src/services/notificationExpenseListener';
import { LogLevel, OneSignal } from 'react-native-onesignal';

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
