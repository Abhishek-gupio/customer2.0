/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { headlessNotificationListener } from './src/services/notificationExpenseListener';

AppRegistry.registerComponent(appName, () => App);

// Register headless task for background notification listening (Android only)
AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener,
);
