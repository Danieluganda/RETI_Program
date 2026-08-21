import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { getCurrentConsents } from "./analytics";
import { dataPath } from "./dataPaths";
import { consentRecordedAt } from "./dateTime";
import type { ConsentRecord } from "./db";

const templatePath = dataPath("data_template", "Device_financing_Data.xlsx");
const sheetPath = "xl/worksheets/sheet1.xml";
const sharedStringsPath = "xl/sharedStrings.xml";
const lastColumn = "P";

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

function parseHeaderRow(sheetXml: string, sharedStrings: string[]) {
  const headerXml = sheetXml.match(/<row\b[^>]*\br="1"[\s\S]*?<\/row>/)?.[0];
  if (!headerXml) throw new Error("UNCDF export template is missing a header row.");

  const headers = new Map<string, string>();
  for (const cellMatch of headerXml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[\s\S]*?<\/c>/g)) {
    headers.set(columnFromRef(cellMatch[1]), valueFromCell(cellMatch[0], sharedStrings));
  }

  return { headerXml, headers: [...headers.values()] };
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

function consentValue(record: ConsentRecord, header: string) {
  const normalized = header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const phone = record.participantPhone || "";

  if (normalized === "eso") return record.esoName || record.esoId;
  if (normalized === "name") return record.participantName;
  if (normalized === "mtn") return phone;
  if (normalized === "airtel") return "";
  if (normalized === "type of business") return record.programName || record.serviceRequired;
  if (normalized === "type of device needed") return record.serviceRequired || "";
  if (normalized === "prefered mode payment" || normalized === "preferred mode payment") return "";
  if (normalized === "primary key") return record.participantExternalId || record.participantId || record.referenceNumber;
  if (normalized === "unique id") return record.participantExternalId || record.participantId || record.referenceNumber;
  if (normalized.includes("consent")) return record.referenceNumber;
  if (normalized.includes("phone")) return phone;
  if (normalized.includes("participant")) return record.participantExternalId || record.participantId || record.participantName;
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

function consentRows(records: ConsentRecord[], headers: string[], filters: UncdfExportFilters) {
  return [...getCurrentConsents(records).values()]
    .filter((record) => isUncdfConsent(record, filters))
    .map((record, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header) => [header, consentValue(record, header)])),
      match: {
        referenceNumber: record.referenceNumber,
        consentDate: record.consentDate,
        recordedAt: consentRecordedAt(record),
        participantName: record.participantName,
        participantPhone: record.participantPhone,
        esoName: record.esoName,
        pdfAvailable: Boolean(record.pdfFileKey || record.pdfFile),
        matchedBy: "consent_record" as const,
      },
    }));
}

export async function getUncdfGate(records: ConsentRecord[], filters: UncdfExportFilters = {}) {
  const template = await loadTemplate();
  const shareableRows = consentRows(records, template.headers, filters);

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
  const shareableRows = consentRows(records, template.headers, filters);
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
