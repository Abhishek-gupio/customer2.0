import { aiService } from "./Backend/src/services/ai.service";
import { dbInstances } from "@repo/db-customer";

async function testAI() {
  const customerId = "test-customer-id"; // Replace with a real ID if needed for DB calls

  console.log("--- Testing Mode Switching ---");

  const tests = [
    { name: "Vehicle Assistant", msg: "I want to check my car health" },
    { name: "Expense Analysis", msg: "How much did I spend on fuel last month?" },
    { name: "Support Tickets", msg: "Show me my active support tickets" },
    { name: "SOS / Emergency", msg: "HELP! I had an accident!" },
  ];

  for (const t of tests) {
    console.log(`\nTesting Mode: ${t.name}`);
    console.log(`User: ${t.msg}`);
    try {
      const response = await aiService.chat(customerId, t.msg);
      console.log(`Bot: ${response.message.substring(0, 100)}...`);
      console.log(`Suggested Actions: ${JSON.stringify(response.suggestedActions)}`);
      if (response.toolResults) {
        console.log(`Tools Called: ${response.toolResults.map(tr => tr.tool).join(", ")}`);
      }
    } catch (e) {
      console.error(`Error in ${t.name} test:`, e);
    }
  }
}

testAI().catch(console.error);
