const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function main() {
  const device = await prisma.telematicsDevice.findFirst({ where: { isActive: true, deviceToken: { not: null } } });
  if (!device) {
    console.log("No device with token found");
    return;
  }
  console.log("Found device token:", device.deviceToken);
  
  try {
    const res = await axios.get('https://mobilesdk.telematicssdk.com/mobilesdk/stage/track/get_short_list/v1', {
      headers: {
        'DeviceToken': device.deviceToken,
        'Authorization': `Bearer ${device.deviceToken}`
      }
    });
    console.log("SUCCESS:", res.status, Object.keys(res.data || {}));
  } catch (e) {
    console.log("FAILED:", e.response?.status, e.response?.data);
  }
}
main().finally(() => prisma.$disconnect());
