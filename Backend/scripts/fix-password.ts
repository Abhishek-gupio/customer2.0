import { dbInstances } from "@repo/db-customer";
import bcrypt from "bcryptjs";

const prisma = dbInstances;

async function main() {
  const email = "abhishek.kumar@mygupio.com";
  const password = "abhi@123";
  const newHash = await bcrypt.hash(password, 10);
  
  await prisma.adminUser.update({
    where: { email },
    data: { passwordHash: newHash }
  });
  console.log("Password updated successfully!");
}

main().catch(console.error);
