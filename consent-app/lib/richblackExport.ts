import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { getCurrentConsents } from "./analytics";
import { dataPath } from "./dataPaths";
import type { ConsentRecord } from "./db";

const deviceDataPath = dataPath("data_template", "Device_financing_Data.xlsx");
const sheetPath = "xl/worksheets/sheet1.xml";
const sharedStringsPath = "xl/sharedStrings.xml";
const lastColumn = "P";

export type RichblackExportFilters = {
  eso?: string;
  from?: string;
  to?: string;
};

export type RichblackDeviceRow = {
  rowNumber: number;
  rowXml: string;
  values: Record<string, string>;
  match?: RichblackConsentMatch;
};

export type RichblackConsentMatch = {
  referenceNumber: string;
  consentDate: string;
  recordedAt: string;
  participantName: string;
  participantPhone: string;
  esoName: string;
  pdfAvailable: boolean;
  matchedBy: "phone" | "name_eso" | "name";
};

export type RichblackGateSummary = {
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

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function normalizeText(value: string) {
  return decodeXml(stripTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEso(value: string) {
  return normalizeName(value);
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("256") && digits.length >= 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  return digits.startsWith("0") ? digits : digits;
}

function phoneKeys(value: string) {
  const phone = normalizePhone(value);
  if (!phone) return [];
  const keys = new Set([phone]);
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 9) keys.add(digits.slice(-9));
  return [...keys];
}

function isEligibleConsent(record: ConsentRecord, filters: RichblackExportFilters) {
  if (record.consentFormType !== "sample-space") return false;
  if (record.consentDecision !== "consented") return false;
  if (!["locked", "finalized"].includes(record.status || "")) return false;
  if (filters.eso && record.esoName !== filters.eso && record.esoId !== filters.eso) return false;
  if (filters.from && record.consentDate < filters.from) return false;
  if (filters.to && record.consentDate > filters.to) return false;
  return true;
}

function consentMatch(record: ConsentRecord, matchedBy: RichblackConsentMatch["matchedBy"]): RichblackConsentMatch {
  return {
    referenceNumber: record.referenceNumber,
    consentDate: record.consentDate,
    recordedAt: record.auditServerReceivedAt || record.createdAt || record.auditSubmittedAt || record.consentDate,
    participantName: record.participantName,
    participantPhone: record.participantPhone,
    esoName: record.esoName,
    pdfAvailable: Boolean(record.pdfFileKey || record.pdfFile),
    matchedBy,
  };
}

function buildConsentIndex(records: ConsentRecord[], filters: RichblackExportFilters) {
  const byPhone = new Map<string, ConsentRecord>();
  const byNameEso = new Map<string, ConsentRecord>();
  const byName = new Map<string, ConsentRecord>();

  for (const record of getCurrentConsents(records).values()) {
    if (!isEligibleConsent(record, filters)) continue;

    for (const key of phoneKeys(record.participantPhone)) {
      if (!byPhone.has(key)) byPhone.set(key, record);
    }

    const name = normalizeName(record.participantName);
    if (!name) continue;

    const eso = normalizeEso(record.esoName);
    if (eso && !byNameEso.has(`${name}|${eso}`)) byNameEso.set(`${name}|${eso}`, record);
    if (!byName.has(name)) byName.set(name, record);
  }

  return { byPhone, byNameEso, byName };
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
  const parsedRows: { rowNumber: number; rowXml: string; cells: Map<string, string> }[] = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[\s\S]*?<\/row>/g)) {
    const rowXml = rowMatch[0];
    const cells = new Map<string, string>();

    for (const cellMatch of rowXml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[\s\S]*?<\/c>/g)) {
      cells.set(columnFromRef(cellMatch[1]), valueFromCell(cellMatch[0], sharedStrings));
    }

    parsedRows.push({ rowNumber: Number(rowMatch[1]), rowXml, cells });
  }

  return parsedRows;
}

function rowValues(cells: Map<string, string>, headers: string[]) {
  const values: Record<string, string> = {};
  headers.forEach((header, index) => {
    const column = String.fromCharCode("A".charCodeAt(0) + index);
    values[header] = cells.get(column) || "";
  });
  return values;
}

function matchConsent(row: RichblackDeviceRow, index: ReturnType<typeof buildConsentIndex>) {
  const phoneValues = [row.values.MTN, row.values.AIRTEL].flatMap(phoneKeys);
  for (const phone of phoneValues) {
    const match = index.byPhone.get(phone);
    if (match) return consentMatch(match, "phone");
  }

  const name = normalizeName(row.values.NAME || "");
  const eso = normalizeEso(row.values.ESO || "");
  if (name && eso) {
    const match = index.byNameEso.get(`${name}|${eso}`);
    if (match) return consentMatch(match, "name_eso");
  }

  if (name) {
    const match = index.byName.get(name);
    if (match) return consentMatch(match, "name");
  }

  return undefined;
}

function renumberRow(rowXml: string, nextRowNumber: number) {
  const currentRow = rowXml.match(/<row\b[^>]*\br="(\d+)"/)?.[1];
  if (!currentRow) return rowXml;

  return rowXml
    .replace(/\br="\d+"/, `r="${nextRowNumber}"`)
    .replace(new RegExp(`r="([A-Z]+)${currentRow}"`, "g"), `r="$1${nextRowNumber}"`);
}

async function loadDeviceWorkbook() {
  const workbook = await readFile(deviceDataPath);
  const zip = await JSZip.loadAsync(workbook);
  const sheetFile = zip.file(sheetPath);
  const sharedStringsFile = zip.file(sharedStringsPath);

  if (!sheetFile) throw new Error("Device financing workbook is missing Sheet1.");

  const [sheetXml, sharedStringsXml] = await Promise.all([sheetFile.async("string"), sharedStringsFile?.async("string") || ""]);
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseRows(sheetXml, sharedStrings);
  const headerRow = rows.find((row) => row.rowNumber === 1);

  if (!headerRow) throw new Error("Device financing workbook is missing a header row.");

  const headers = [...headerRow.cells.values()];
  const dataRows: RichblackDeviceRow[] = rows
    .filter((row) => row.rowNumber > 1)
    .map((row) => ({
      rowNumber: row.rowNumber,
      rowXml: row.rowXml,
      values: rowValues(row.cells, headers),
    }))
    .filter((row) => Object.values(row.values).some((value) => value.trim()));

  return { zip, sheetXml, headerRow, dataRows };
}

export async function getRichblackGate(records: ConsentRecord[], filters: RichblackExportFilters = {}) {
  const workbook = await loadDeviceWorkbook();
  const consentIndex = buildConsentIndex(records, filters);
  const rows = workbook.dataRows.map((row) => ({ ...row, match: matchConsent(row, consentIndex) }));
  const shareableRows = rows.filter((row) => row.match);

  return {
    rows,
    shareableRows,
    summary: {
      totalRows: rows.length,
      shareableRows: shareableRows.length,
      pendingRows: rows.length - shareableRows.length,
      exportedAt: new Date().toISOString(),
    } satisfies RichblackGateSummary,
  };
}

export async function buildRichblackWorkbook(records: ConsentRecord[], filters: RichblackExportFilters = {}) {
  const workbook = await loadDeviceWorkbook();
  const consentIndex = buildConsentIndex(records, filters);
  const shareableRows = workbook.dataRows
    .map((row) => ({ ...row, match: matchConsent(row, consentIndex) }))
    .filter((row) => row.match);

  const rewrittenRows = [renumberRow(workbook.headerRow.rowXml, 1), ...shareableRows.map((row, index) => renumberRow(row.rowXml, index + 2))];
  const rowCount = Math.max(rewrittenRows.length, 1);
  const nextSheetData = `<sheetData>${rewrittenRows.join("")}</sheetData>`;
  const nextSheetXml = workbook.sheetXml
    .replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:${lastColumn}${rowCount}"`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, nextSheetData);

  workbook.zip.file(sheetPath, nextSheetXml);

  return {
    workbook: Buffer.from(await workbook.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })),
    count: shareableRows.length,
    totalRows: workbook.dataRows.length,
    pendingRows: workbook.dataRows.length - shareableRows.length,
  };
}

export function richblackExportFileName(filters: RichblackExportFilters = {}) {
  const scope = filters.eso ? filters.eso.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") : "all-esos";
  const today = new Date().toISOString().slice(0, 10);
  return `richblack-consented-participants-${scope}-${today}.xlsx`;
}
