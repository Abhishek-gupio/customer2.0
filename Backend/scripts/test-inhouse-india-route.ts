import path from "path";
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

import { dbInstances as prisma } from "@repo/db-customer";
import { telematicsService } from "../src/services/telematics.service";

type RoutePoint = {
  lat: number;
  lon: number;
  speed: number;
};

type ScoreSnapshot = {
  tripId: string;
  safety: number | null;
  confidence: number | null;
  dataConfidence: number | null;
  weightedPenalty: number | null;
};

const DELHI_ROUTE_POINTS: RoutePoint[] = [
  // India Gate -> ITO -> Akshardham corridor (Delhi, India)
  { lat: 28.6129, lon: 77.2295, speed: 32 },
  { lat: 28.6138, lon: 77.2359, speed: 36 },
  { lat: 28.6144, lon: 77.2431, speed: 41 },
  { lat: 28.6147, lon: 77.2498, speed: 44 },
  { lat: 28.6154, lon: 77.2580, speed: 49 },
  { lat: 28.6172, lon: 77.2664, speed: 53 },
  { lat: 28.6191, lon: 77.2748, speed: 47 },
  { lat: 28.6209, lon: 77.2831, speed: 42 },
  { lat: 28.6228, lon: 77.2915, speed: 38 },
  { lat: 28.6245, lon: 77.3002, speed: 34 },
];

async function resolveTargetVehicle() {
  const explicitRegistration = process.env.TARGET_REGISTRATION?.trim().toUpperCase();
  if (explicitRegistration) {
    const vehicle = await prisma.customerVehicle.findFirst({
      where: {
        registrationNumber: {
          equals: explicitRegistration,
          mode: "insensitive",
        },
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!vehicle) {
      throw new Error(`Vehicle not found for TARGET_REGISTRATION=${explicitRegistration}`);
    }
    return vehicle;
  }

  const explicitCustomerId = process.env.DEMO_CUSTOMER_ID?.trim();

  if (explicitCustomerId) {
    const vehicle =
      (await prisma.customerVehicle.findFirst({
        where: { customerId: explicitCustomerId, isActive: true, isPrimary: true },
        orderBy: { updatedAt: "desc" },
      })) ||
      (await prisma.customerVehicle.findFirst({
        where: { customerId: explicitCustomerId, isActive: true },
        orderBy: { updatedAt: "desc" },
      }));

    if (vehicle) return vehicle;

    return prisma.customerVehicle.create({
      data: {
        customerId: explicitCustomerId,
        registrationNumber: `DL-INH-${Date.now().toString().slice(-6)}`,
        isPrimary: true,
      },
    });
  }

  const vehicle =
    (await prisma.customerVehicle.findFirst({
      where: { isActive: true, isPrimary: true },
      orderBy: { updatedAt: "desc" },
    })) ||
    (await prisma.customerVehicle.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }));

  if (vehicle) return vehicle;

  const demoCustomer = await prisma.customer.create({
    data: {
      phoneNumber: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`,
      fullName: "India Route Test User",
    },
  });

  return prisma.customerVehicle.create({
    data: {
      customerId: demoCustomer.id,
      registrationNumber: `DL-INH-${Date.now().toString().slice(-6)}`,
      isPrimary: true,
    },
  });
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readScoreSnapshot(trip: any): ScoreSnapshot | null {
  if (!trip) return null;
  const scores = (trip.scores as Record<string, unknown> | null) || {};
  const stats = (trip.statistics as Record<string, unknown> | null) || {};

  return {
    tripId: String(trip.tripId || trip.id || ""),
    safety: toNumber(scores.Safety) ?? toNumber(trip.safetyScore),
    confidence: toNumber(scores.Confidence),
    dataConfidence: toNumber(stats.DataConfidence),
    weightedPenalty: toNumber(stats.WeightedPenalty),
  };
}

async function run() {
  try {
    const vehicle = await resolveTargetVehicle();
    const previousTrip = await prisma.drivingTrip.findFirst({
      where: {
        vehicleId: vehicle.id,
        tripId: {
          startsWith: "INHOUSE_INDIA_ROUTE_",
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const before = readScoreSnapshot(previousTrip);

    const now = Date.now();
    const stepMs = 4 * 60 * 1000; // 4 mins between points
    const startMs = now - (DELHI_ROUTE_POINTS.length - 1) * stepMs;

    const events = DELHI_ROUTE_POINTS.map((p, idx) => ({
      eventType: "INHOUSE_POINT",
      timestamp: new Date(startMs + idx * stepMs).toISOString(),
      latitude: p.lat,
      longitude: p.lon,
      speed: p.speed,
      severity: null as number | null,
    }));

    // Add a couple of risk events for realistic scoring breakdown.
    events.push({
      eventType: "HARSH_BRAKING",
      timestamp: new Date(startMs + 5 * stepMs).toISOString(),
      latitude: DELHI_ROUTE_POINTS[5].lat,
      longitude: DELHI_ROUTE_POINTS[5].lon,
      speed: 30,
      severity: 0.72,
    });
    events.push({
      eventType: "HARD_ACCELERATION",
      timestamp: new Date(startMs + 7 * stepMs).toISOString(),
      latitude: DELHI_ROUTE_POINTS[7].lat,
      longitude: DELHI_ROUTE_POINTS[7].lon,
      speed: 55,
      severity: 0.61,
    });

    const tripId = `INHOUSE_INDIA_ROUTE_${Date.now()}`;
    const distanceKm = 8.7;
    const durationMin = Math.round(((DELHI_ROUTE_POINTS.length - 1) * stepMs) / 60000);
    const safetyScore = 85;
    const confidence = 0.86;
    const weightedPenalty = 15.1;

    const ingestResult = await telematicsService.ingestInHouseTrip({
      vehicleId: vehicle.id,
      tripId,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(startMs + (DELHI_ROUTE_POINTS.length - 1) * stepMs).toISOString(),
      distanceKm,
      durationMin,
      safetyScore,
      maxSpeed: 58,
      avgSpeed: 33,
      startLocation: {
        Full: "India Gate, New Delhi, India",
        Parts: { City: "New Delhi", Country: "India" },
      },
      endLocation: {
        Full: "Near Akshardham, New Delhi, India",
        Parts: { City: "New Delhi", Country: "India" },
      },
      statistics: {
        Mileage: distanceKm,
        DurationMinutes: durationMin,
        MaxSpeed: 58,
        AverageSpeed: 33,
        BrakingsCount: 1,
        AccelerationsCount: 1,
        SpeedingCount: 0,
        NightMileage: 0,
        DataConfidence: confidence,
        VehicleProfile: "car",
        RawPointCount: events.length,
        ProcessedPointCount: events.length,
        DroppedNoisyPoints: 0,
        InferredSpeedCount: 0,
        WeightedPenalty: weightedPenalty,
      },
      scores: {
        Safety: safetyScore,
        Confidence: confidence,
        Eco: 88,
        EcoFuel: 86,
        EcoTyres: 89,
        EcoBrakes: 87,
      },
      events,
    });

    const trip = await prisma.drivingTrip.findFirst({
      where: { tripId },
      include: { events: true },
    });
    const after = readScoreSnapshot(trip);

    console.log("IN-HOUSE INDIA ROUTE TEST: SUCCESS");
    console.log(`Vehicle ID: ${vehicle.id}`);
    console.log(`Registration: ${vehicle.registrationNumber}`);
    console.log(`Trip ID: ${tripId}`);
    console.log(`Distance: ${distanceKm} km | Duration: ${durationMin} min | Score: ${safetyScore}`);
    console.log(`Events saved: ${trip?.events.length ?? 0}`);
    console.log("");
    console.log("SCORE COMPARISON (Before vs After)");
    if (before) {
      console.log(
        `Before Trip ${before.tripId}: Safety=${before.safety ?? "NA"}, Confidence=${before.confidence ?? "NA"}, DataConfidence=${before.dataConfidence ?? "NA"}, WeightedPenalty=${before.weightedPenalty ?? "NA"}`,
      );
    } else {
      console.log("Before Trip: none");
    }
    if (after) {
      console.log(
        `After  Trip ${after.tripId}: Safety=${after.safety ?? "NA"}, Confidence=${after.confidence ?? "NA"}, DataConfidence=${after.dataConfidence ?? "NA"}, WeightedPenalty=${after.weightedPenalty ?? "NA"}`,
      );
    }
    console.log(`Service result: ${JSON.stringify(ingestResult)}`);
    console.log("Open Mobile app -> Driving Behavior (same account + primary vehicle) to view this route.");
  } catch (error: any) {
    console.error("IN-HOUSE INDIA ROUTE TEST: FAILED");
    console.error(error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
