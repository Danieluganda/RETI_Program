const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");
const { PrismaClient } = require("@prisma/client");

for (const line of fs.readFileSync(path.join(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const prisma = new PrismaClient();

const filePath = process.argv[2];
const source = process.argv[3] || "participant_xlsx";
const preferredSheet = process.argv[4] || "";

if (!filePath) {
  console.error("Usage: node scripts/import-xlsx-participants.js <xlsx-file> <source> [sheet-name]");
  process.exit(1);
}

const esoAliases = {
  agdi: "AGDI",
  aid: "AID",
  challenges: "Challenges Uganda",
  chal: "Challenges Uganda",
  chu: "Challenges Uganda",
  curad: "CURAD",
  dfcu: "DFCU Foundation",
  echai: "ECHAI/Excelhort",
  excel: "ECHAI/Excelhort",
  excelhort: "ECHAI/Excelhort",
  findingxy: "Finding XY",
  finding: "Finding XY",
  leu: "Living Earth Uganda",
  livingearth: "Living Earth Uganda",
  mkazi: "Mkazipreneur",
  mkazipreneur: "Mkazipreneur",
  mubs: "MUBS EIC",
  pedn: "PEDN",
  stanbic: "Stanbic Bank Incubator",
  stanb: "Stanbic Bank Incubator",
  xy: "Finding XY",
  alb: "AID",
};

function clean(value = "") {
  return String(value).replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

function normalizeHeader(value = "") {
  return clean(value)
    .split("---")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  if (!cleaned || cleaned === "---") return "";
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

function xmlDecode(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function columnIndex(cellRef = "") {
  const letters = cellRef.replace(/\d+/g, "");
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

async function readWorkbook(xlsxPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(xlsxPath));
  const shared = [];
  const sharedFile = zip.file("xl/sharedStrings.xml");
  if (sharedFile) {
    const sharedXml = await sharedFile.async("string");
    for (const match of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const text = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlDecode(part[1])).join("");
      shared.push(text);
    }
  }

  const workbook = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const relMap = new Map(
    [...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  const sheets = [...workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((match) => ({
    name: xmlDecode(match[1]),
    target: relMap.get(match[2]),
  }));

  const sheet = sheets.find((item) => item.name === preferredSheet) || sheets[0];
  const sheetPath = `xl/${sheet.target.replace(/^\//, "").replace(/^xl\//, "")}`;
  const xml = await zip.file(sheetPath).async("string");

  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = (attrs.match(/r="([^"]+)"/) || [])[1] || "";
      const index = columnIndex(ref);
      const value = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "";
      const inline = (body.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || "";
      row[index] = attrs.includes('t="s"') ? shared[Number(value)] || "" : xmlDecode(inline || value);
    }
    return row.map((value) => clean(value));
  });
}

function get(row, headers, candidates) {
  for (const candidate of candidates) {
    const key = headers.find((header) => header === candidate || header.startsWith(candidate));
    if (key && row[key]) return row[key];
  }
  return "";
}

async function ensureEso(name) {
  return prisma.eso.upsert({
    where: { name },
    create: {
      name,
      code: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || null,
    },
    update: { status: "active" },
  });
}

async function main() {
  const rows = await readWorkbook(path.resolve(filePath));
  const [headerRow, ...dataRows] = rows.filter((row) => row.some(Boolean));
  const headers = headerRow.map(normalizeHeader);
  const participants = [];
  const seen = new Set();
  let skipped = 0;
  let invalid = 0;

  for (const values of dataRows) {
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const firstName = get(row, headers, ["first name"]);
    const middleName = get(row, headers, ["middle name"]);
    const surname = get(row, headers, ["surname"]);
    const preferredName = get(row, headers, ["preferred name"]);
    const fullName = normalizeName(
      get(row, headers, ["full name", "enterprise owner"]) ||
        preferredName ||
        [firstName, middleName, surname].filter(Boolean).join(" "),
    );
    const externalId =
      get(row, headers, ["unique identifier", "enterprise unique identifier"]) ||
      get(row, headers, ["unique key"]) ||
      `${source}:${fullName}`;
    const esoRaw =
      get(row, headers, ["eso", "downstream partner", "name of sub partners", "test"]) ||
      get(row, headers, ["implementing partner name"]);
    const esoName = normalizeEso(esoRaw);

    if (!fullName || !esoName || !externalId || fullName === "---" || esoName === "---") {
      skipped += 1;
      invalid += 1;
      continue;
    }

    if (seen.has(externalId)) {
      skipped += 1;
      continue;
    }
    seen.add(externalId);

    participants.push({
      externalId,
      fullName,
      normalizedName: fullName.toLowerCase(),
      phone: normalizePhone(get(row, headers, ["primary phone number"])),
      email: get(row, headers, ["email"]),
      esoName,
      esoCode: clean(esoRaw),
      district: get(row, headers, ["administrative level2", "administrative level2 district"]),
      region: get(row, headers, ["administrative level1", "administrative level1 region"]),
      sector: get(row, headers, ["sector"]),
      status: "active",
      source,
    });
  }

  const esoByName = new Map();
  for (const esoName of [...new Set(participants.map((participant) => participant.esoName))]) {
    esoByName.set(esoName, await ensureEso(esoName));
  }

  const beforeCount = await prisma.participant.count({ where: { source } });
  const createResult = await prisma.participant.createMany({
    data: participants.map((participant) => ({
      ...participant,
      esoId: esoByName.get(participant.esoName)?.id || null,
    })),
    skipDuplicates: true,
  });
  const afterCount = await prisma.participant.count({ where: { source } });

  console.log(
    JSON.stringify(
      {
        file: path.basename(filePath),
        source,
        totalRowsRead: dataRows.length,
        parsed: participants.length,
        created: createResult.count,
        existingOrDuplicate: participants.length - createResult.count,
        sourceCountBefore: beforeCount,
        sourceCountAfter: afterCount,
        skipped,
        invalid,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
