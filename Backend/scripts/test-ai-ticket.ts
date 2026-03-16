import "dotenv/config";
import { dbInstances } from "@repo/db-customer";

async function testAITicket() {
  try {
    const customer = await dbInstances.customer.findFirst();
    if (!customer) throw new Error("No customer");

    console.log("Testing ticket creation with category 'AI_ASSISTANT'...");
    const ticket = await dbInstances.supportTicket.create({
      data: {
        customerId: customer.id,
        subject: "AI Assistant Test Ticket",
        description: "Testing AI_ASSISTANT category logic specifically.",
        category: "AI_ASSISTANT" as any,
        priority: "MEDIUM"
      }
    });
    console.log("SUCCESS: Ticket created with ID:", ticket.id);
    
    // Cleanup
    await dbInstances.supportTicket.delete({ where: { id: ticket.id } });
    console.log("Cleaned up test ticket.");
    process.exit(0);
  } catch (error: any) {
    console.error("AI Assistant ticket creation FAILED:");
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

testAITicket();
