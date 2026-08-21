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

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1",
    tableName,
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function main() {
  loadEnv();
  const outDir = process.argv[2];
  if (!outDir) throw new Error("Usage: node scripts/backup-db-json.js <output-dir>");
  fs.mkdirSync(outDir, { recursive: true });

  const prisma = new PrismaClient();
  const tables = ["User", "Participant", "Consent", "Eso"];
  const backup = {
    backedUpAt: new Date().toISOString(),
    tables: {},
  };

  try {
    for (const table of tables) {
      if (await tableExists(prisma, table)) {
        backup.tables[table] = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  fs.writeFileSync(path.join(outDir, "database-backup.json"), `${JSON.stringify(backup, null, 2)}\n`);
  console.log(JSON.stringify({ output: path.join(outDir, "database-backup.json"), tables: Object.keys(backup.tables) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
