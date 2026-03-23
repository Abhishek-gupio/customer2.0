const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/abhishekkumar/Desktop/customer2.0/prisma/.env' });

const INSTANCE_ID = process.env.DAMOOV_INSTANCE_ID;
const INSTANCE_KEY = process.env.DAMOOV_INSTANCE_KEY;

const urlsToTest = [
  'https://api.telematicssdk.com/trips/list/v1',
  'https://api.telematicssdk.com/trips/get_list/v1',
  'https://api.telematicssdk.com/trips/getlist/v1',
  'https://api.telematicssdk.com/trips/get/v1',
  'https://user.telematicssdk.com/v1/Trips/get',
  'https://api.telematicssdk.com/trips/v1',
  'https://api.telematicssdk.com/trips/list/v1',
  'https://user.telematicssdk.com/v1/Trips/getlist'
];

async function test() {
  for (const url of urlsToTest) {
    try {
      const res = await axios.post(url, {
        "InstanceId": INSTANCE_ID,
        "StartDate": Math.floor((Date.now() - 86400000) / 1000),
        "EndDate": Math.floor(Date.now() / 1000)
      }, {
        headers: {
          'InstanceId': INSTANCE_ID,
          'InstanceKey': INSTANCE_KEY
        }
      });
      console.log(`[SUCCESS 200] ${url} - Keys: ${Object.keys(res.data).join(',')}`);
    } catch (e) {
      console.log(`[FAILED ${e.response ? e.response.status : e.message}] ${url}`);
    }
  }
}
test();
