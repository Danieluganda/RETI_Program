import { PrismaClient, type Consent } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasBlobStorage, readTextBlob, writeTextBlob } from "./storage";

export type ConsentRecord = {
  id: string;
  referenceNumber: string;
  participantId: string;
  esoId: string;
  participantName: string;
  participantPhone: string;
  participantExternalId: string;
  programName: string;
  esoName: string;
  consentFormType: string;
  implementingOrganization: string;
  dataCollectorOrganization: string;
  dataCollectorContact: string;
  privacyOrganization: string;
  privacyPolicyUrl: string;
  withdrawalContact: string;
  dataSharingOrganization: string;
  consentDecision: string;
  serviceRequired: string;
  authorizedPartners: string[];
  dataShared: string[];
  informationUnderstood: boolean;
  signingMethod: string;
  signatureFile: string;
  signatureFileKey: string;
  interpreterUsed: boolean;
  interpreterName: string;
  interpreterOrganization: string;
  interpreterLanguage: string;
  interpreterSignatureFile: string;
  interpreterSignatureFileKey: string;
  collectorName: string;
  collectorId: string;
  consentDate: string;
  consentFormVersion: string;
  pdfFile: string;
  pdfFileKey: string;
  pdfGeneratedAt: string;
  pdfStatus: string;
  status: "locked";
  createdAt: string;
};

const dataDir = join(process.cwd(), "private");
const dataFile = join(dataDir, "consents.json");
const blobDataFile = "metadata/consents.json";
const usePrisma = Boolean(process.env.DATABASE_URL?.startsWith("postgres"));

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function prisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

type LegacyConsentRow = Omit<ConsentRecord, "status"> & {
  status: string;
  consentDate: Date | string;
  pdfGeneratedAt: Date | string | null;
  createdAt: Date | string;
};

function formatDateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function toLegacyRecord(record: LegacyConsentRow): ConsentRecord {
  return {
    id: record.id,
    referenceNumber: record.referenceNumber,
    participantId: record.participantId || "",
    esoId: record.esoId || "",
    participantName: record.participantName,
    participantPhone: record.participantPhone || "",
    participantExternalId: record.participantExternalId || "",
    programName: record.programName,
    esoName: record.esoName || "",
    consentFormType: record.consentFormType,
    implementingOrganization: record.implementingOrganization || "",
    dataCollectorOrganization: record.dataCollectorOrganization || "",
    dataCollectorContact: record.dataCollectorContact || "",
    privacyOrganization: record.privacyOrganization || "",
    privacyPolicyUrl: record.privacyPolicyUrl || "",
    withdrawalContact: record.withdrawalContact || "",
    dataSharingOrganization: record.dataSharingOrganization || "",
    consentDecision: record.consentDecision,
    serviceRequired: record.serviceRequired || "",
    authorizedPartners: record.authorizedPartners || [],
    dataShared: record.dataShared || [],
    informationUnderstood: record.informationUnderstood,
    signingMethod: record.signingMethod,
    signatureFile: record.signatureFile,
    signatureFileKey: record.signatureFileKey,
    interpreterUsed: record.interpreterUsed,
    interpreterName: record.interpreterName || "",
    interpreterOrganization: record.interpreterOrganization || "",
    interpreterLanguage: record.interpreterLanguage || "",
    interpreterSignatureFile: record.interpreterSignatureFile || "",
    interpreterSignatureFileKey: record.interpreterSignatureFileKey || "",
    collectorName: record.collectorName || "",
    collectorId: record.collectorId || "",
    consentDate: formatDateOnly(record.consentDate),
    consentFormVersion: record.consentFormVersion,
    pdfFile: record.pdfFile || "",
    pdfFileKey: record.pdfFileKey || "",
    pdfGeneratedAt: formatDateTime(record.pdfGeneratedAt),
    pdfStatus: record.pdfStatus || (record.pdfFileKey ? "generated" : ""),
    status: "locked",
    createdAt: formatDateTime(record.createdAt),
  };
}

async function getLegacyConsents() {
  const records = await prisma().$queryRaw<LegacyConsentRow[]>`
    SELECT
      id,
      "referenceNumber",
      '' as "participantId",
      '' as "esoId",
      "participantName",
      "participantPhone",
      "participantExternalId",
      "programName",
      "esoName",
      "consentFormType",
      "implementingOrganization",
      "dataCollectorOrganization",
      "dataCollectorContact",
      "privacyOrganization",
      "privacyPolicyUrl",
      "withdrawalContact",
      "dataSharingOrganization",
      "consentDecision",
      "serviceRequired",
      "authorizedPartners",
      "dataShared",
      "informationUnderstood",
      "signingMethod",
      "signatureFile",
      "signatureFileKey",
      "interpreterUsed",
      "interpreterName",
      "interpreterOrganization",
      "interpreterLanguage",
      "interpreterSignatureFile",
      "interpreterSignatureFileKey",
      "collectorName",
      "collectorId",
      "consentDate",
      "consentFormVersion",
      "pdfFile",
      "pdfFileKey",
      "pdfGeneratedAt",
      CASE WHEN "pdfFileKey" IS NOT NULL AND "pdfFileKey" <> '' THEN 'generated' ELSE '' END as "pdfStatus",
      status,
      "createdAt"
    FROM "Consent"
    ORDER BY "createdAt" DESC
  `;

  return records.map(toLegacyRecord);
}

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readBlobConsents() {
  try {
    const file = await readTextBlob(blobDataFile);
    return JSON.parse(file || "[]") as ConsentRecord[];
  } catch {
    await writeTextBlob(blobDataFile, "[]\n");
    return [];
  }
}

async function writeBlobConsents(records: ConsentRecord[]) {
  await writeTextBlob(blobDataFile, `${JSON.stringify(records, null, 2)}\n`);
}

function toRecord(record: Consent): ConsentRecord {
  return {
    id: record.id,
    referenceNumber: record.referenceNumber,
    participantId: record.participantId || "",
    esoId: record.esoId || "",
    participantName: record.participantName,
    participantPhone: record.participantPhone || "",
    participantExternalId: record.participantExternalId || "",
    programName: record.programName,
    esoName: record.esoName || "",
    consentFormType: record.consentFormType,
    implementingOrganization: record.implementingOrganization || "",
    dataCollectorOrganization: record.dataCollectorOrganization || "",
    dataCollectorContact: record.dataCollectorContact || "",
    privacyOrganization: record.privacyOrganization || "",
    privacyPolicyUrl: record.privacyPolicyUrl || "",
    withdrawalContact: record.withdrawalContact || "",
    dataSharingOrganization: record.dataSharingOrganization || "",
    consentDecision: record.consentDecision,
    serviceRequired: record.serviceRequired || "",
    authorizedPartners: record.authorizedPartners,
    dataShared: record.dataShared,
    informationUnderstood: record.informationUnderstood,
    signingMethod: record.signingMethod,
    signatureFile: record.signatureFile,
    signatureFileKey: record.signatureFileKey,
    interpreterUsed: record.interpreterUsed,
    interpreterName: record.interpreterName || "",
    interpreterOrganization: record.interpreterOrganization || "",
    interpreterLanguage: record.interpreterLanguage || "",
    interpreterSignatureFile: record.interpreterSignatureFile || "",
    interpreterSignatureFileKey: record.interpreterSignatureFileKey || "",
    collectorName: record.collectorName || "",
    collectorId: record.collectorId || "",
    consentDate: record.consentDate.toISOString().slice(0, 10),
    consentFormVersion: record.consentFormVersion,
    pdfFile: record.pdfFile || "",
    pdfFileKey: record.pdfFileKey || "",
    pdfGeneratedAt: record.pdfGeneratedAt?.toISOString() || "",
    pdfStatus: record.pdfStatus || "",
    status: "locked",
    createdAt: record.createdAt.toISOString(),
  };
}

export async function getConsents() {
  if (usePrisma) {
    try {
      const records = await prisma().consent.findMany({ orderBy: { createdAt: "desc" } });
      return records.map(toRecord);
    } catch (error) {
      if (isMissingColumnError(error)) {
        return getLegacyConsents();
      }
      throw error;
    }
  }

  if (hasBlobStorage()) {
    return readBlobConsents();
  }

  await ensureDataFile();
  const file = await readFile(dataFile, "utf8");
  return JSON.parse(file || "[]") as ConsentRecord[];
}

export async function saveConsent(record: ConsentRecord) {
  if (usePrisma) {
    const saved = await prisma().consent.create({
      data: {
        id: record.id,
        referenceNumber: record.referenceNumber,
        participantId: record.participantId || null,
        esoId: record.esoId || null,
        participantName: record.participantName,
        participantPhone: record.participantPhone,
        participantExternalId: record.participantExternalId,
        programName: record.programName,
        esoName: record.esoName,
        consentFormType: record.consentFormType,
        implementingOrganization: record.implementingOrganization,
        dataCollectorOrganization: record.dataCollectorOrganization,
        dataCollectorContact: record.dataCollectorContact,
        privacyOrganization: record.privacyOrganization,
        privacyPolicyUrl: record.privacyPolicyUrl,
        withdrawalContact: record.withdrawalContact,
        dataSharingOrganization: record.dataSharingOrganization,
        consentDecision: record.consentDecision,
        serviceRequired: record.serviceRequired,
        authorizedPartners: record.authorizedPartners,
        dataShared: record.dataShared,
        informationUnderstood: record.informationUnderstood,
        signingMethod: record.signingMethod,
        signatureFile: record.signatureFile,
        signatureFileKey: record.signatureFileKey,
        interpreterUsed: record.interpreterUsed,
        interpreterName: record.interpreterName,
        interpreterOrganization: record.interpreterOrganization,
        interpreterLanguage: record.interpreterLanguage,
        interpreterSignatureFile: record.interpreterSignatureFile,
        interpreterSignatureFileKey: record.interpreterSignatureFileKey,
        collectorName: record.collectorName,
        collectorId: null,
        consentDate: new Date(record.consentDate),
        consentFormVersion: record.consentFormVersion,
        pdfFile: record.pdfFile,
        pdfFileKey: record.pdfFileKey,
        pdfGeneratedAt: record.pdfGeneratedAt ? new Date(record.pdfGeneratedAt) : null,
        pdfStatus: record.pdfStatus,
        status: record.status,
        createdAt: new Date(record.createdAt),
      },
    });
    return toRecord(saved);
  }

  const records = await getConsents();
  records.push(record);
  if (hasBlobStorage()) {
    await writeBlobConsents(records);
    return record;
  }

  await writeFile(dataFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return record;
}

export async function saveConsents(records: ConsentRecord[]) {
  if (hasBlobStorage()) {
    await writeBlobConsents(records);
    return;
  }

  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function nextReference() {
  const year = new Date().getFullYear();

  if (usePrisma) {
    const count = await prisma().consent.count({
      where: {
        referenceNumber: {
          startsWith: `CNS-${year}-`,
        },
      },
    });
    return `CNS-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  const records = await getConsents();
  return `CNS-${year}-${String(records.length + 1).padStart(5, "0")}`;
}

export async function getConsentById(id: string) {
  if (usePrisma) {
    const record = await prisma().consent.findFirst({
      where: {
        OR: [{ id }, { referenceNumber: id }],
      },
    });
    return record ? toRecord(record) : undefined;
  }

  const records = await getConsents();
  return records.find((record) => record.id === id || record.referenceNumber === id);
}

export async function getExistingParticipantConsent(participantId: string, consentFormType: string) {
  if (!participantId.trim()) return undefined;

  if (usePrisma) {
    const record = await prisma().consent.findFirst({
      where: {
        participantId,
        consentFormType,
        status: { in: ["locked", "finalized"] },
      },
      orderBy: { createdAt: "desc" },
    });
    return record ? toRecord(record) : undefined;
  }

  const records = await getConsents();
  return records
    .filter(
      (record) =>
        record.participantId === participantId &&
        record.consentFormType === consentFormType &&
        ["locked", "finalized"].includes(record.status),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}
