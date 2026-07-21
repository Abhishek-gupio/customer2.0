import { dbInstances } from "@repo/db-customer";
import bcrypt from "bcryptjs";

const prisma = dbInstances;

async function main() {
  const email = "abhishek.kumar@mygupio.com";
  const password = "abhi@123";

  console.log(`Checking admin with email: ${email}`);
  
  const admin = await prisma.adminUser.findUnique({
    where: { email }
  });

  if (!admin) {
    console.log("Admin user NOT FOUND in the database.");
    
    console.log("Fetching all admin users:");
    const allAdmins = await prisma.adminUser.findMany();
    console.log(allAdmins.map(a => ({ email: a.email, role: a.role })));
    return;
  }

  console.log("Admin user FOUND:");
  console.log({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive
  });

  const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
  console.log(`Is password valid? ${isPasswordValid}`);

  if (!isPasswordValid) {
    console.log("Password hash does not match.");
    // Let's create a new hash for them just to be helpful
    const newHash = await bcrypt.hash(password, 10);
    console.log(`To fix this, you can run:`);
    console.log(`await prisma.adminUser.update({ where: { email: "${email}" }, data: { passwordHash: "${newHash}" } })`);
  }
}

main().catch(console.error);
