const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const prisma = new PrismaClient();

async function main() {
  const [sources, esos] = await Promise.all([
    prisma.participant.groupBy({
      by: ["source"],
      where: { status: "active" },
      _count: { _all: true },
      orderBy: { source: "asc" },
    }),
    prisma.participant.groupBy({
      by: ["esoName"],
      where: { status: "active" },
      _count: { _all: true },
      orderBy: { esoName: "asc" },
    }),
  ]);

  console.log("Participant datasets");
  for (const source of sources) {
    console.log(`${source.source}: ${source._count._all}`);
  }
  console.log(`Total active participants: ${sources.reduce((total, source) => total + source._count._all, 0)}`);

  console.log("\nParticipants by ESO");
  for (const eso of esos) {
    console.log(`${eso.esoName}: ${eso._count._all}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
