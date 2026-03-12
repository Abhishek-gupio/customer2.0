const fs = require('fs');
require('dotenv').config({ path: './Backend/.env' });
const key = process.env.GEMINI_API_KEY;

const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
const body = {
  instances: [{ prompt: "A sleek Maruti Splendor motorcycle parked on a modern city street, realistic 4k photo" }],
  parameters: {
    sampleCount: 1,
    aspectRatio: "4:3",
    outputOptions: { mimeType: "image/jpeg" }
  }
};

fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })
  .then(r => r.json())
  .then(j => {
    if (j.predictions && j.predictions[0]) {
      const b64 = j.predictions[0].bytesBase64Encoded;
      console.log("Success! Got image bytes length:", b64.length);
    } else {
      console.log("Failed:", JSON.stringify(j, null, 2));
    }
  });
