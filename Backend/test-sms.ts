import "dotenv/config";
import { Flash49SMSService } from "../src/services/sms.service";

async function testSMS() {
  const sms = new Flash49SMSService();
  const testNumber = "919011111111"; // User should replace with their number or I can ask
  const message = `SOS ALERT! User has reported an emergency. Please help immediately!`;
  
  console.log("Testing SMS delivery to:", testNumber);
  console.log("Message:", message);
  
  const result = await sms.sendSMS(testNumber, message);
  console.log("Result:", result ? "SUCCESS" : "FAILED");
}

testSMS();
