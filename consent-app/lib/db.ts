import { Prisma, PrismaClient, type Consent } from "@prisma/client";
import { randomUUID } from "node:crypto";
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
  participantEmail?: string;
  participantExternalId: string;
  programName: string;
  esoName: string;
  consentFormType: string;
  poaSample?: string;
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
  geoCaptureStatus: string;
  geoLatitude: number | null;
  geoLongitude: number | null;
  geoAccuracy: number | null;
  geoCapturedAt: string;
  geoCaptureError: string;
  auditFormOpenedAt: string;
  auditSubmittedAt: string;
  auditServerReceivedAt: string;
  auditTimezone: string;
  auditLanguage: string;
  auditUserAgent: string;
  auditIpAddress: string;
  auditScreenWidth: number | null;
  auditScreenHeight: number | null;
  auditSubmissionPath: string;
  auditRequestHost: string;
  verificationStatus: string;
  riskScore: number;
  riskFlags: string[];
  verificationCheckedAt: string;
  pdfFile: string;
  pdfFileKey: string;
  pdfGeneratedAt: string;
  pdfStatus: string;
  supersededById?: string;
  status: "locked";
  createdAt: string;
};

export type ConsentRedoRequestRecord = {
  id: string;
  participantId: string;
  participantName: string;
  participantExternalId: string;
  esoId: string;
  esoName: string;
  consentFormType: string;
  existingConsentId: string;
  existingReferenceNumber: string;
  reason: string;
  requestedByName: string;
  requestedByContact: string;
  status: "pending" | "approved" | "rejected" | "used";
  reviewedBy: string;
  reviewedAt: string;
  reviewNote: string;
  usedByConsentId: string;
  usedAt: string;
  createdAt: string;
  updatedAt: string;
};

const dataDir = join(process.cwd(), "private");
const dataFile = join(dataDir, "consents.json");
const redoRequestsFile = join(dataDir, "consent-redo-requests.json");
const blobDataFile = "metadata/consents.json";
const blobRedoRequestsFile = "metadata/consent-redo-requests.json";
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
    geoCaptureStatus: "not_requested",
    geoLatitude: null,
    geoLongitude: null,
    geoAccuracy: null,
    geoCapturedAt: "",
    geoCaptureError: "",
    auditFormOpenedAt: "",
    auditSubmittedAt: "",
    auditServerReceivedAt: "",
    auditTimezone: "",
    auditLanguage: "",
    auditUserAgent: "",
    auditIpAddress: "",
    auditScreenWidth: null,
    auditScreenHeight: null,
    auditSubmissionPath: "",
    auditRequestHost: "",
    verificationStatus: "auto_verified",
    riskScore: 0,
    riskFlags: [],
    verificationCheckedAt: "",
    pdfFile: record.pdfFile || "",
    pdfFileKey: record.pdfFileKey || "",
    pdfGeneratedAt: formatDateTime(record.pdfGeneratedAt),
    pdfStatus: record.pdfStatus || (record.pdfFileKey ? "generated" : ""),
    supersededById: "",
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

async function ensureRedoRequestsFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(redoRequestsFile, "utf8");
  } catch {
    await writeFile(redoRequestsFile, "[]\n", "utf8");
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

async function readRedoRequestsFallback() {
  if (hasBlobStorage()) {
    try {
      const file = await readTextBlob(blobRedoRequestsFile);
      return JSON.parse(file || "[]") as ConsentRedoRequestRecord[];
    } catch {
      await writeTextBlob(blobRedoRequestsFile, "[]\n");
      return [];
    }
  }

  await ensureRedoRequestsFile();
  const file = await readFile(redoRequestsFile, "utf8");
  return JSON.parse(file || "[]") as ConsentRedoRequestRecord[];
}

async function writeRedoRequestsFallback(records: ConsentRedoRequestRecord[]) {
  if (hasBlobStorage()) {
    await writeTextBlob(blobRedoRequestsFile, `${JSON.stringify(records, null, 2)}\n`);
    return;
  }

  await ensureRedoRequestsFile();
  await writeFile(redoRequestsFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
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
    geoCaptureStatus: record.geoCaptureStatus || "not_requested",
    geoLatitude: record.geoLatitude,
    geoLongitude: record.geoLongitude,
    geoAccuracy: record.geoAccuracy,
    geoCapturedAt: record.geoCapturedAt?.toISOString() || "",
    geoCaptureError: record.geoCaptureError || "",
    auditFormOpenedAt: record.auditFormOpenedAt?.toISOString() || "",
    auditSubmittedAt: record.auditSubmittedAt?.toISOString() || "",
    auditServerReceivedAt: record.auditServerReceivedAt?.toISOString() || "",
    auditTimezone: record.auditTimezone || "",
    auditLanguage: record.auditLanguage || "",
    auditUserAgent: record.auditUserAgent || "",
    auditIpAddress: record.auditIpAddress || "",
    auditScreenWidth: record.auditScreenWidth,
    auditScreenHeight: record.auditScreenHeight,
    auditSubmissionPath: record.auditSubmissionPath || "",
    auditRequestHost: record.auditRequestHost || "",
    verificationStatus: record.verificationStatus || "auto_verified",
    riskScore: record.riskScore || 0,
    riskFlags: record.riskFlags || [],
    verificationCheckedAt: record.verificationCheckedAt?.toISOString() || "",
    pdfFile: record.pdfFile || "",
    pdfFileKey: record.pdfFileKey || "",
    pdfGeneratedAt: record.pdfGeneratedAt?.toISOString() || "",
    pdfStatus: record.pdfStatus || "",
    supersededById: record.supersededById || "",
    status: "locked",
    createdAt: record.createdAt.toISOString(),
  };
}

function toRedoRequestRecord(record: {
  id: string;
  participantId: string | null;
  participantName: string;
  participantExternalId: string | null;
  esoId: string | null;
  esoName: string | null;
  consentFormType: string;
  existingConsentId: string | null;
  existingReferenceNumber: string | null;
  reason: string;
  requestedByName: string | null;
  requestedByContact: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  reviewNote: string | null;
  usedByConsentId: string | null;
  usedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): ConsentRedoRequestRecord {
  const status = ["pending", "approved", "rejected", "used"].includes(record.status) ? record.status : "pending";

  return {
    id: record.id,
    participantId: record.participantId || "",
    participantName: record.participantName,
    participantExternalId: record.participantExternalId || "",
    esoId: record.esoId || "",
    esoName: record.esoName || "",
    consentFormType: record.consentFormType,
    existingConsentId: record.existingConsentId || "",
    existingReferenceNumber: record.existingReferenceNumber || "",
    reason: record.reason,
    requestedByName: record.requestedByName || "",
    requestedByContact: record.requestedByContact || "",
    status: status as ConsentRedoRequestRecord["status"],
    reviewedBy: record.reviewedBy || "",
    reviewedAt: formatDateTime(record.reviewedAt),
    reviewNote: record.reviewNote || "",
    usedByConsentId: record.usedByConsentId || "",
    usedAt: formatDateTime(record.usedAt),
    createdAt: formatDateTime(record.createdAt),
    updatedAt: formatDateTime(record.updatedAt),
  };
}

export function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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
        geoCaptureStatus: record.geoCaptureStatus,
        geoLatitude: record.geoLatitude,
        geoLongitude: record.geoLongitude,
        geoAccuracy: record.geoAccuracy,
        geoCapturedAt: record.geoCapturedAt ? new Date(record.geoCapturedAt) : null,
        geoCaptureError: record.geoCaptureError,
        auditFormOpenedAt: record.auditFormOpenedAt ? new Date(record.auditFormOpenedAt) : null,
        auditSubmittedAt: record.auditSubmittedAt ? new Date(record.auditSubmittedAt) : null,
        auditServerReceivedAt: record.auditServerReceivedAt ? new Date(record.auditServerReceivedAt) : null,
        auditTimezone: record.auditTimezone,
        auditLanguage: record.auditLanguage,
        auditUserAgent: record.auditUserAgent,
        auditIpAddress: record.auditIpAddress,
        auditScreenWidth: record.auditScreenWidth,
        auditScreenHeight: record.auditScreenHeight,
        auditSubmissionPath: record.auditSubmissionPath,
        auditRequestHost: record.auditRequestHost,
        verificationStatus: record.verificationStatus,
        riskScore: record.riskScore,
        riskFlags: record.riskFlags,
        verificationCheckedAt: record.verificationCheckedAt ? new Date(record.verificationCheckedAt) : null,
        pdfFile: record.pdfFile,
        pdfFileKey: record.pdfFileKey,
        pdfGeneratedAt: record.pdfGeneratedAt ? new Date(record.pdfGeneratedAt) : null,
        pdfStatus: record.pdfStatus,
        supersededById: record.supersededById || null,
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

export async function getExistingParticipantConsent(
  participantId: string,
  consentFormType: string,
  identity: { participantExternalId?: string; participantName?: string; esoName?: string; esoId?: string } = {},
) {
  if (!participantId.trim()) return undefined;
  const participantExternalId = identity.participantExternalId?.trim() || "";
  const participantName = identity.participantName?.trim() || "";
  const esoName = identity.esoName?.trim() || "";
  const esoId = identity.esoId?.trim() || "";
  const identityMatches: Prisma.ConsentWhereInput[] = [{ participantId }];

  if (participantExternalId) {
    identityMatches.push({ participantExternalId });
  }

  if (participantName && (esoName || esoId)) {
    identityMatches.push({
      participantName: { equals: participantName, mode: "insensitive" },
      OR: [{ esoName }, ...(esoId ? [{ esoId }] : [])],
    });
  }

  if (usePrisma) {
    const record = await prisma().consent.findFirst({
      where: {
        OR: identityMatches,
        consentFormType,
        status: { in: ["locked", "finalized"] },
        supersededById: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return record ? toRecord(record) : undefined;
  }

  const records = await getConsents();
  return records
    .filter(
      (record) =>
        (record.participantId === participantId ||
          Boolean(participantExternalId && record.participantExternalId === participantExternalId) ||
          Boolean(
            participantName &&
              record.participantName.toLowerCase() === participantName.toLowerCase() &&
              ((esoName && record.esoName === esoName) || (esoId && record.esoId === esoId)),
          )) &&
        record.consentFormType === consentFormType &&
        ["locked", "finalized"].includes(record.status) &&
        !record.supersededById,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export async function getApprovedRedoRequest(participantId: string, consentFormType: string) {
  if (!participantId.trim()) return undefined;

  if (usePrisma) {
    const record = await prisma().consentRedoRequest.findFirst({
      where: {
        participantId,
        consentFormType,
        status: "approved",
        usedByConsentId: null,
      },
      orderBy: { reviewedAt: "desc" },
    });
    return record ? toRedoRequestRecord(record) : undefined;
  }

  const requests = await readRedoRequestsFallback();
  return requests
    .filter((request) => request.participantId === participantId && request.consentFormType === consentFormType && request.status === "approved" && !request.usedByConsentId)
    .sort((a, b) => new Date(b.reviewedAt || b.createdAt).getTime() - new Date(a.reviewedAt || a.createdAt).getTime())[0];
}

export async function getOpenRedoRequest(participantId: string, consentFormType: string) {
  if (!participantId.trim()) return undefined;

  if (usePrisma) {
    const record = await prisma().consentRedoRequest.findFirst({
      where: {
        participantId,
        consentFormType,
        status: { in: ["pending", "approved"] },
        usedByConsentId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return record ? toRedoRequestRecord(record) : undefined;
  }

  const requests = await readRedoRequestsFallback();
  return requests
    .filter((request) => request.participantId === participantId && request.consentFormType === consentFormType && ["pending", "approved"].includes(request.status) && !request.usedByConsentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export async function createConsentRedoRequest(
  request: Omit<ConsentRedoRequestRecord, "id" | "status" | "reviewedBy" | "reviewedAt" | "reviewNote" | "usedByConsentId" | "usedAt" | "createdAt" | "updatedAt">,
) {
  const existing = await getOpenRedoRequest(request.participantId, request.consentFormType);
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: ConsentRedoRequestRecord = {
    ...request,
    id: randomUUID(),
    status: "pending",
    reviewedBy: "",
    reviewedAt: "",
    reviewNote: "",
    usedByConsentId: "",
    usedAt: "",
    createdAt: now,
    updatedAt: now,
  };

  if (usePrisma) {
    const saved = await prisma().consentRedoRequest.create({
      data: {
        id: record.id,
        participantId: record.participantId || null,
        participantName: record.participantName,
        participantExternalId: record.participantExternalId || null,
        esoId: record.esoId || null,
        esoName: record.esoName || null,
        consentFormType: record.consentFormType,
        existingConsentId: record.existingConsentId || null,
        existingReferenceNumber: record.existingReferenceNumber || null,
        reason: record.reason,
        requestedByName: record.requestedByName || null,
        requestedByContact: record.requestedByContact || null,
        status: record.status,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      },
    });
    return toRedoRequestRecord(saved);
  }

  const requests = await readRedoRequestsFallback();
  requests.push(record);
  await writeRedoRequestsFallback(requests);
  return record;
}

export async function getConsentRedoRequests(status?: string) {
  if (usePrisma) {
    const records = await prisma().consentRedoRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return records.map(toRedoRequestRecord);
  }

  const requests = await readRedoRequestsFallback();
  return requests
    .filter((request) => (status ? request.status === status : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function reviewConsentRedoRequest(id: string, status: "approved" | "rejected", reviewer: string, reviewNote = "") {
  const now = new Date().toISOString();

  if (usePrisma) {
    const saved = await prisma().consentRedoRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: reviewer,
        reviewedAt: new Date(now),
        reviewNote,
      },
    });
    return toRedoRequestRecord(saved);
  }

  const requests = await readRedoRequestsFallback();
  const index = requests.findIndex((request) => request.id === id);
  if (index === -1) return undefined;
  requests[index] = {
    ...requests[index],
    status,
    reviewedBy: reviewer,
    reviewedAt: now,
    reviewNote,
    updatedAt: now,
  };
  await writeRedoRequestsFallback(requests);
  return requests[index];
}

export async function markRedoRequestUsedAndSupersedeExisting(
  request: ConsentRedoRequestRecord,
  newConsentId: string,
  existingConsentId: string,
) {
  const now = new Date().toISOString();

  if (usePrisma) {
    await prisma().$transaction([
      prisma().consentRedoRequest.update({
        where: { id: request.id },
        data: {
          status: "used",
          usedByConsentId: newConsentId,
          usedAt: new Date(now),
        },
      }),
      prisma().consent.update({
        where: { id: existingConsentId },
        data: { supersededById: newConsentId },
      }),
    ]);
    return;
  }

  const [requests, consents] = await Promise.all([readRedoRequestsFallback(), getConsents()]);
  const requestIndex = requests.findIndex((item) => item.id === request.id);
  if (requestIndex >= 0) {
    requests[requestIndex] = {
      ...requests[requestIndex],
      status: "used",
      usedByConsentId: newConsentId,
      usedAt: now,
      updatedAt: now,
    };
  }
  const consentIndex = consents.findIndex((consent) => consent.id === existingConsentId);
  if (consentIndex >= 0) {
    consents[consentIndex] = { ...consents[consentIndex], supersededById: newConsentId };
  }
  await Promise.all([writeRedoRequestsFallback(requests), saveConsents(consents)]);
}

export async function markConsentSuperseded(consentId: string, supersededById: string) {
  if (usePrisma) {
    await prisma().consent.update({
      where: { id: consentId },
      data: { supersededById: supersededById || null },
    });
    return;
  }

  const consents = await getConsents();
  const consentIndex = consents.findIndex((consent) => consent.id === consentId);
  if (consentIndex >= 0) {
    consents[consentIndex] = { ...consents[consentIndex], supersededById };
    await saveConsents(consents);
  }
}
