/**
 * Headless JS Task for processing notifications in the background.
 *
 * This function is registered in `index.js` and is triggered by the
 * `react-native-android-notification-listener` native service even
 * when the app is closed.
 */
import { AppRegistry } from 'react-native';
import { api } from './api';
import { getAutoExpenseEnabled } from './storage';

const NOTIFICATION_SOURCE = 'NOTIFICATION';

const notificationHandler = async (notification) => {
    
  console.log('HeadlessJS: Received notification:', notification);

  // 1. Check if the feature is enabled by the user
  const isEnabled = getAutoExpenseEnabled();
  if (!isEnabled) {
    console.log('HeadlessJS: Auto-expense is disabled. Skipping.');
    return;
  }

  // 2. Extract relevant data
  const text = notification?.text || '';
  const timestamp = new Date(notification?.time || Date.now()).toISOString();

  if (!text) return;

  // 3. Send to backend for parsing (fire and forget)
  try {
    await api.post('/v1/expenses/parse/text', { text, source: NOTIFICATION_SOURCE, timestamp });
    console.log('HeadlessJS: Notification sent to backend for parsing.');
  } catch (error) {
    console.error('HeadlessJS: Failed to send notification to backend.', error);
  }
};

AppRegistry.registerHeadlessTask('notificationHandler', () => notificationHandler);