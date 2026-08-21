import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { getCurrentConsents } from "./analytics";
import { dataFolder, dataPath } from "./dataPaths";
import { consentRecordedAt } from "./dateTime";
import type { ConsentRecord } from "./db";
import { getActiveParticipants, type ParticipantSummary } from "./participants";

const templatePath = dataPath("data_template", "Device_financing_Data.xlsx");
const sheetPath = "xl/worksheets/sheet1.xml";
const sharedStringsPath = "xl/sharedStrings.xml";
const lastColumn = "P";

type SourceRow = {
  values: Record<string, string>;
  name: string;
  eso: string;
  phones: string[];
  identifiers: string[];
};

export type UncdfExportFilters = {
  eso?: string;
  from?: string;
  to?: string;
};

export type UncdfConsentRow = {
  rowNumber: number;
  values: Record<string, string>;
  match: {
    referenceNumber: string;
    consentDate: string;
    recordedAt: string;
    participantName: string;
    participantPhone: string;
    esoName: string;
    pdfAvailable: boolean;
    matchedBy: "consent_record";
  };
};

export type UncdfGateSummary = {
  totalRows: number;
  shareableRows: number;
  pendingRows: number;
  exportedAt: string;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function normalizeText(value: string) {
  return decodeXml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    const textParts = [...match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    strings.push(textParts.length ? textParts.join("") : normalizeText(match[0]));
  }
  return strings;
}

function columnFromRef(ref: string) {
  return ref.replace(/\d+/g, "");
}

function valueFromCell(cellXml: string, sharedStrings: string[]) {
  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const inlineMatch = cellXml.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

  if (cellXml.includes('t="s"') && valueMatch) {
    return sharedStrings[Number(valueMatch[1])] || "";
  }

  if (inlineMatch) return decodeXml(inlineMatch[1]);
  if (valueMatch) return decodeXml(valueMatch[1]);
  return "";
}

function parseRows(sheetXml: string, sharedStrings: string[]) {
  const rows: { rowNumber: number; rowXml: string; cells: Map<string, string> }[] = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[\s\S]*?<\/row>/g)) {
    const rowXml = rowMatch[0];
    const cells = new Map<string, string>();

    for (const cellMatch of rowXml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[\s\S]*?<\/c>/g)) {
      cells.set(columnFromRef(cellMatch[1]), valueFromCell(cellMatch[0], sharedStrings));
    }

    rows.push({ rowNumber: Number(rowMatch[1]), rowXml, cells });
  }

  return rows;
}

function parseHeaderRow(sheetXml: string, sharedStrings: string[]) {
  const headerRow = parseRows(sheetXml, sharedStrings).find((row) => row.rowNumber === 1);
  if (!headerRow) throw new Error("UNCDF export template is missing a header row.");

  return { headerXml: headerRow.rowXml, headers: [...headerRow.cells.values()] };
}

function cellRef(columnIndex: number, rowNumber: number) {
  let column = "";
  let value = columnIndex + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return `${column}${rowNumber}`;
}

function inlineCell(columnIndex: number, rowNumber: number, value: string) {
  const ref = cellRef(columnIndex, rowNumber);
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function rowXml(rowNumber: number, values: string[]) {
  return `<row r="${rowNumber}">${values.map((value, index) => inlineCell(index, rowNumber, value)).join("")}</row>`;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function firstValue(values: Record<string, string> | undefined, candidates: string[]) {
  if (!values) return "";
  const entries = Object.entries(values);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const exact = entries.find(([key, value]) => normalizeKey(key) === normalizedCandidate && value.trim());
    if (exact) return exact[1].trim();
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const partial = entries.find(([key, value]) => normalizeKey(key).includes(normalizedCandidate) && value.trim());
    if (partial) return partial[1].trim();
  }

  return "";
}

function fullNameFromSource(values: Record<string, string>) {
  const direct = firstValue(values, ["NAME", "Full Name", "Enterprise Owner", "Preferred Name"]);
  if (direct) return direct;

  return [firstValue(values, ["First Name"]), firstValue(values, ["Middle Name"]), firstValue(values, ["Surname"])]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function sourceEso(values: Record<string, string>) {
  return firstValue(values, ["ESO", "Implementing Partner Name", "Downstream Partner"]);
}

function sourcePhones(values: Record<string, string>) {
  return [
    firstValue(values, ["MTN"]),
    firstValue(values, ["AIRTEL"]),
    firstValue(values, ["Primary Phone Number"]),
    firstValue(values, ["Additional Phone Number 1"]),
    firstValue(values, ["Additional Phone Number 2"]),
  ].filter(Boolean);
}

function sourceIdentifiers(values: Record<string, string>) {
  return [
    firstValue(values, ["Primary Key", "Unique ID", "Unique identifier", "Enterprise Unique Identifier", "Unique Key", "UNIQUE KEY", "ID Number"]),
  ].filter(Boolean);
}

function phoneKeys(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];

  const keys = new Set([digits]);
  if (digits.startsWith("256") && digits.length >= 12) keys.add(`0${digits.slice(3)}`);
  if (digits.length >= 9) keys.add(digits.slice(-9));
  return [...keys];
}

function participantIndex(participants: ParticipantSummary[]) {
  const byId = new Map<string, ParticipantSummary>();
  const byExternalId = new Map<string, ParticipantSummary>();
  const byNameEso = new Map<string, ParticipantSummary>();

  for (const participant of participants) {
    if (participant.id) byId.set(participant.id, participant);
    if (participant.externalId) byExternalId.set(participant.externalId, participant);

    const name = normalizeKey(participant.fullName);
    const eso = normalizeKey(participant.esoName);
    if (name && eso && !byNameEso.has(`${name}|${eso}`)) byNameEso.set(`${name}|${eso}`, participant);
  }

  return { byId, byExternalId, byNameEso };
}

function participantFor(record: ConsentRecord, index: ReturnType<typeof participantIndex>) {
  if (record.participantId && index.byId.has(record.participantId)) return index.byId.get(record.participantId);
  if (record.participantExternalId && index.byExternalId.has(record.participantExternalId)) return index.byExternalId.get(record.participantExternalId);

  const name = normalizeKey(record.participantName);
  const eso = normalizeKey(record.esoName);
  if (name && eso) return index.byNameEso.get(`${name}|${eso}`);

  return undefined;
}

function phoneCarrier(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("256") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  const prefix = local.slice(0, 2);

  if (["70", "74", "75", "20"].includes(prefix)) return "airtel";
  if (["76", "77", "78", "39"].includes(prefix)) return "mtn";
  return "unknown";
}

async function loadSourceRowsFromWorkbook(filePath: string) {
  const workbook = await readFile(filePath);
  const zip = await JSZip.loadAsync(workbook);
  const sheetFile = zip.file(sheetPath);
  const sharedStringsFile = zip.file(sharedStringsPath);
  if (!sheetFile) return [];

  const [sheetXml, sharedStringsXml] = await Promise.all([sheetFile.async("string"), sharedStringsFile?.async("string") || ""]);
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseRows(sheetXml, sharedStrings);
  const headerRow = rows.find((row) => row.rowNumber === 1);
  if (!headerRow) return [];

  const headers = [...headerRow.cells.values()];

  return rows
    .filter((row) => row.rowNumber > 1)
    .map((row) => {
      const values = Object.fromEntries(headers.map((header, index) => [header, row.cells.get(cellRef(index, 1).replace("1", "")) || ""]));
      return {
        values,
        name: fullNameFromSource(values),
        eso: sourceEso(values),
        phones: sourcePhones(values),
        identifiers: sourceIdentifiers(values),
      } satisfies SourceRow;
    })
    .filter((row) => Object.values(row.values).some((value) => value.trim()));
}

async function sourceRows() {
  const rows: SourceRow[] = [];
  rows.push(...(await loadSourceRowsFromWorkbook(templatePath)));

  try {
    const folder = dataFolder("sample_dataset");
    const files = await readdir(folder);
    for (const file of files.filter((name) => name.toLowerCase().endsWith(".xlsx"))) {
      rows.push(...(await loadSourceRowsFromWorkbook(join(folder, file))));
    }
  } catch {
    return rows;
  }

  return rows;
}

function sourceIndex(rows: SourceRow[]) {
  const byIdentifier = new Map<string, SourceRow>();
  const byPhone = new Map<string, SourceRow>();
  const byNameEso = new Map<string, SourceRow>();
  const byName = new Map<string, SourceRow>();

  for (const row of rows) {
    for (const identifier of row.identifiers) {
      const key = normalizeKey(identifier);
      if (key && !byIdentifier.has(key)) byIdentifier.set(key, row);
    }

    for (const phone of row.phones.flatMap(phoneKeys)) {
      if (phone && !byPhone.has(phone)) byPhone.set(phone, row);
    }

    const name = normalizeKey(row.name);
    const eso = normalizeKey(row.eso);
    if (name && eso && !byNameEso.has(`${name}|${eso}`)) byNameEso.set(`${name}|${eso}`, row);
    if (name && !byName.has(name)) byName.set(name, row);
  }

  return { byIdentifier, byPhone, byNameEso, byName };
}

function sourceFor(record: ConsentRecord, index: ReturnType<typeof sourceIndex>) {
  for (const identifier of [record.participantExternalId, record.participantId, record.referenceNumber]) {
    const match = identifier ? index.byIdentifier.get(normalizeKey(identifier)) : undefined;
    if (match) return match;
  }

  for (const phone of phoneKeys(record.participantPhone)) {
    const match = index.byPhone.get(phone);
    if (match) return match;
  }

  const name = normalizeKey(record.participantName);
  const eso = normalizeKey(record.esoName);
  if (name && eso) {
    const match = index.byNameEso.get(`${name}|${eso}`);
    if (match) return match;
  }

  return name ? index.byName.get(name) : undefined;
}

function consentValue(record: ConsentRecord, participant: ParticipantSummary | undefined, source: SourceRow | undefined, header: string) {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sourcePhone = firstValue(source?.values, ["MTN", "AIRTEL", "Primary Phone Number", "Additional Phone Number 1", "Additional Phone Number 2"]);
  const phone = record.participantPhone || participant?.phone || sourcePhone || "";
  const participantId = record.participantExternalId || participant?.externalId || record.participantId || participant?.id || record.referenceNumber;
  const carrier = phoneCarrier(phone);

  if (normalized === "eso") return record.esoName || participant?.esoName || sourceEso(source?.values || {}) || record.esoId || participant?.esoId || "";
  if (normalized === "name") return record.participantName || participant?.fullName || source?.name || "";
  if (normalized === "mtn") return firstValue(source?.values, ["MTN"]) || (carrier === "airtel" ? "" : phone);
  if (normalized === "airtel") return firstValue(source?.values, ["AIRTEL"]) || (carrier === "airtel" ? phone : "");
  if (normalized === "type of business") return firstValue(source?.values, ["Type of Business", "Sector", "Enterprise Type"]) || participant?.sector || record.serviceRequired || "";
  if (normalized === "business name") return firstValue(source?.values, ["Business Name", "Enterprise Name"]);
  if (normalized === "registration status") return firstValue(source?.values, ["Registration Status", "Formality"]);
  if (normalized === "duration in business") return firstValue(source?.values, ["Duration in business"]);
  if (normalized === "type of device needed") return firstValue(source?.values, ["Type of device needed"]) || record.serviceRequired || "";
  if (normalized === "amount willing to pay ugx") return firstValue(source?.values, ["Amount willing to pay (UGX)", "Amount willing to pay"]);
  if (normalized === "prefered mode payment" || normalized === "preferred mode payment") return firstValue(source?.values, ["Prefered mode payment", "Preferred mode payment"]);
  if (normalized === "id type") return firstValue(source?.values, ["ID_type", "ID type"]) || (participantId ? "Participant ID" : "");
  if (normalized === "id number") return firstValue(source?.values, ["ID Number", "Unique identifier", "Enterprise Unique Identifier"]) || participantId;
  if (normalized === "district") return firstValue(source?.values, ["District", "Administrative Level2 : District", "Administrative Level2"]) || participant?.district || "";
  if (normalized === "subcounty") return firstValue(source?.values, ["Subcounty", "Administrative Level4: Sub County", "Administrative Level4"]);
  if (normalized === "village") return firstValue(source?.values, ["Village", "Administrative Level5 : Parish", "Administrative Level5", "Home Address"]);
  if (normalized === "primary key") return participantId;
  if (normalized === "unique id") return participantId;
  if (normalized.includes("consent")) return record.referenceNumber;
  if (normalized.includes("phone")) return phone;
  if (normalized.includes("participant")) return participantId || record.participantName || participant?.fullName || "";
  return "";
}

function isUncdfConsent(record: ConsentRecord, filters: UncdfExportFilters) {
  if (record.consentDecision !== "consented") return false;
  if (!["locked", "finalized"].includes(record.status || "")) return false;
  if (filters.eso && record.esoName !== filters.eso && record.esoId !== filters.eso) return false;
  if (filters.from && record.consentDate < filters.from) return false;
  if (filters.to && record.consentDate > filters.to) return false;
  return true;
}

async function loadTemplate() {
  const workbook = await readFile(templatePath);
  const zip = await JSZip.loadAsync(workbook);
  const sheetFile = zip.file(sheetPath);
  const sharedStringsFile = zip.file(sharedStringsPath);

  if (!sheetFile) throw new Error("UNCDF export template is missing Sheet1.");

  const [sheetXml, sharedStringsXml] = await Promise.all([sheetFile.async("string"), sharedStringsFile?.async("string") || ""]);
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const { headerXml, headers } = parseHeaderRow(sheetXml, sharedStrings);

  return { zip, sheetXml, headerXml, headers };
}

async function consentRows(records: ConsentRecord[], headers: string[], filters: UncdfExportFilters) {
  const participants = await getActiveParticipants();
  const participantLookup = participantIndex(participants);
  const sourceLookup = sourceIndex(await sourceRows());

  return [...getCurrentConsents(records).values()]
    .filter((record) => isUncdfConsent(record, filters))
    .map((record, rowIndex) => {
      const participant = participantFor(record, participantLookup);
      const source = sourceFor(record, sourceLookup);

      return {
        rowNumber: rowIndex + 2,
        values: Object.fromEntries(headers.map((header) => [header, consentValue(record, participant, source, header)])),
        match: {
          referenceNumber: record.referenceNumber,
          consentDate: record.consentDate,
          recordedAt: consentRecordedAt(record),
          participantName: record.participantName || participant?.fullName || source?.name || "",
          participantPhone: record.participantPhone || participant?.phone || sourcePhones(source?.values || {})[0] || "",
          esoName: record.esoName || participant?.esoName || source?.eso || "",
          pdfAvailable: Boolean(record.pdfFileKey || record.pdfFile),
          matchedBy: "consent_record" as const,
        },
      };
    });
}

export async function getUncdfGate(records: ConsentRecord[], filters: UncdfExportFilters = {}) {
  const template = await loadTemplate();
  const shareableRows = await consentRows(records, template.headers, filters);

  return {
    rows: shareableRows,
    shareableRows,
    summary: {
      totalRows: shareableRows.length,
      shareableRows: shareableRows.length,
      pendingRows: 0,
      exportedAt: new Date().toISOString(),
    } satisfies UncdfGateSummary,
  };
}

export async function buildUncdfWorkbook(records: ConsentRecord[], filters: UncdfExportFilters = {}) {
  const template = await loadTemplate();
  const shareableRows = await consentRows(records, template.headers, filters);
  const rowCount = Math.max(shareableRows.length + 1, 1);
  const rewrittenRows = [
    template.headerXml,
    ...shareableRows.map((row) => rowXml(row.rowNumber, template.headers.map((header) => row.values[header] || ""))),
  ];
  const nextSheetData = `<sheetData>${rewrittenRows.join("")}</sheetData>`;
  const nextSheetXml = template.sheetXml
    .replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:${lastColumn}${rowCount}"`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, nextSheetData);

  template.zip.file(sheetPath, nextSheetXml);

  return {
    workbook: Buffer.from(await template.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })),
    count: shareableRows.length,
    totalRows: shareableRows.length,
    pendingRows: 0,
  };
}

export function uncdfExportFileName(filters: UncdfExportFilters = {}) {
  const scope = filters.eso ? filters.eso.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") : "all-consented";
  const today = new Date().toISOString().slice(0, 10);
  return `uncdf-consented-participants-${scope}-${today}.xlsx`;
}
