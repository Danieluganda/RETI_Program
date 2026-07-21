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

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

export async function getConsents() {
  await ensureDataFile();
  const file = await readFile(dataFile, "utf8");
  return JSON.parse(file || "[]") as ConsentRecord[];
}

export async function saveConsents(records: ConsentRecord[]) {
  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export function nextReference(records: ConsentRecord[]) {
  const year = new Date().getFullYear();
  return `CNS-${year}-${String(records.length + 1).padStart(5, "0")}`;
}

export async function getConsentById(id: string) {
  const records = await getConsents();
  return records.find((record) => record.id === id || record.referenceNumber === id);
}
