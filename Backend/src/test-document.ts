import "dotenv/config";
import { dbInstances } from "@repo/db-customer";
import { signAccess } from "./modules/auth/jwt";
import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";

async function runDummyTest() {
  console.log("Starting dummy test for document flow...");

  // 1. Get or create a dummy customer
  let customer = await dbInstances.customer.findFirst();
  if (!customer) {
    console.log("No customer found, creating a dummy one...");
    customer = await dbInstances.customer.create({
      data: {
        phoneNumber: "9999999999",
        fullName: "Dummy Test User",
      },
    });
  }
  console.log(`Using customer: ${customer.fullName} (${customer.id})`);

  // 2. Generate a JWT
  const token = signAccess({
    id: customer.id,
    phoneNumber: customer.phoneNumber,
  });
  console.log("Generated JWT token");

  // 3. Prepare a dummy file
  const possiblePaths = [
    "/Users/abhishekkumar/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/9CAE7AEE-7AA2-47D4-A8EC-78C31C6B2231.jpg",
    path.join(__dirname, "../README.md"), // Fallback
  ];

  let filePath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.log("No existing test file found. Creating a dummy text file...");
    filePath = path.join(__dirname, "test-upload.txt");
    fs.writeFileSync(filePath, "This is a dummy test file for upload.");
  }

  console.log(`Using file: ${filePath}`);
  const fileStream = fs.createReadStream(filePath);

  // 4. Call the API
  const formData = new FormData();
  formData.append("file", fileStream);
  formData.append("type", "RC");
  const randomSuffix = Math.floor(Math.random() * 100000);
  formData.append("documentNumber", `RC${randomSuffix}`);

  console.log("Sending POST request to /api/v1/documents...");
  try {
    const response = await axios.post(
      "http://localhost:9000/api/v1/documents",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log("Response Status:", response.status);
    // console.log("Response Data:", JSON.stringify(response.data, null, 2));

    if (response.status === 201) {
      const docId = response.data.data.id;
      console.log(`\nDocument uploaded successfully. ID: ${docId}`);

      // 5. List Documents
      console.log("\nTesting GET /api/v1/documents...");
      const listRes = await axios.get(
        "http://localhost:9000/api/v1/documents",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log("List Response Status:", listRes.status);
      console.log(`Found ${listRes.data.data.length} documents`);

      // 6. Get Document By ID
      console.log(`\nTesting GET /api/v1/documents/${docId}...`);
      const getRes = await axios.get(
        `http://localhost:9000/api/v1/documents/${docId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log("Get Response Status:", getRes.status);
      console.log("Document Type:", getRes.data.data.type);
      // console.log("Extracted Fields:", JSON.stringify(getRes.data.data.extractedFields, null, 2));

      // 7. Get Expiring Documents
      console.log("\nTesting GET /api/v1/documents/expiring?days=60...");
      const expiringRes = await axios.get(
        "http://localhost:9000/api/v1/documents/expiring?days=60",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log("Expiring Response Status:", expiringRes.status);
      console.log(`Found ${expiringRes.data.data.length} expiring documents`);

      // 8. Delete Document
      console.log(`\nTesting DELETE /api/v1/documents/${docId}...`);
      const delRes = await axios.delete(
        `http://localhost:9000/api/v1/documents/${docId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      console.log("Delete Response Status:", delRes.status);
      console.log("Delete Result:", delRes.data);
    }
  } catch (error: any) {
    if (error.response) {
      console.error(
        "API Error Response:",
        error.response.status,
        error.response.data,
      );
    } else {
      console.error("Error:", error.message);
    }
  }
}

runDummyTest().catch(console.error);
