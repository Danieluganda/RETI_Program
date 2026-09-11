import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { getCurrentConsents } from "./analytics";
import { dataPath } from "./dataPaths";
import { consentRecordedAt } from "./dateTime";
import type { ConsentRecord } from "./db";
import type { ParticipantSummary } from "./participants";

const sourceWorkbooks = [
  {
    fileName: "Finding XY WEO, YIW & Enterprise POA Data.xlsx",
    expectedEso: "Finding XY",
  },
  {
    fileName: "Challenges UG WEO, YIW & Enterprise POA Data.xlsx",
    expectedEso: "Challenges Uganda",
  },
] as const;
const sourceFileNames = sourceWorkbooks.map((source) => source.fileName);
const sharedStringsPath = "xl/sharedStrings.xml";

export type NorthernUgandaActivityRow = {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  mainParticipantStatus: string;
  mainParticipantId: string;
  mainParticipantSource: string;
  mainParticipantMatches: number;
  consentRouteStatus: string;
  esoName: string;
  participantReference: string;
  participantName: string;
  sourcePhone: string;
  phone: string;
  possibleCorrectPhone: string;
  phoneQuality: string;
  email: string;
  matchedBy: string;
  district: string;
  region: string;
  sector: string;
  reachedStatus: string;
  consentStatus: string;
  reasonNotCompleted: string;
  youthInWorkStatus: string;
  youthInWorkNotes: string;
  followUpOwner: string;
  lastContactedDate: string;
  nextFollowUpDate: string;
  consentReference: string;
  consentDateTime: string;
};

export type NorthernUgandaActivityGate = {
  sourceFile: string;
  selectedDistrict: string;
  selectedEso: string;
  districtOptions: string[];
  esoOptions: string[];
  rows: NorthernUgandaActivityRow[];
  summary: {
    sourceRows: number;
    totalRows: number;
    inMainDataset: number;
    missingFromMainDataset: number;
    duplicateMainMatches: number;
    readyForConsentRoute: number;
    findingXyRows: number;
    challengesRows: number;
    reached: number;
    completedConsent: number;
    pendingConsent: number;
    declinedConsent: number;
    youthInWorkCaptured: number;
    lastCheckedAt: string;
  };
};

type SourceRow = {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  expectedEso: (typeof sourceWorkbooks)[number]["expectedEso"];
  values: Record<string, string>;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeText(value: string) {
  return decodeXml(String(value || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("256") && digits.length >= 12) return digits.slice(-9);
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

function displayNameCase(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function canonicalDistrictName(value: string) {
  const clean = normalizeText(value);
  if (!clean) return "";

  const parts = clean
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
  const uniqueParts = [...new Map(parts.map((part) => [normalizeKey(part), part])).values()];

  if (uniqueParts.length === 1) return displayNameCase(uniqueParts[0]);
  return displayNameCase(uniqueParts.join(", "));
}

function phoneQuality(value: string) {
  const raw = normalizeText(value);
  const digits = raw.replace(/\D/g, "");
  const local = normalizePhone(raw);

  if (!raw) return { usable: false, label: "Missing phone" };
  if (raw.includes("#")) return { usable: false, label: "Invalid placeholder phone" };
  if (!digits) return { usable: false, label: "Invalid phone" };
  if (local.length < 9) return { usable: false, label: "Incomplete phone" };
  if (/^(\d)\1+$/.test(local)) return { usable: false, label: "Repeated digit placeholder" };
  if (/(.)\1{5,}/.test(local)) return { usable: false, label: "Suspicious repeated digits" };
  if (local.endsWith("000000")) return { usable: false, label: "Suspicious zero placeholder" };

  return { usable: true, label: "Valid phone" };
}

function firstPhone(values: Record<string, string>) {
  return firstValue(values, ["Primary Phone Number", "Additional Phone Number 1", "Additional Phone Number 2"]);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    const textParts = [...match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1]));
    strings.push(textParts.length ? textParts.join("") : normalizeText(match[0].replace(/<[^>]+>/g, "")));
  }
  return strings;
}

function columnFromRef(ref: string) {
  return ref.replace(/\d+/g, "");
}

function columnName(index: number) {
  let column = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function sheetPathFromTarget(target: string) {
  return `xl/${target.replace(/^\//, "")}`;
}

function xmlAttributes(xml: string) {
  const attributes = new Map<string, string>();
  for (const match of xml.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    attributes.set(match[1], decodeXml(match[2]));
  }
  return attributes;
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
  const rows: { rowNumber: number; cells: Map<string, string> }[] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[\s\S]*?<\/row>/g)) {
    const cells = new Map<string, string>();
    for (const cellMatch of rowMatch[0].matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[\s\S]*?<\/c>/g)) {
      cells.set(columnFromRef(cellMatch[1]), normalizeText(valueFromCell(cellMatch[0], sharedStrings)));
    }
    rows.push({ rowNumber: Number(rowMatch[1]), cells });
  }
  return rows;
}

function firstValue(values: Record<string, string>, candidates: string[]) {
  const entries = Object.entries(values);
  for (const candidate of candidates) {
    const exact = entries.find(([key, value]) => normalizeKey(key) === normalizeKey(candidate) && value.trim());
    if (exact) return exact[1];
  }
  for (const candidate of candidates) {
    const partial = entries.find(([key, value]) => normalizeKey(key).includes(normalizeKey(candidate)) && value.trim());
    if (partial) return partial[1];
  }
  return "";
}

function fullName(values: Record<string, string>) {
  const preferred = firstValue(values, ["Preferred Name", "Full Name", "Enterprise Owner", "Enterprise Name"]);
  if (preferred) return preferred;

  return [
    firstValue(values, ["First Name"]),
    firstValue(values, ["Middle Name"]),
    firstValue(values, ["Surname"]),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function esoName(values: Record<string, string>, fallbackEso = "") {
  const raw = firstValue(values, ["ESO", "Name of Sub-partners", "Downstream Partner", "Implementing Partner Name"]);
  const key = normalizeKey(raw);
  if (key.includes("challenge")) return "Challenges Uganda";
  if (key.includes("finding") || key.includes("xy")) return "Finding XY";
  if (fallbackEso) return fallbackEso;
  return raw;
}

function isSelectedEso(values: Record<string, string>, fallbackEso: string) {
  const eso = esoName(values, fallbackEso);
  return eso === "Finding XY" || eso === "Challenges Uganda";
}

function consentIndexes(records: ConsentRecord[]) {
  const byEmail = new Map<string, ConsentRecord>();
  const byExternalId = new Map<string, ConsentRecord>();
  const byPhone = new Map<string, ConsentRecord>();
  const byNameEso = new Map<string, ConsentRecord>();

  for (const record of getCurrentConsents(records).values()) {
    if (record.consentDecision !== "consented" && record.consentDecision !== "declined") continue;
    const email = record.participantEmail ? normalizeEmail(record.participantEmail) : "";
    if (email && !byEmail.has(email)) byEmail.set(email, record);
    if (record.participantExternalId) byExternalId.set(normalizeKey(record.participantExternalId), record);
    const phone = normalizePhone(record.participantPhone);
    if (phone && phoneQuality(record.participantPhone).usable && !byPhone.has(phone)) byPhone.set(phone, record);
    const name = normalizeKey(record.participantName);
    const eso = normalizeKey(record.esoName);
    if (name && eso && !byNameEso.has(`${name}|${eso}`)) byNameEso.set(`${name}|${eso}`, record);
  }

  return { byEmail, byExternalId, byPhone, byNameEso };
}

function matchConsent(values: Record<string, string>, indexes: ReturnType<typeof consentIndexes>, fallbackEso: string) {
  const email = normalizeEmail(firstValue(values, ["Email"]));
  const byEmail = email ? indexes.byEmail.get(email) : undefined;
  if (byEmail) return { record: byEmail, matchedBy: "email" };

  const name = normalizeKey(fullName(values));
  const eso = normalizeKey(esoName(values, fallbackEso));
  const byNameEso = name && eso ? indexes.byNameEso.get(`${name}|${eso}`) : undefined;
  if (byNameEso) return { record: byNameEso, matchedBy: "name + ESO" };

  const reference = firstValue(values, ["Unique identifier", "Unique Key", "Enterprise Unique Identifier", "UNIQUE KEY"]);
  const byReference = reference ? indexes.byExternalId.get(normalizeKey(reference)) : undefined;
  if (byReference) return { record: byReference, matchedBy: "participant reference" };

  const sourcePhone = firstPhone(values);
  const phone = normalizePhone(sourcePhone);
  const byPhone = phone && phoneQuality(sourcePhone).usable ? indexes.byPhone.get(phone) : undefined;
  if (byPhone) return { record: byPhone, matchedBy: "valid phone" };

  return undefined;
}

function participantIndexes(participants: ParticipantSummary[]) {
  const byEmail = new Map<string, ParticipantSummary[]>();
  const byExternalId = new Map<string, ParticipantSummary[]>();
  const byPhone = new Map<string, ParticipantSummary[]>();
  const byNameEso = new Map<string, ParticipantSummary[]>();

  function add(index: Map<string, ParticipantSummary[]>, key: string, participant: ParticipantSummary) {
    if (!key) return;
    index.set(key, [...(index.get(key) || []), participant]);
  }

  for (const participant of participants) {
    add(byEmail, normalizeEmail(participant.email), participant);
    add(byExternalId, normalizeKey(participant.externalId), participant);
    if (phoneQuality(participant.phone).usable) add(byPhone, normalizePhone(participant.phone), participant);
    const name = normalizeKey(participant.fullName);
    const eso = normalizeKey(participant.esoName);
    if (name && eso) add(byNameEso, `${name}|${eso}`, participant);
  }

  return { byEmail, byExternalId, byPhone, byNameEso };
}

function matchParticipants(values: Record<string, string>, indexes: ReturnType<typeof participantIndexes>, fallbackEso: string) {
  const email = normalizeEmail(firstValue(values, ["Email"]));
  const byEmail = email ? indexes.byEmail.get(email) : undefined;
  if (byEmail?.length) return { participants: byEmail, matchedBy: "email" };

  const name = normalizeKey(fullName(values));
  const eso = normalizeKey(esoName(values, fallbackEso));
  const byNameEso = name && eso ? indexes.byNameEso.get(`${name}|${eso}`) : undefined;
  if (byNameEso?.length) return { participants: byNameEso, matchedBy: "name + ESO" };

  const reference = firstValue(values, ["Unique identifier", "Unique Key", "Enterprise Unique Identifier", "UNIQUE KEY"]);
  const byReference = reference ? indexes.byExternalId.get(normalizeKey(reference)) : undefined;
  if (byReference?.length) return { participants: byReference, matchedBy: "participant reference" };

  const sourcePhone = firstPhone(values);
  const phone = normalizePhone(sourcePhone);
  const byPhone = phone && phoneQuality(sourcePhone).usable ? indexes.byPhone.get(phone) : undefined;
  if (byPhone?.length) return { participants: byPhone, matchedBy: "valid phone" };

  return { participants: [], matchedBy: "" };
}

function sourceContactIndexes(rows: SourceRow[]) {
  const byEmail = new Map<string, string[]>();
  const byReference = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  const byNameEso = new Map<string, string[]>();

  function add(index: Map<string, string[]>, key: string, phone: string) {
    if (!key || !phoneQuality(phone).usable) return;
    const existing = index.get(key) || [];
    if (!existing.some((value) => normalizePhone(value) === normalizePhone(phone))) index.set(key, [...existing, phone]);
  }

  for (const row of rows) {
    const phone = firstPhone(row.values);
    const email = normalizeEmail(firstValue(row.values, ["Email"]));
    const reference = normalizeKey(firstValue(row.values, ["Unique identifier", "Unique Key", "Enterprise Unique Identifier", "UNIQUE KEY"]));
    const name = normalizeKey(fullName(row.values));
    const eso = normalizeKey(esoName(row.values, row.expectedEso));

    add(byEmail, email, phone);
    add(byReference, reference, phone);
    add(byName, name, phone);
    if (name && eso) add(byNameEso, `${name}|${eso}`, phone);
  }

  return { byEmail, byReference, byName, byNameEso };
}

function possibleSourcePhones(values: Record<string, string>, indexes: ReturnType<typeof sourceContactIndexes>, fallbackEso: string) {
  const candidates: string[] = [];
  const email = normalizeEmail(firstValue(values, ["Email"]));
  const reference = normalizeKey(firstValue(values, ["Unique identifier", "Unique Key", "Enterprise Unique Identifier", "UNIQUE KEY"]));
  const name = normalizeKey(fullName(values));
  const eso = normalizeKey(esoName(values, fallbackEso));

  const lookups: Array<[Map<string, string[]>, string]> = [
    [indexes.byEmail, email],
    [indexes.byReference, reference],
    [indexes.byNameEso, name && eso ? `${name}|${eso}` : ""],
    [indexes.byName, name],
  ];

  for (const [index, key] of lookups) {
    if (!key) continue;
    for (const phone of index.get(key) || []) {
      if (!candidates.some((candidate) => normalizePhone(candidate) === normalizePhone(phone))) candidates.push(phone);
    }
  }

  return candidates;
}

function youthInWorkStatus(sourceSheet: string) {
  return normalizeKey(sourceSheet).includes("yiw") ? "Captured in YIW source" : "To be checked";
}

function districtName(values: Record<string, string>) {
  return canonicalDistrictName(firstValue(values, ["Administrative Level2 : District", "Administrative Level2", "District"]));
}

function sourceHeaderValues(headerRow: { cells: Map<string, string> }) {
  const headers: string[] = [];
  for (let index = 0; index < 80; index += 1) {
    const value = headerRow.cells.get(columnName(index));
    if (value) headers.push(value);
  }
  return headers;
}

async function workbookSheets(zip: JSZip, sourceFileName: string) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relationshipsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relationshipsXml) throw new Error(`${sourceFileName} is missing workbook metadata.`);

  const relationships = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const attributes = xmlAttributes(match[0]);
    const id = attributes.get("Id") || "";
    const target = attributes.get("Target") || "";
    if (id && target) relationships.set(id, target);
  }

  return [...workbookXml.matchAll(/<sheet\b[^>]*\/?>/g)]
    .map((match) => {
      const attributes = xmlAttributes(match[0]);
      return {
        name: attributes.get("name") || "",
        path: relationships.get(attributes.get("r:id") || "") || "",
      };
    })
    .filter((sheet) => sheet.path);
}

async function sourceRows() {
  const allRows: SourceRow[] = [];

  for (const sourceWorkbook of sourceWorkbooks) {
    const workbook = await readFile(dataPath("email_ask", sourceWorkbook.fileName));
    const zip = await JSZip.loadAsync(workbook);
    const sheets = await workbookSheets(zip, sourceWorkbook.fileName);
    if (!sheets.length) throw new Error(`${sourceWorkbook.fileName} does not contain worksheets.`);

    const sharedStringsXml = (await zip.file(sharedStringsPath)?.async("string")) || "";
    const sharedStrings = parseSharedStrings(sharedStringsXml);

    for (const sheet of sheets) {
      const sheetFile = zip.file(sheetPathFromTarget(sheet.path));
      if (!sheetFile) continue;

      const parsedRows = parseRows(await sheetFile.async("string"), sharedStrings);
      const headerRow = parsedRows.find((row) => row.rowNumber === 1);
      if (!headerRow) continue;

      const headers = sourceHeaderValues(headerRow);
      allRows.push(
        ...parsedRows
          .filter((row) => row.rowNumber > 1)
          .map((row) => ({
            sourceFile: sourceWorkbook.fileName,
            sourceSheet: sheet.name,
            sourceRow: row.rowNumber,
            expectedEso: sourceWorkbook.expectedEso,
            values: Object.fromEntries(headers.map((header, index) => [header, row.cells.get(columnName(index)) || ""])),
          }))
          .filter((row) => Object.values(row.values).some((value) => value.trim()))
          .filter((row) => isSelectedEso(row.values, sourceWorkbook.expectedEso)),
      );
    }
  }

  return allRows;
}

export async function getNorthernUgandaActivityGate(
  records: ConsentRecord[],
  options: { district?: string; eso?: string; participants?: ParticipantSummary[] } = {},
): Promise<NorthernUgandaActivityGate> {
  const indexes = consentIndexes(records);
  const participantMatches = participantIndexes(options.participants || []);
  const selectedDistrict = canonicalDistrictName(options.district || "");
  const selectedEso = normalizeText(options.eso || "");
  const sourceActivityRows = await sourceRows();
  const sourceContacts = sourceContactIndexes(sourceActivityRows);
  const allRows: NorthernUgandaActivityRow[] = sourceActivityRows.map((source) => {
    const consentMatch = matchConsent(source.values, indexes, source.expectedEso);
    const consent = consentMatch?.record;
    const participantMatch = matchParticipants(source.values, participantMatches, source.expectedEso);
    const matchedParticipants = participantMatch.participants;
    const primaryParticipant = matchedParticipants[0];
    const sourcePhone = firstPhone(source.values);
    const quality = phoneQuality(sourcePhone);
    const workbookPhoneSuggestions = possibleSourcePhones(source.values, sourceContacts, source.expectedEso).filter(
      (phone) => normalizePhone(phone) !== normalizePhone(sourcePhone),
    );
    const possibleCorrectPhone =
      !quality.usable && primaryParticipant?.phone && phoneQuality(primaryParticipant.phone).usable
        ? primaryParticipant.phone
        : !quality.usable && consent?.participantPhone && phoneQuality(consent.participantPhone).usable
          ? consent.participantPhone
          : !quality.usable && workbookPhoneSuggestions.length
            ? workbookPhoneSuggestions.join(" / ")
            : "";
    const consentCompleted = Boolean(consent);
    const declinedConsent = consent?.consentDecision === "declined";
    const mainParticipantStatus =
      matchedParticipants.length > 1
        ? "Duplicate in main dataset"
        : primaryParticipant
          ? "Found in main dataset"
          : "Missing from main dataset";

    return {
      sourceFile: source.sourceFile,
      sourceSheet: source.sourceSheet,
      sourceRow: source.sourceRow,
      mainParticipantStatus,
      mainParticipantId: primaryParticipant?.id || "",
      mainParticipantSource: primaryParticipant?.source || "",
      mainParticipantMatches: matchedParticipants.length,
      consentRouteStatus: primaryParticipant ? "Ready for /consent/new" : "Needs import before /consent/new",
      esoName: esoName(source.values, source.expectedEso),
      participantReference: firstValue(source.values, ["Unique identifier", "Unique Key", "Enterprise Unique Identifier", "UNIQUE KEY"]),
      participantName: fullName(source.values),
      sourcePhone,
      phone: sourcePhone,
      possibleCorrectPhone,
      phoneQuality: quality.usable ? quality.label : possibleCorrectPhone ? `${quality.label}; possible correction found` : quality.label,
      email: firstValue(source.values, ["Email"]),
      matchedBy: consentMatch?.matchedBy || participantMatch.matchedBy || "",
      district: districtName(source.values),
      region: firstValue(source.values, ["Administrative Level1 : Region", "Administrative Level1", "Region"]),
      sector: firstValue(source.values, ["Sector", "Type of Business"]),
      reachedStatus: consentCompleted ? "Reached" : "Pending field update",
      consentStatus: consent ? consent.consentDecision : "Pending consent",
      reasonNotCompleted: declinedConsent ? "Participant declined consent" : consentCompleted ? "" : "To be captured by field team",
      youthInWorkStatus: youthInWorkStatus(source.sourceSheet),
      youthInWorkNotes: "",
      followUpOwner: firstValue(source.values, ["ESO", "Name of Sub-partners", "Downstream Partner", "Implementing Partner Name"]),
      lastContactedDate: "",
      nextFollowUpDate: "",
      consentReference: consent?.referenceNumber || "",
      consentDateTime: consent ? consentRecordedAt(consent) : "",
    };
  });
  const districtOptions = [...new Set(allRows.map((row) => row.district).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const esoOptions = [...new Set(allRows.map((row) => row.esoName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const rows = allRows.filter((row) => {
    const districtMatches = selectedDistrict ? normalizeKey(row.district) === normalizeKey(selectedDistrict) : true;
    const esoMatches = selectedEso ? normalizeKey(row.esoName) === normalizeKey(selectedEso) : true;
    return districtMatches && esoMatches;
  });

  return {
    sourceFile: sourceFileNames.join(", "),
    selectedDistrict,
    selectedEso,
    districtOptions,
    esoOptions,
    rows,
    summary: {
      sourceRows: allRows.length,
      totalRows: rows.length,
      inMainDataset: rows.filter((row) => row.mainParticipantMatches > 0).length,
      missingFromMainDataset: rows.filter((row) => row.mainParticipantMatches === 0).length,
      duplicateMainMatches: rows.filter((row) => row.mainParticipantMatches > 1).length,
      readyForConsentRoute: rows.filter((row) => row.consentRouteStatus === "Ready for /consent/new").length,
      findingXyRows: rows.filter((row) => row.esoName === "Finding XY").length,
      challengesRows: rows.filter((row) => row.esoName === "Challenges Uganda").length,
      reached: rows.filter((row) => row.reachedStatus === "Reached").length,
      completedConsent: rows.filter((row) => row.consentStatus === "consented").length,
      pendingConsent: rows.filter((row) => row.consentStatus === "Pending consent").length,
      declinedConsent: rows.filter((row) => row.consentStatus === "declined").length,
      youthInWorkCaptured: rows.filter((row) => row.youthInWorkStatus !== "To be checked").length,
      lastCheckedAt: new Date().toISOString(),
    },
  };
}

export function northernUgandaActivityCsv(rows: NorthernUgandaActivityRow[]) {
  const headers: (keyof NorthernUgandaActivityRow)[] = [
    "sourceFile",
    "sourceSheet",
    "sourceRow",
    "mainParticipantStatus",
    "mainParticipantId",
    "mainParticipantSource",
    "mainParticipantMatches",
    "consentRouteStatus",
    "esoName",
    "participantReference",
    "participantName",
    "sourcePhone",
    "phone",
    "possibleCorrectPhone",
    "phoneQuality",
    "email",
    "matchedBy",
    "district",
    "region",
    "sector",
    "reachedStatus",
    "consentStatus",
    "reasonNotCompleted",
    "youthInWorkStatus",
    "youthInWorkNotes",
    "followUpOwner",
    "lastContactedDate",
    "nextFollowUpDate",
    "consentReference",
    "consentDateTime",
  ];

  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}
