import bcrypt from "bcryptjs";
import prisma from "./prisma";

async function main() {
  const adminEmail = "admin@bank.com";
  const adminPassword = "Admin@12345";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "ADMIN",
      fullName: "Bank Administrator",
      password: hashedPassword,
    },
    create: {
      fullName: "Bank Administrator",
      email: adminEmail,
      password: hashedPassword,
      balance: 100000.0,
      role: "ADMIN",
    },
  });

  console.log("==================================================");
  console.log("🎉 Admin Account Ready!");
  console.log("--------------------------------------------------");
  console.log(`👤 Admin Email:    ${admin.email}`);
  console.log(`🛡️  Master PIN:     ${process.env.ADMIN_MASTER_PIN || 'Protected / Configured via environment'}`);
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
