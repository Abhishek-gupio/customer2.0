/**
 * Seed a wash partner with real wash centers in Bengaluru and Mysuru, plus
 * technicians and upcoming booking slots — so the customer-facing Car Wash
 * search/booking flow has real data to test end-to-end.
 *
 * Idempotent: safe to re-run (upserts by unique phone number, skips centers
 * that already exist by name+partner, skips slots that already exist for a
 * given center+start time).
 *
 * Usage: from Backend/:
 *   npx ts-node src/scripts/seed-carwash-centers.ts
 */
import bcrypt from "bcryptjs";
import { dbInstances } from "@repo/db-customer";

const SALT_ROUNDS = 10;
const PARTNER_PASSWORD = "WashPartner@123";
const TECHNICIAN_PASSWORD = "Technician@123";

/** Doorstep jobs run 8am-8pm; matches carwash.service.ts's own slot-generation window. */
const SLOT_DAY_START_HOUR = 8;
const SLOT_DAY_END_HOUR = 20;
const SLOT_INTERVAL_HOURS = 2;
const SLOT_CAPACITY = 2;
const SLOT_DAYS_AHEAD = 5;

const PARTNER = {
  name: "SparkleWash Car Care",
  phoneNumber: "9900011000",
};

const TECHNICIANS = [
  { name: "Ravi Kumar", phoneNumber: "9900011001" },
  { name: "Suresh Gowda", phoneNumber: "9900011002" },
];

const CENTERS: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}[] = [
  {
    name: "SparkleWash - Indiranagar",
    address: "742, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
    latitude: 12.9784,
    longitude: 77.6408,
  },
  {
    name: "SparkleWash - Koramangala",
    address: "80 Feet Road, Koramangala 4th Block, Bengaluru, Karnataka 560034",
    latitude: 12.9352,
    longitude: 77.6245,
  },
  {
    name: "SparkleWash - Vijayanagar",
    address: "Vijayanagar 2nd Stage, Mysuru, Karnataka 570017",
    latitude: 12.322,
    longitude: 76.6165,
  },
  {
    name: "SparkleWash - Jayalakshmipuram",
    address: "Jayalakshmipuram, Mysuru, Karnataka 570012",
    latitude: 12.3145,
    longitude: 76.6285,
  },
];

async function ensurePartner() {
  const passwordHash = await bcrypt.hash(PARTNER_PASSWORD, SALT_ROUNDS);
  const partner = await dbInstances.washPartner.upsert({
    where: { phoneNumber: PARTNER.phoneNumber },
    update: { name: PARTNER.name, status: "ACTIVE" },
    create: { name: PARTNER.name, phoneNumber: PARTNER.phoneNumber, passwordHash, status: "ACTIVE" },
  });
  console.log(`Partner ready: ${partner.name} (${partner.id}), login ${PARTNER.phoneNumber} / ${PARTNER_PASSWORD}`);
  return partner;
}

async function ensureTechnicians(partnerId: string) {
  const passwordHash = await bcrypt.hash(TECHNICIAN_PASSWORD, SALT_ROUNDS);
  for (const t of TECHNICIANS) {
    const technician = await dbInstances.washTechnician.upsert({
      where: { phoneNumber: t.phoneNumber },
      update: { name: t.name, partnerId, isActive: true },
      create: { name: t.name, phoneNumber: t.phoneNumber, passwordHash, partnerId, isActive: true },
    });
    console.log(`Technician ready: ${technician.name}, login ${t.phoneNumber} / ${TECHNICIAN_PASSWORD}`);
  }
}

async function ensureCenters(partnerId: string) {
  const centers = [];
  for (const c of CENTERS) {
    let center = await dbInstances.washCenter.findFirst({ where: { partnerId, name: c.name } });
    if (!center) {
      center = await dbInstances.washCenter.create({
        data: {
          partnerId,
          name: c.name,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          supportsBike: true,
          supportsCar: true,
          supportsEV: true,
          isActive: true,
        },
      });
      console.log(`Created center: ${center.name}`);
    } else {
      console.log(`Center already exists: ${center.name}`);
    }
    centers.push(center);
  }
  return centers;
}

async function ensureSlotsForCenter(centerId: string) {
  let created = 0;
  for (let dayOffset = 0; dayOffset < SLOT_DAYS_AHEAD; dayOffset++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + dayOffset);
    for (let hour = SLOT_DAY_START_HOUR; hour < SLOT_DAY_END_HOUR; hour += SLOT_INTERVAL_HOURS) {
      const startsAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0));
      if (startsAt.getTime() < Date.now()) continue; // don't create slots in the past
      const endsAt = new Date(startsAt.getTime() + SLOT_INTERVAL_HOURS * 60 * 60 * 1000);

      const existing = await dbInstances.washSlot.findFirst({ where: { centerId, startsAt } });
      if (existing) continue;

      await dbInstances.washSlot.create({
        data: { centerId, startsAt, endsAt, capacity: SLOT_CAPACITY },
      });
      created++;
    }
  }
  return created;
}

async function seed() {
  const partner = await ensurePartner();
  await ensureTechnicians(partner.id);
  const centers = await ensureCenters(partner.id);

  for (const center of centers) {
    const created = await ensureSlotsForCenter(center.id);
    console.log(`Slots for ${center.name}: ${created} created`);
  }

  console.log("\nDone. Bengaluru + Mysuru wash centers are ready for end-to-end testing.");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
