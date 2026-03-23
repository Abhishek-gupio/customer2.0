const axios = require('axios');
const INSTANCE_ID = process.env.DAMOOV_INSTANCE_ID || "e0d9f810-a796-43d9-b8e4-379d48b19120";
const INSTANCE_KEY = process.env.DAMOOV_INSTANCE_KEY || "e331f9cd-e3e1-4a47-9d4b-67cf324ed300";

const urlsToTest = [
  'https://api.damoov.com/v1/trips',
  'https://user.damoov.com/v1/Datahub/Trips',
  'https://data.telematicssdk.com/v1/trips'
];

async function testURLs() {
  for (const url of urlsToTest) {
    try {
      const res = await axios.post(url, {
        InstanceId: 'e331f9cd-e3e1-4a47-9d4b-67cf324ed300'
      }, { headers: { InstanceId: INSTANCE_ID, InstanceKey: INSTANCE_KEY } });
      console.log(`SUCCESS on ${url}:`, res.status);
    } catch (err) { }
  }
}
testURLs();
