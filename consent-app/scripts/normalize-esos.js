const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const canonicalEsos = [
  "DFCU Foundation",
  "ECHAI/Excelhort",
  "PEDN",
  "Stanbic Bank Incubator",
  "Living Earth Uganda",
  "AID",
  "AGDI",
  "Challenges Uganda",
  "CURAD",
  "Mkazipreneur",
  "MUBS EIC",
  "Finding XY",
];

const aliases = [
  ["ECHAI/Excelhort", ["ECHAI", "excel104", "Excelhort", "ECHAI Excelhort"]],
  ["Living Earth Uganda", ["leu112"]],
  ["AID", ["alb110"]],
  ["Finding XY", ["xy105"]],
  ["Mkazipreneur", ["mkazi106"]],
];

function codeFor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  try {
    for (const name of canonicalEsos) {
      await prisma.eso.upsert({
        where: { name },
        create: { name, code: codeFor(name), status: "active" },
        update: { status: "active" },
      });
    }

    for (const [canonical, names] of aliases) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Participant" SET "esoName" = $1, "updatedAt" = now() WHERE "esoName" = ANY($2)',
        canonical,
        names,
      );
    }

    await prisma.$executeRawUnsafe(
      'UPDATE "Participant" p SET "esoId" = e.id FROM "Eso" e WHERE p."esoName" = e.name AND (p."esoId" IS NULL OR p."esoId" <> e.id)',
    );

    const rows = await prisma.$queryRawUnsafe(
      'SELECT "esoName", count(*)::int as count FROM "Participant" WHERE status = \'active\' GROUP BY "esoName" ORDER BY "esoName" ASC',
    );
    console.log(JSON.stringify({ rows }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
