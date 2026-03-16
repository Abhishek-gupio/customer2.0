import "dotenv/config";
import { dbInstances } from "@repo/db-customer";

async function testAllCategories() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const categories = [
    'VEHICLE', 'DOCUMENTS', 'VALET', 'AI_ASSISTANT', 
    'BILLING', 'ACCOUNT', 'TECHNICAL', 'GENERAL', 
    'APP_ISSUE', 'OTHER'
  ];

  try {
    const customer = await dbInstances.customer.findFirst();
    if (!customer) throw new Error("No customer found");

    console.log(`Testing with customer: ${customer.id}`);

    for (const cat of categories) {
      try {
        const ticket = await dbInstances.supportTicket.create({
          data: {
            customerId: customer.id,
            subject: `Test ${cat}`,
            description: `Testing category ${cat}`,
            category: cat as any,
            priority: 'LOW'
          }
        });
        console.log(`✅ SUCCESS: ${cat} (Ticket ID: ${ticket.id})`);
        
        await dbInstances.supportTicket.delete({ where: { id: ticket.id } });
      } catch (err: any) {
        console.error(`❌ FAILED: ${cat} - ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error("Critical Failure:", error.message);
  } finally {
    process.exit(0);
  }
}

testAllCategories();
