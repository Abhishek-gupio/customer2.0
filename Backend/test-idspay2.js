const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    const urls = [
      "https://api.idspay.in/srv2/validation/digilocker-digital-kyc",
      "https://javabackend.idspay.in/srv2/validation/digilocker-digital-kyc"
    ];
    for(const u of urls) {
       try {
         const res = await axios.post(u, {
          api_id: process.env.API_ID,
          api_key: process.env.API_KEY,
          token_id: process.env.TOKEN_ID,
          methodName: "generateToken"
         });
         console.log(u, "SUCCESS:", res.data);
       } catch(e) {
         console.log(u, "FAIL:", e.response ? e.response.status : e.message);
       }
    }
  } catch (e) {
    console.log(e);
  }
}
test();
