import { readdir, readFile } from "node:fs/promises";
import JSZip from "jszip";
import { getCurrentConsents } from "./analytics";
import { dataFolder, dataPath } from "./dataPaths";
import type { ConsentRecord } from "./db";
import { isPoaSampleSource, participantForConsent } from "./poaSample";
import { getActiveParticipants, type ParticipantSummary } from "./participants";

const sampleDataPath = dataFolder("sample_dataset");
const sheetPath = "xl/worksheets/sheet1.xml";
const sharedStringsPath = "xl/sharedStrings.xml";

export type BusalaConsentMatch = {
  referenceNumber: string;
  consentDate: string;
  recordedAt: string;
  participantName: string;
  participantPhone: string;
  esoName: string;
};

export type BusalaDatasetRow = {
  dataset: string;
  rowNumber: number;
  rowXml: string;
  values: Record<string, string>;
  match?: BusalaConsentMatch;
};

type BusalaConsentRow = BusalaDatasetRow & {
  participant: ParticipantSummary;
};

export type BusalaDatasetGate = {
  dataset: string;
  totalRows: number;
  shareableRows: number;
  pendingRows: number;
  rows: BusalaDatasetRow[];
  shareable: BusalaDatasetRow[];
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

function normalizeName(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("256") && digits.length >= 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  return digits.startsWith("0") ? digits : digits;
}

function normalizeId(value: string | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function phoneKeys(value: string | undefined) {
  const phone = normalizePhone(value);
  if (!phone) return [];
  const keys = new Set([phone]);
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 9) keys.add(digits.slice(-9));
  return [...keys];
}

function isEligibleConsent(record: ConsentRecord) {
  if (record.consentFormType !== "sample-space") return false;
  if (record.consentDecision !== "consented") return false;
  if (!["locked", "finalized"].includes(record.status || "")) return false;
  return true;
}

function poaDatasetName(source: string) {
  const normalized = source.toLowerCase();
  if (normalized === "enterprise" || normalized.includes("enterprise")) return "Enterprise POA Sample";
  if (normalized === "yiw" || normalized.includes("yiw")) return "YIW POA Sample";
  if (normalized.includes("weo")) return "WEO Outbox";
  if (normalized.includes("busala")) return "Busala POA Sample";
  return source || "POA Sample";
}

function consentRecordedAt(record: ConsentRecord) {
  return record.auditServerReceivedAt || record.createdAt || record.auditSubmittedAt || record.consentDate;
}

function buildPoaConsentRows(records: ConsentRecord[], participants: ParticipantSummary[]) {
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const participantsByExternalId = new Map(participants.map((participant) => [participant.externalId, participant]));
  const sourceRows = participants.filter((participant) => isPoaSampleSource(participant.source));

  const rows = Array.from(getCurrentConsents(records).values())
    .filter(isEligibleConsent)
    .flatMap((record) => {
      const participant = participantForConsent(record, participantsById, participantsByExternalId);
      return participant && isPoaSampleSource(participant.source) ? [{ record, participant }] : [];
    })
    .map(({ record, participant }, index): BusalaConsentRow => {
      const dataset = poaDatasetName(participant.source);

      return {
        dataset,
        rowNumber: index + 2,
        rowXml: "",
        participant,
        values: {
          "Implementing Partner Name": record.esoName || participant.esoName,
          "Downstream Partner": record.esoName || participant.esoName,
          "Full Name": participant.fullName || record.participantName,
          "Enterprise Owner": participant.fullName || record.participantName,
          "Primary Phone Number": participant.phone || record.participantPhone,
          "Administrative Level2 : District": participant.district,
          "Administrative Level1 : Region": participant.region,
          "Program Name": record.programName,
        },
        match: matchFromRecord(record),
      };
    });

  return { sourceRows, shareableRows: rows };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function poaConsentRowsCsv(rows: BusalaConsentRow[]) {
  const headers = [
    "dataset",
    "participantExternalId",
    "participantName",
    "participantPhone",
    "participantEmail",
    "esoName",
    "district",
    "region",
    "programName",
    "consentReference",
    "consentDate",
    "consentRecordedAt",
  ];

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const values = {
      dataset: row.dataset,
      participantExternalId: row.participant.externalId,
      participantName: busalaRowName(row.values),
      participantPhone: busalaRowPhone(row.values),
      participantEmail: row.participant.email,
      esoName: row.match?.esoName || row.participant.esoName,
      district: row.participant.district,
      region: row.participant.region,
      programName: row.values["Program Name"],
      consentReference: row.match?.referenceNumber || "",
      consentDate: row.match?.consentDate || "",
      consentRecordedAt: row.match?.recordedAt || "",
    };

    lines.push(headers.map((header) => csvCell(values[header as keyof typeof values])).join(","));
  });

  return `${lines.join("\n")}\n`;
}

function buildConsentIndex(records: ConsentRecord[]) {
  const byId = new Map<string, ConsentRecord>();
  const byPhone = new Map<string, ConsentRecord>();
  const byName = new Map<string, ConsentRecord>();

  for (const record of getCurrentConsents(records).values()) {
    if (!isEligibleConsent(record)) continue;

    const idKey = normalizeId(record.participantExternalId || record.participantId || "");
    if (idKey && !byId.has(idKey)) byId.set(idKey, record);

    for (const key of phoneKeys(record.participantPhone)) {
      if (!byPhone.has(key)) byPhone.set(key, record);
    }

    const nameKey = normalizeName(record.participantName);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, record);
  }

  return { byId, byPhone, byName };
}

function matchFromRecord(record: ConsentRecord): BusalaConsentMatch {
  return {
    referenceNumber: record.referenceNumber,
    consentDate: record.consentDate,
    recordedAt: record.auditServerReceivedAt || record.createdAt || record.auditSubmittedAt || record.consentDate,
    participantName: record.participantName,
    participantPhone: record.participantPhone,
    esoName: record.esoName,
  };
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

function columnIndexToName(index: number) {
  let value = index + 1;
  let column = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function valueFromCell(cellXml: string, sharedStrings: string[]) {
  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const inlineMatch = cellXml.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

  if (cellXml.includes('t="s"') && valueMatch) return sharedStrings[Number(valueMatch[1])] || "";
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
    values[header] = cells.get(columnIndexToName(index)) || "";
  });
  return values;
}

function firstValue(values: Record<string, string>, fields: string[]) {
  for (const field of fields) {
    const value = values[field];
    if (value?.trim()) return value.trim();
  }
  return "";
}

export function busalaRowName(values: Record<string, string>) {
  const fullName = firstValue(values, ["Full Name", "Enterprise Owner"]);
  if (fullName) return fullName;
  return [values["First Name"], values["Middle Name"], values.Surname].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function busalaRowPartner(values: Record<string, string>) {
  return firstValue(values, ["Implementing Partner Name", "Downstream Partner"]);
}

export function busalaRowPhone(values: Record<string, string>) {
  return firstValue(values, ["Primary Phone Number", "Additional Phone Number 1", "Additional Phone Number 2"]);
}

export function busalaRowDistrict(values: Record<string, string>) {
  return firstValue(values, ["Administrative Level2 : District", "Administrative Level2", "Administrative Level1 : Region"]);
}

function matchConsent(row: BusalaDatasetRow, index: ReturnType<typeof buildConsentIndex>) {
  const idValues = [row.values["Unique identifier"], row.values["Enterprise Unique Identifier"], row.values["UNIQUE KEY"], row.values["Unique Key"]];
  for (const id of idValues.map(normalizeId).filter(Boolean)) {
    const match = index.byId.get(id);
    if (match) return matchFromRecord(match);
  }

  const phones = [row.values["Primary Phone Number"], row.values["Additional Phone Number 1"], row.values["Additional Phone Number 2"]].flatMap((phone) =>
    phoneKeys(phone || ""),
  );
  for (const phone of phones) {
    const match = index.byPhone.get(phone);
    if (match) return matchFromRecord(match);
  }

  const name = normalizeName(busalaRowName(row.values));
  if (name) {
    const match = index.byName.get(name);
    if (match) return matchFromRecord(match);
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

async function loadDataset(fileName: string) {
  const workbook = await readFile(dataPath("sample_dataset", fileName));
  const zip = await JSZip.loadAsync(workbook);
  const sheetFile = zip.file(sheetPath);
  const sharedStringsFile = zip.file(sharedStringsPath);

  if (!sheetFile) throw new Error(`${fileName} is missing Sheet1.`);

  const [sheetXml, sharedStringsXml] = await Promise.all([sheetFile.async("string"), sharedStringsFile?.async("string") || ""]);
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseRows(sheetXml, sharedStrings);
  const headerRow = rows.find((row) => row.rowNumber === 1);
  if (!headerRow) throw new Error(`${fileName} is missing a header row.`);

  const headers = [...headerRow.cells.values()];
  const dataRows = rows
    .filter((row) => row.rowNumber > 1)
    .map((row) => ({
      dataset: fileName,
      rowNumber: row.rowNumber,
      rowXml: row.rowXml,
      values: rowValues(row.cells, headers),
    }))
    .filter((row) => Object.values(row.values).some((value) => value.trim()));

  return { fileName, zip, sheetXml, headerRow, headers, dataRows };
}

async function busalaFileNames() {
  return (await readdir(sampleDataPath)).filter((fileName) => fileName.toLowerCase().endsWith(".xlsx")).sort();
}

export async function getBusalaGate(records: ConsentRecord[]) {
  const participants = await getActiveParticipants();
  const { sourceRows, shareableRows } = buildPoaConsentRows(records, participants);
  const datasetNames = [...new Set([...sourceRows.map((participant) => poaDatasetName(participant.source)), ...shareableRows.map((row) => row.dataset)])].sort();
  const datasets: BusalaDatasetGate[] = datasetNames.map((dataset) => {
    const sourceCount = sourceRows.filter((participant) => poaDatasetName(participant.source) === dataset).length;
    const shareable = shareableRows.filter((row) => row.dataset === dataset);

    return {
      dataset,
      totalRows: sourceCount,
      shareableRows: shareable.length,
      pendingRows: Math.max(sourceCount - shareable.length, 0),
      rows: shareable,
      shareable,
    };
  });

  const totalRows = sourceRows.length;
  const shareableRowCount = shareableRows.length;

  return {
    datasets,
    shareableRows,
    summary: {
      totalRows,
      shareableRows: shareableRowCount,
      pendingRows: Math.max(totalRows - shareableRowCount, 0),
      exportedAt: new Date().toISOString(),
    },
  };
}

export async function buildBusalaExport(records: ConsentRecord[]) {
  const participants = await getActiveParticipants();
  const { sourceRows, shareableRows } = buildPoaConsentRows(records, participants);
  const bundle = new JSZip();
  bundle.file("busala-poa-consented-participants.csv", poaConsentRowsCsv(shareableRows));

  return {
    archive: Buffer.from(await bundle.generateAsync({ type: "uint8array", compression: "DEFLATE" })),
    count: shareableRows.length,
    totalRows: sourceRows.length,
    pendingRows: Math.max(sourceRows.length - shareableRows.length, 0),
  };
}

export function busalaExportFileName() {
  const today = new Date().toISOString().slice(0, 10);
  return `busala-consented-sample-data-${today}.zip`;
}
