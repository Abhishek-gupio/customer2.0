const axios = require('axios');
require('dotenv').config({ path: '/Users/abhishekkumar/Desktop/customer2.0/prisma/.env' });

const INSTANCE_ID = process.env.DAMOOV_INSTANCE_ID;
const INSTANCE_KEY = process.env.DAMOOV_INSTANCE_KEY;

async function test() {
  try {
    const res = await axios.post('https://api.telematicssdk.com/trips/get/v1', {
      InstanceId: INSTANCE_ID,
      StartDate: Math.floor((Date.now() - 86400000) / 1000),
      EndDate: Math.floor(Date.now() / 1000)
    }, {
      headers: {
        'InstanceId': INSTANCE_ID,
        'InstanceKey': INSTANCE_KEY
      }
    });
    console.log("SUCCESS:", res.status);
  } catch (e) {
    console.log("FAILED:", e.response ? e.response.status : e.message, e.response?.data);
  }
}
test();
