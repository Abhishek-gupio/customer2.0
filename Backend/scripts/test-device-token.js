const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function main() {
    try {
        const device = await prisma.telematicsDevice.findFirst({ where: { isActive: true, deviceToken: { not: null } } });
        if (!device) {
            console.log("No device with token found");
            return;
        }
        console.log("Found device token:", device.deviceToken);

        // Testing mobile API approach
        const res = await axios.get('https://mobilesdk.telematicssdk.com/mobilesdk/stage/track/get_short_list/v1', {
            headers: {
                'DeviceToken': device.deviceToken,
                'Authorization': `Bearer ${device.deviceToken}`
            }
        });
        console.log("SUCCESS:", res.status, res.data ? Object.keys(res.data) : "no data");
    } catch (e) {
        if (e.response) {
            console.log("FAILED WITH JSON:", e.response.status, e.response.data);
        } else {
            console.log("FAILED WITH ERROR:", e.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
