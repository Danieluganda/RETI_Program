const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

async function count(name) {
  const aliases =
    name === "ECHAI/Excelhort" ? ["ECHAI/Excelhort", "ECHAI", "Excelhort", "ECHAI Excelhort", "excel104"] : [name];
  return prisma.participant.count({ where: { status: "active", esoName: { in: aliases } } });
}

async function main() {
  const esos = ["ECHAI/Excelhort", "DFCU Foundation", "MUBS EIC", "Stanbic Bank Incubator"];
  const result = {};
  for (const eso of esos) result[eso] = await count(eso);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
