import { aiService } from "../services/ai.service";
import { dbInstances } from "@repo/db-customer";

async function findTestCustomer() {
    const customer = await (dbInstances as any).customer.findFirst({
        select: { id: true, fullName: true }
    });
    return customer;
}

async function runTests() {
    console.log("Starting Gupio AI Framework Verification...");
    
    const customer = await findTestCustomer();
    if (!customer) {
        console.error("No customer found in database to test with.");
        return;
    }
    
    console.log(`Testing with Customer: ${customer.fullName} (${customer.id})`);
    
    const testCases = [
        { name: "Mode 1: Vehicle Assistant", msg: "I want to check my vehicle status and health." },
        { name: "Mode 2: Expense Analysis", msg: "Show me a summary of my expenses for the last 30 days." },
        { name: "Mode 3: My Support Tickets", msg: "List my active support tickets." },
        { name: "Mode 4: SOS Urgency", msg: "HELP! I had a car accident!" },
    ];
    
    for (const test of testCases) {
        console.log(`\n>>> [${test.name}]`);
        console.log(`User: ${test.msg}`);
        
        try {
            const res = await aiService.chat(customer.id, test.msg);
            console.log(`AI Response: ${res.message.substring(0, 150)}...`);
            console.log(`Suggested Actions: ${res.suggestedActions.map(a => a.label).join(", ")}`);
            if (res.toolResults) {
                console.log(`Tools Invoked: ${res.toolResults.map(tr => tr.tool).join(", ")}`);
            }
        } catch (err) {
            console.error(`Test failed for ${test.name}:`, err);
        }
    }
}

runTests().then(() => {
    console.log("\nVerification Complete.");
    process.exit(0);
}).catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
