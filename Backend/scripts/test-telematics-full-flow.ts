import path from 'path';
import axios from 'axios';
// Load Backend .env for DATABASE_URL, DAMOOV_WEBHOOK_SECRET, DEMO_CUSTOMER_ID, CLEANUP_DEMO
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

import { dbInstances as prisma } from '@repo/db-customer';

const API_URL = process.env.API_URL || 'http://localhost:9000/api/v1';
const DEMO_CUSTOMER_ID = process.env.DEMO_CUSTOMER_ID; // If set, create vehicle+trip under this user so it shows in their Driving Behavior
const CLEANUP_DEMO = process.env.CLEANUP_DEMO === '1' || process.env.CLEANUP_DEMO === 'true';

async function testFullFlow() {
  try {
    let customer: { id: string };
    let vehicle: { id: string };

    if (DEMO_CUSTOMER_ID) {
      console.log('1. Using existing customer (DEMO_CUSTOMER_ID)...');
      customer = await prisma.customer.findUniqueOrThrow({
        where: { id: DEMO_CUSTOMER_ID },
        select: { id: true },
      });
      // Make this demo vehicle primary so Driving Behavior shows its trips
      await prisma.customerVehicle.updateMany({
        where: { customerId: customer.id },
        data: { isPrimary: false },
      });
      vehicle = await prisma.customerVehicle.create({
        data: {
          customerId: customer.id,
          registrationNumber: 'DL-DEMO-100KM',
          isPrimary: true,
        }
      });
      console.log(`Customer ID: ${customer.id}, Created Vehicle ID: ${vehicle.id} (set as primary)`);
    } else {
      console.log('1. Creating a test driver and vehicle...');
      customer = await prisma.customer.create({
        data: {
          phoneNumber: '+919999999999',
          fullName: 'Test Driver',
        }
      });
      vehicle = await prisma.customerVehicle.create({
        data: {
          customerId: customer.id,
          registrationNumber: 'DL-TEST-9999',
          isPrimary: true,
        }
      });
      console.log(`Created Driver ID: ${customer.id}`);
      console.log(`Created Vehicle ID: ${vehicle.id}`);
    }

    // Simulating the Mobile app link logic directly in DB since we can't easily mock the mobile JWT here without a full login flow
    const deviceToken = "mock_device_token_from_damoov_" + Date.now();
    const instanceId = deviceToken;

    console.log('\n2. Simulating Mobile App linking to vehicle...');
    await prisma.telematicsDevice.create({
      data: {
        vehicleId: vehicle.id,
        instanceId: instanceId,
        deviceToken: deviceToken,
        platform: 'ios',
        isActive: true
      }
    });

    console.log(`Device linked. Instance ID: ${instanceId}`);

    console.log('\n3. Simulating Damoov Webhook receiving a 100km trip...');
    const nowSec = Math.floor(Date.now() / 1000);
    const webhookPayload = {
      "InstanceID": instanceId,
      "TripID": "TEST_TRIP_100KM_" + Date.now(),
      "StartDate": nowSec - 3600,
      "EndDate": nowSec,
      "Distance": 100,
      "Duration": 3600,
      "Score_Overall": 87,
      "Events": [
        { "Type": "HARSH_BRAKING", "Date": nowSec - 1800, "Latitude": 28.7041, "Longitude": 77.1025, "Value": 0.6, "Speed": 52 },
        { "Type": "HARSH_ACCELERATION", "Date": nowSec - 900, "Latitude": 28.7120, "Longitude": 77.1080, "Value": 0.5, "Speed": 30 }
      ]
    };

    const webhookRes = await axios.post(`${API_URL}/telematics/webhook`, webhookPayload, {
      headers: {
        'x-damoov-signature': process.env.DAMOOV_WEBHOOK_SECRET || 'test_secret_123'
      }
    });

    console.log('Webhook Response:', webhookRes.data);

    // Give it a moment to save since the controller fires the service which returns async
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n4. Verifying Database Records...');
    const trips = await prisma.drivingTrip.findMany({
      where: { vehicleId: vehicle.id },
      include: { events: true }
    });

    console.log(`Found ${trips.length} trips in DB.`);
    if (trips.length > 0) {
      console.log(`Trip details: Distance ${trips[0].distanceKm} km, Score ${trips[0].safetyScore}`);
      console.log(`Found ${trips[0].events.length} events (e.g. ${trips[0].events[0]?.eventType})`);
    }

    const health = await prisma.vehicleHealthScore.findUnique({
      where: { vehicleId: vehicle.id }
    });
    console.log(`Vehicle Health Score auto-calculated: ${health?.drivingScore}`);

    if (CLEANUP_DEMO && !DEMO_CUSTOMER_ID) {
      console.log('\n5. Cleaning up test data (CLEANUP_DEMO=1)...');
      await prisma.customer.delete({ where: { id: customer.id } });
      console.log('Cleanup complete.');
    } else {
      console.log('\n5. Demo data kept in DB (no cleanup).');
      if (DEMO_CUSTOMER_ID) {
        console.log('   Open the app (logged in as this account) → Driving Behavior to see the 100 km trip.');
      } else {
        console.log('   To see this trip in the app: set DEMO_CUSTOMER_ID=<your-customer-id> in Backend/.env and re-run,');
        console.log('   or log in with phone +919999999999 (test driver).');
      }
    }

  } catch (err: any) {
    console.error('Test failed:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFullFlow();
