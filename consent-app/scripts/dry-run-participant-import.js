const fs = require("node:fs");
const path = require("node:path");

const csvPath = process.argv[2] || path.join(process.cwd(), "_src_data", "particant_data.csv");
const esoAliases = {
  agdi: "AGDI",
  aid: "AID",
  challenges: "Challenges Uganda",
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
      } else if (char === '"') quoted = false;
      else value += char;
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
    } else if (char !== "\r") value += char;
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

const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const [headerRow, ...dataRows] = parseCsv(text);
const header = headerRow.map(clean);
const seen = new Set();
const esos = new Map();
let invalid = 0;
let duplicates = 0;

for (const values of dataRows) {
  const row = Object.fromEntries(header.map((key, index) => [key, values[index] || ""]));
  const fullName = normalizeName(
    clean(pick(row, header, "Preferred Name")) ||
      [clean(pick(row, header, "First Name")), clean(pick(row, header, "Middle Name")), clean(pick(row, header, "Surname"))]
        .filter(Boolean)
        .join(" "),
  );
  const externalId = clean(pick(row, header, "Unique identifier")) || clean(row["Unique Key"]);
  const esoName = normalizeEso(clean(row.ESO_name));
  if (!fullName || !esoName) {
    invalid += 1;
    continue;
  }
  const stableExternalId = externalId || `${esoName}:${fullName}`;
  if (seen.has(stableExternalId)) {
    duplicates += 1;
    continue;
  }
  seen.add(stableExternalId);
  esos.set(esoName, (esos.get(esoName) || 0) + 1);
}

console.log(JSON.stringify({ totalRowsRead: dataRows.length, validUniqueParticipants: seen.size, invalid, duplicates, esos: Object.fromEntries([...esos.entries()].sort()) }, null, 2));
