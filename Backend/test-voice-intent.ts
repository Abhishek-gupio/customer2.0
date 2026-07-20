import * as dotenv from "dotenv";
dotenv.config();

import { voiceService } from "./src/services/voice.service";
import { aiService } from "./src/services/ai.service";

async function testQuery(query: string) {
  console.log(`\n========================================`);
  console.log(`TEST QUERY: "${query}"`);
  console.log(`========================================`);
  
  try {
    console.log("Extracting intent...");
    const intent = await voiceService.extractIntent(query);
    console.log("EXTRACTED INTENT JSON:");
    console.log(JSON.stringify(intent, null, 2));

    console.log("\nRouting/processing intent...");
    // Mock customer ID for testing
    const customerId = "test-customer-id";
    const result = await aiService.processIntent(customerId, intent);
    console.log("ROUTING ACTION RESULT:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Test failed with error:", error.message || error);
  }
}

async function runTests() {
  // Test 1: Service status check
  await testQuery("Open my warranty and parts status");

  // Test 2: Add expense intent
  await testQuery("Add a fuel expense of 1200 rupees at Shell petrol pump");

  // Test 3: Get challans intent
  await testQuery("Check if there are any traffic challans for my car DL1CA1234");

  // Test 4: Navigation intent
  await testQuery("Open my vehicle garage list");

  // Test 5: Unsupported intent
  await testQuery("Who is the prime minister of India?");

  // Test 6: Text Chat Fallback to Groq
  console.log(`\n========================================`);
  console.log(`TEST TEXT CHAT FALLBACK: "How many wheels does a car have?"`);
  console.log(`========================================`);
  try {
    const chatResult = await aiService.chat("test-customer-id", "How many wheels does a car have?");
    console.log("CHAT RESPONSE:");
    console.log(JSON.stringify(chatResult, null, 2));
  } catch (error: any) {
    console.error("Chat fallback failed:", error.message || error);
  }
}

runTests();
