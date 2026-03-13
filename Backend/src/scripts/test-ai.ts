import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";
import { aiService } from "../services/ai.service";

/**
 * Script to verify AI Service End-to-End
 * Run with: npx tsx src/scripts/test-ai.ts
 */
async function testAI() {
  console.log("🚀 Starting AI Service Test...");

  const customerId = "cmlkk981t00004dutf6jocxuy"; // New test customer ID

  // Test 1: Simple Knowledge Query (RAG)
  console.log("\n--- TEST 1: RAG Query ---");
  try {
    const response1 = await aiService.chat(
      customerId,
      "When does my insurance expire?",
    );
    console.log("User: When does my insurance expire?");
    console.log("AI:", response1.message);
  } catch (e) {
    console.error("Test 1 Failed:", e);
  }

  // Test 2: Tool Use (Add Expense)
  console.log("\n--- TEST 2: Tool Use (Add Expense) ---");
  try {
    const response2 = await aiService.chat(
      customerId,
      "I just spent 500 rupees on fuel at Shell.",
    );
    console.log("User: I just spent 500 rupees on fuel at Shell.");
    console.log("AI:", response2.message);

    if (response2.toolResults) {
      console.log("✅ Tool Executed:", response2.toolResults);
    } else {
      console.log("⚠️ No tool execution detected.");
    }
  } catch (e) {
    console.error("Test 2 Failed:", e);
  }

  // Test 3: Tool Use (Vehicle Status)
  console.log("\n--- TEST 3: Tool Use (Vehicle Status) ---");
  try {
    const response3 = await aiService.chat(
      customerId,
      "What is the status of my car?",
    );
    console.log("User: What is the status of my car?");
    console.log("AI:", response3.message);
  } catch (e) {
    console.error("Test 3 Failed:", e);
  }

  console.log("\n✅ AI Service Test Complete");
  process.exit(0);
}

testAI();
