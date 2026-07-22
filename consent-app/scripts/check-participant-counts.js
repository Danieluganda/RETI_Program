const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.participant.count({ where: { status: "active" } });
  const rows = await prisma.$queryRawUnsafe(
    'SELECT "esoName", count(*)::int as count FROM "Participant" WHERE status = \'active\' GROUP BY "esoName" ORDER BY count ASC',
  );
  console.log(JSON.stringify({ total, rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
