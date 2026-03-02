import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:9000/api/v1';

async function testFullFlow() {
  try {
    console.log('1. Creating a test driver and vehicle...');
    const customer = await prisma.customer.create({
      data: {
        phoneNumber: '+919999999999',
        fullName: 'Test Driver',
      }
    });

    const vehicle = await prisma.customerVehicle.create({
      data: {
        customerId: customer.id,
        registrationNumber: 'DL-TEST-9999',
        isPrimary: true,
      }
    });

    console.log(`Created Driver ID: ${customer.id}`);
    console.log(`Created Vehicle ID: ${vehicle.id}`);

    const JWT_TOKEN = "generate_this_or_mock_linking_directly";

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

    console.log('\n3. Simulating Damoov Webhook receiving a trip...');
    const webhookPayload = {
      "InstanceID": instanceId,
      "TripID": "TEST_TRIP_" + Date.now(),
      "StartDate": Math.floor(Date.now() / 1000) - 1800,
      "EndDate": Math.floor(Date.now() / 1000),
      "Distance": 15.2,
      "Duration": 1800,
      "Score_Overall": 92,
      "Events": [
        {
          "Type": "HARSH_BRAKING",
          "Date": Math.floor(Date.now() / 1000) - 900,
          "Latitude": 28.7041,
          "Longitude": 77.1025,
          "Value": 0.8,
          "Speed": 45
        }
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
      console.log(`Trip details: Distance ${trips[0].distanceKm}km, Score ${trips[0].safetyScore}`);
      console.log(`Found ${trips[0].events.length} events (e.g. ${trips[0].events[0]?.eventType})`);
    }

    const health = await prisma.vehicleHealthScore.findUnique({
      where: { vehicleId: vehicle.id }
    });
    console.log(`Vehicle Health Score auto-calculated: ${health?.drivingScore}`);

    console.log('\n5. Cleaning up test data...');
    await prisma.customer.delete({ where: { id: customer.id } }); // Cascades to vehicle, trips, etc.
    console.log('Cleanup complete.');

  } catch (err: any) {
    console.error('Test failed:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFullFlow();
