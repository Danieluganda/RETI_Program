const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

const sourceFile = path.join(process.cwd(), "_src_data", "Outbox WEO, YIW & Enterprise POA Data (1).xlsx");
const outputPath = path.join(process.cwd(), "poa-finding-xy-challenges.csv");

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalize(value) {
  return decodeXml(value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function parseSharedStrings(xml) {
  const strings = [];
  for (const match of xml.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    const textParts = [...match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    strings.push(textParts.length ? textParts.join("") : normalize(match[0].replace(/<[^>]+>/g, "")));
  }
  return strings;
}

function columnFromRef(ref) {
  return ref.replace(/\d+/g, "");
}

function columnName(index) {
  let column = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function valueFromCell(cellXml, sharedStrings) {
  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const inlineMatch = cellXml.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

  if (cellXml.includes('t="s"') && valueMatch) return sharedStrings[Number(valueMatch[1])] || "";
  if (inlineMatch) return decodeXml(inlineMatch[1]);
  if (valueMatch) return decodeXml(valueMatch[1]);
  return "";
}

function parseRows(sheetXml, sharedStrings) {
  const rows = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[\s\S]*?<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = new Map();
    for (const cellMatch of rowMatch[0].matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[\s\S]*?<\/c>/g)) {
      cells.set(columnFromRef(cellMatch[1]), normalize(valueFromCell(cellMatch[0], sharedStrings)));
    }
    rows.push({ rowNumber, cells });
  }

  return rows;
}

function firstValue(values, candidates) {
  const entries = Object.entries(values);
  for (const candidate of candidates) {
    const exact = entries.find(([key, value]) => normalizeKey(key) === normalizeKey(candidate) && String(value).trim());
    if (exact) return exact[1];
  }
  for (const candidate of candidates) {
    const partial = entries.find(([key, value]) => normalizeKey(key).includes(normalizeKey(candidate)) && String(value).trim());
    if (partial) return partial[1];
  }
  return "";
}

function esoName(values) {
  const raw = firstValue(values, [
    "Name of Sub-partners",
    "ESO",
    "Implementing Partner Name",
    "Downstream Partner",
    "Partner",
  ]);
  const key = normalizeKey(raw);
  if (key.includes("challenge")) return "Challenges Uganda";
  if (key.includes("finding") || key.includes("xy") || key === "xy105") return "Finding XY";
  return raw;
}

function selectedEso(values) {
  const eso = esoName(values);
  return eso === "Finding XY" || eso === "Challenges Uganda";
}

async function main() {
  const workbook = await fs.readFile(sourceFile);
  const zip = await JSZip.loadAsync(workbook);
  const sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) throw new Error("Workbook is missing sheet1.xml");

  const [sheetXml, sharedXml] = await Promise.all([
    sheetFile.async("string"),
    zip.file("xl/sharedStrings.xml")?.async("string") || "",
  ]);
  const sharedStrings = parseSharedStrings(sharedXml);
  const parsedRows = parseRows(sheetXml, sharedStrings);
  const headerRow = parsedRows.find((row) => row.rowNumber === 1);
  if (!headerRow) throw new Error("Workbook is missing a header row.");

  const headers = [];
  for (let index = 0; index < 80; index += 1) {
    const value = headerRow.cells.get(columnName(index));
    if (value) headers.push(value);
  }

  const rows = parsedRows
    .filter((row) => row.rowNumber > 1)
    .map((row) => {
      const values = Object.fromEntries(headers.map((header, index) => [header, row.cells.get(columnName(index)) || ""]));
      return { sourceRow: row.rowNumber, esoName: esoName(values), values };
    })
    .filter((row) => Object.values(row.values).some((value) => String(value).trim()))
    .filter((row) => selectedEso(row.values));

  const exportHeaders = [
    "sourceRow",
    "esoName",
    ...headers,
  ];
  const lines = [
    exportHeaders.join(","),
    ...rows.map((row) =>
      exportHeaders
        .map((header) =>
          csvCell(header === "sourceRow" || header === "esoName" ? row[header] : row.values[header] || ""),
        )
        .join(","),
    ),
  ];
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

  const byEso = {};
  for (const row of rows) byEso[row.esoName] = (byEso[row.esoName] || 0) + 1;

  console.log(JSON.stringify({ sourceFile, outputPath, total: rows.length, byEso, preview: rows.slice(0, 20) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
