const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    const response = await axios.post(
      "https://api.idspay.in/srv2/validation/digilocker-digital-kyc",
      {
        api_id: process.env.API_ID,
        api_key: process.env.API_KEY,
        token_id: process.env.TOKEN_ID,
        methodName: "generateToken"
      }
    );
    console.log(response.data);
  } catch (e) {
    console.log(e.response ? e.response.data : e.message);
  }
}
test();
