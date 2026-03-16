import "dotenv/config";
import { supportService } from "../src/modules/support/support.service";

async function testChatFlow() {
  const customerId = "cm7q0v8t00000jrvz9p8x2h6q"; // Assuming this is a valid customer ID or just use any
  try {
    console.log("Testing getChatFlow for root...");
    // Find a real customer ID first
    const { dbInstances } = await import("@repo/db-customer");
    const customer = await dbInstances.customer.findFirst();
    if (!customer) {
        console.error("No customers found in database.");
        process.exit(1);
    }
    
    console.log(`Using customer: ${customer.fullName} (${customer.id})`);
    const flow = await supportService.getChatFlow(customer.id, 'root');
    console.log("Chat flow result successful!");
    console.log("Message:", flow.message.substring(0, 50) + "...");
    process.exit(0);
  } catch (error: any) {
    console.error("Chat flow FAILED with error:");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

testChatFlow();
