import { dbInstances } from "@repo/db-customer";

const db = dbInstances as any;

async function run() {
    const vehicle = await db.customerVehicle.findFirst();
    if (!vehicle) {
        console.log("No primary vehicle found. Creating one...");
        const customer = await db.customer.findFirst();
        if (!customer) { console.log("No customer"); return; }
        const newVeh = await db.customerVehicle.create({
            data: {
                customerId: customer.id,
                registrationNumber: "DL01TEST",
                isPrimary: true
            }
        });
        // upsert telematics
        await db.telematicsDevice.upsert({
            where: { instanceId: "e331f9cd-e3e1-4a47-9d4b-67cf324ed300" },
            update: { vehicleId: newVeh.id, isActive: true },
            create: { vehicleId: newVeh.id, instanceId: "e331f9cd-e3e1-4a47-9d4b-67cf324ed300", isActive: true }
        });
        return;
    }

    await db.telematicsDevice.upsert({
        where: { instanceId: "e331f9cd-e3e1-4a47-9d4b-67cf324ed300" },
        update: {
            vehicleId: vehicle.id,
            isActive: true,
        },
        create: {
            vehicleId: vehicle.id,
            instanceId: "e331f9cd-e3e1-4a47-9d4b-67cf324ed300",
            deviceToken: "test_token",
            platform: "android",
            isActive: true,
        }
    });

    console.log("Success! Vehicle linked to TelematicsDevice:", vehicle.id);

    // also add multiple trips so the dashboard looks nice
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
