/**
 * Demo: Send a 100km Damoov trip webhook to the local Backend.
 * Run with: node scripts/demo-damoov-100km.js
 * Requires: Backend running (e.g. pnpm run dev), and a TelematicsDevice
 * linked with the same instanceId (link via app or test-telematics-full-flow).
 *
 * Uses Backend/.env for DAMOOV_WEBHOOK_SECRET and optionally DEMO_INSTANCE_ID.
 * If DEMO_INSTANCE_ID is not set, uses DAMOOV_INSTANCE_ID (for testing with your Damoov account).
 */
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const WEBHOOK_URL = process.env.TELEMATICS_WEBHOOK_URL || 'http://localhost:9000/api/v1/telematics/webhook';
const SECRET = process.env.DAMOOV_WEBHOOK_SECRET || 'test_secret_123';
const INSTANCE_ID = process.env.DEMO_INSTANCE_ID || process.env.DAMOOV_INSTANCE_ID || 'demo-100km-' + Date.now();

const now = Math.floor(Date.now() / 1000);
const oneHourAgo = now - 3600;

const payload = {
  InstanceID: INSTANCE_ID,
  TripID: 'DEMO_100KM_' + Date.now(),
  StartDate: oneHourAgo,
  EndDate: now,
  Distance: 100,
  Duration: 3600,
  Score_Overall: 87,
  Events: [
    { Type: 'HARSH_BRAKING', Date: now - 1800, Latitude: 28.7041, Longitude: 77.1025, Value: 0.6, Speed: 52 },
    { Type: 'HARSH_ACCELERATION', Date: now - 900, Latitude: 28.7120, Longitude: 77.1080, Value: 0.5, Speed: 30 },
  ],
};

async function run() {
  console.log('Damoov 100km demo – sending webhook to', WEBHOOK_URL);
  console.log('InstanceID:', INSTANCE_ID);
  console.log('Payload: Distance 100 km, Duration 1h, Score 87, 2 events\n');

  try {
    const res = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-damoov-signature': SECRET,
      },
      timeout: 10000,
    });
    console.log('Response status:', res.status);
    console.log('Response data:', JSON.stringify(res.data, null, 2));
    if (res.data?.data?.status === 'success') {
      console.log('\nDamoov webhook accepted. Trip saved. Check Driving Behavior / Trips in the app.');
    } else if (res.data?.data?.status === 'ignored') {
      console.log('\nWebhook accepted but device not found. Link a device with instanceId:', INSTANCE_ID);
      console.log('(e.g. run scripts/test-telematics-full-flow.ts once to create test data, or use DEMO_INSTANCE_ID from your app.)');
    }
  } catch (err) {
    if (err.response) {
      console.error('Error response:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
    console.error('\nEnsure Backend is running (pnpm run dev) and DAMOOV_WEBHOOK_SECRET matches.');
    process.exit(1);
  }
}

run();
