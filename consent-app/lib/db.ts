import { PrismaClient, type Consent } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ConsentRecord = {
  id: string;
  referenceNumber: string;
  participantName: string;
  participantPhone: string;
  programName: string;
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
  status: "locked";
  createdAt: string;
};

const dataDir = join(process.cwd(), "private");
const dataFile = join(dataDir, "consents.json");
const usePrisma = Boolean(process.env.DATABASE_URL?.startsWith("postgres"));

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function prisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

function toRecord(record: Consent): ConsentRecord {
  return {
    id: record.id,
    referenceNumber: record.referenceNumber,
    participantName: record.participantName,
    participantPhone: record.participantPhone || "",
    programName: record.programName,
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
    status: "locked",
    createdAt: record.createdAt.toISOString(),
  };
}

export async function getConsents() {
  if (usePrisma) {
    const records = await prisma().consent.findMany({ orderBy: { createdAt: "desc" } });
    return records.map(toRecord);
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
        participantName: record.participantName,
        participantPhone: record.participantPhone,
        programName: record.programName,
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
        status: record.status,
        createdAt: new Date(record.createdAt),
      },
    });
    return toRecord(saved);
  }

  const records = await getConsents();
  records.push(record);
  await writeFile(dataFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return record;
}

export async function saveConsents(records: ConsentRecord[]) {
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
