import "dotenv/config";
import { dbInstances } from "@repo/db-customer";

async function testCreateTicket() {
  try {
    const customer = await dbInstances.customer.findFirst();
    if (!customer) throw new Error("No customer");

    console.log("Testing ticket creation with category 'VALET'...");
    const ticket = await dbInstances.supportTicket.create({
      data: {
        customerId: customer.id,
        subject: "Test Valet Ticket",
        description: "Testing new category logic.",
        category: "VALET" as any, // Cast to any to bypass local TS if needed, but schema should have it
        priority: "MEDIUM"
      }
    });
    console.log("Ticket created successfully with ID:", ticket.id);
    
    // Cleanup
    await dbInstances.supportTicket.delete({ where: { id: ticket.id } });
    console.log("Test ticket cleaned up.");
    process.exit(0);
  } catch (error: any) {
    console.error("Ticket creation FAILED:");
    console.error(error.message);
    process.exit(1);
  }
}

testCreateTicket();
