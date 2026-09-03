import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const ADMIN_EMAIL = "admin@assessflow.com";
const ADMIN_PASSWORD = "Admin@123456";
const ADMIN_NAME = "System Admin";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: {
      email: ADMIN_EMAIL,
    },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log("Admin user seeded successfully");
  console.log(admin);

  console.log("Admin credentials:");
  console.log({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });