import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "collector@10x.local" },
    update: {},
    create: {
      name: "Demo Collector",
      email: "collector@10x.local",
      passwordHash: "demo-only-password123",
      role: "Data Collector",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
