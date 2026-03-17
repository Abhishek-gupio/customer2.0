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

let cachedPrimaryVehicleId = null;
let lastPrimaryVehicleFetch = 0;
const PRIMARY_VEHICLE_TTL_MS = 5 * 60 * 1000;

async function getPrimaryVehicleId() {
  const now = Date.now();
  if (cachedPrimaryVehicleId && now - lastPrimaryVehicleFetch < PRIMARY_VEHICLE_TTL_MS) {
    return cachedPrimaryVehicleId;
  }

  try {
    const data = await api.get('/v1/vehicles');
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const primary = list.find((v) => v?.isPrimary) || list[0];
    cachedPrimaryVehicleId = primary?.id ?? null;
    lastPrimaryVehicleFetch = now;
    return cachedPrimaryVehicleId;
  } catch {
    return null;
  }
}


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
    const vehicleId = await getPrimaryVehicleId();
    await api.post('/v1/expenses/parse/text', { text, source: NOTIFICATION_SOURCE, timestamp, ...(vehicleId ? { vehicleId } : {}) });
    console.log('HeadlessJS: Notification sent to backend for parsing.');
  } catch (error) {
    console.error('HeadlessJS: Failed to send notification to backend.', error);
  }
};

AppRegistry.registerHeadlessTask('notificationHandler', () => notificationHandler);