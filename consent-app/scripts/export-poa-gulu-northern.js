const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

const folders = [
  { name: "busala_sample_dataset", dir: path.join(process.cwd(), "..", "sample_dataset") },
  { name: "src_data", dir: path.join(process.cwd(), "_src_data") },
];

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

function isNorthernOrGulu(values) {
  const district = firstValue(values, [
    "District",
    "Administrative Level2 : District",
    "Administrative Level2",
    "Administrative Level2 District",
  ]);
  const region = firstValue(values, [
    "Region",
    "Administrative Level1",
    "Administrative Level1 : Region",
    "Administrative Level1 Region",
  ]);
  const combined = normalizeKey(`${district} ${region}`);
  return combined.includes("gulu") || combined.includes("northern") || combined.includes("northen") || combined.includes("north");
}

async function workbookRows(filePath, sourceFolder) {
  const workbook = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(workbook);
  const sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) return [];

  const [sheetXml, sharedXml] = await Promise.all([
    sheetFile.async("string"),
    zip.file("xl/sharedStrings.xml")?.async("string") || "",
  ]);
  const sharedStrings = parseSharedStrings(sharedXml);
  const parsedRows = parseRows(sheetXml, sharedStrings);
  const headerRow = parsedRows.find((row) => row.rowNumber === 1);
  if (!headerRow) return [];

  const headers = [];
  for (let index = 0; index < 80; index += 1) {
    const value = headerRow.cells.get(columnName(index));
    if (value) headers.push(value);
  }

  return parsedRows
    .filter((row) => row.rowNumber > 1)
    .map((row) => {
      const values = Object.fromEntries(headers.map((header, index) => [header, row.cells.get(columnName(index)) || ""]));
      return {
        sourceFolder,
        sourceFile: path.basename(filePath),
        sourceRow: row.rowNumber,
        values,
      };
    })
    .filter((row) => Object.values(row.values).some((value) => String(value).trim()))
    .filter((row) => isNorthernOrGulu(row.values));
}

async function main() {
  const rows = [];

  for (const folder of folders) {
    try {
      const files = (await fs.readdir(folder.dir)).filter((file) => file.toLowerCase().endsWith(".xlsx"));
      for (const file of files) {
        rows.push(...(await workbookRows(path.join(folder.dir, file), folder.name)));
      }
    } catch {
      // Optional comparison folder may not exist in every deployment.
    }
  }

  const standardHeaders = [
    "sourceFolder",
    "sourceFile",
    "sourceRow",
    "ESO",
    "Enterprise Owner",
    "Full Name",
    "NAME",
    "MTN",
    "AIRTEL",
    "Primary Phone Number",
    "Email",
    "District",
    "Administrative Level2 : District",
    "Administrative Level2",
    "Region",
    "Administrative Level1",
    "Sector",
    "Type of Business",
    "Unique identifier",
    "Enterprise Unique Identifier",
    "UNIQUE KEY",
    "Unique Key",
  ];
  const outputPath = path.join(process.cwd(), "poa-gulu-northern-participants.csv");
  const lines = [
    standardHeaders.join(","),
    ...rows.map((row) =>
      standardHeaders
        .map((header) =>
          csvCell(
            header === "sourceFolder" || header === "sourceFile" || header === "sourceRow"
              ? row[header]
              : row.values[header] || "",
          ),
        )
        .join(","),
    ),
  ];
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

  const bySourceFile = {};
  const bySourceFolder = {};
  for (const row of rows) {
    bySourceFile[row.sourceFile] = (bySourceFile[row.sourceFile] || 0) + 1;
    bySourceFolder[row.sourceFolder] = (bySourceFolder[row.sourceFolder] || 0) + 1;
  }

  console.log(JSON.stringify({ outputPath, total: rows.length, bySourceFolder, bySourceFile, preview: rows.slice(0, 20) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
