const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const csvPath = process.argv[2] || path.join(process.cwd(), "_src_data", "particant_data.csv");

const esoAliases = {
  agdi: "AGDI",
  aid: "AID",
  challenges: "Challenges Uganda",
  curad: "CURAD",
  dfcu: "DFCU Foundation",
  echai: "ECHAI",
  excel: "ECHAI",
  findingxy: "Finding XY",
  finding: "Finding XY",
  leu: "Living Earth Uganda",
  livingearth: "Living Earth Uganda",
  mkazi: "Mkazipreneur",
  mkazipreneur: "Mkazipreneur",
  mubs: "MUBS EIC",
  pedn: "PEDN",
  stanbic: "Stanbic Bank Incubator",
  xy: "Finding XY",
  alb: "AID",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function clean(value = "") {
  return String(value).replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

function normalizeName(value = "") {
  return clean(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePhone(value = "") {
  const cleaned = clean(value);
  if (!cleaned) return "";
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;
  if (digits.startsWith("256")) return `+${digits}`;
  if (digits.length === 9) return `+256${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+256${digits.slice(1)}`;
  return cleaned.startsWith("+") ? cleaned : `+${digits}`;
}

function normalizeEso(value = "") {
  const cleaned = clean(value);
  const key = cleaned.toLowerCase().replace(/[^a-z]/g, "");

  for (const [alias, eso] of Object.entries(esoAliases)) {
    if (key.includes(alias)) return eso;
  }

  return cleaned;
}

function pick(row, header, startsWith) {
  const key = header.find((item) => item.startsWith(startsWith));
  return key ? row[key] : "";
}

async function main() {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const [headerRow, ...dataRows] = parseCsv(text);
  const header = headerRow.map(clean);
  const participants = [];
  let skipped = 0;
  const esos = new Map();

  for (const values of dataRows) {
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));
    const firstName = clean(pick(row, header, "First Name"));
    const middleName = clean(pick(row, header, "Middle Name"));
    const surname = clean(pick(row, header, "Surname"));
    const preferredName = clean(pick(row, header, "Preferred Name"));
    const fullName = normalizeName(preferredName || [firstName, middleName, surname].filter(Boolean).join(" "));
    const externalId = clean(pick(row, header, "Unique identifier")) || clean(row["Unique Key"]);
    const esoCode = clean(row.ESO_name);
    const esoName = normalizeEso(esoCode);

    if (!fullName || !esoName) {
      skipped += 1;
      continue;
    }

    participants.push({
      externalId: externalId || `${esoName}:${fullName}`,
      fullName,
      normalizedName: fullName.toLowerCase(),
      phone: normalizePhone(pick(row, header, "Primary Phone Number")),
      email: clean(row.Email),
      esoName,
      esoCode,
      district: clean(pick(row, header, "Administrative Level2")),
      region: clean(pick(row, header, "Administrative Level1")),
      sector: clean(pick(row, header, "Sector")),
      status: "active",
    });

    esos.set(esoName, (esos.get(esoName) || 0) + 1);
  }

  await prisma.participant.deleteMany();

  const batchSize = 1000;
  for (let index = 0; index < participants.length; index += batchSize) {
    await prisma.participant.createMany({
      data: participants.slice(index, index + batchSize),
      skipDuplicates: true,
    });
  }

  const imported = await prisma.participant.count();
  console.log(JSON.stringify({ imported, skipped, esos: Object.fromEntries(esos) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
