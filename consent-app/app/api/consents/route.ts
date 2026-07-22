import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getConsents, nextReference, saveConsent, type ConsentRecord } from "@/lib/db";
import { generateConsentPdf } from "@/lib/pdf";
import { fileUrl, saveDataImage } from "@/lib/storage";
import { validateConsentPayload, type ConsentPayload } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await getConsents());
}

export async function POST(request: Request) {
  const body = (await request.json()) as ConsentPayload;
  const errors = validateConsentPayload(body);

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
  }

  const referenceNumber = await nextReference();
  const signatureFileKey = await saveDataImage(referenceNumber, "participant-signature", body.participantSignatureData);
  const interpreterSignatureFileKey = await saveDataImage(
    referenceNumber,
    "interpreter-signature",
    body.interpreterSignatureData,
  );
  const signingMethod = signatureFileKey ? body.signingMethod || "drawn" : "typed-name";

  const record: ConsentRecord = {
    id: randomUUID(),
    referenceNumber,
    participantName: body.participantName?.trim() || "",
    participantPhone: body.participantPhone || "",
    participantExternalId: body.participantExternalId || "",
    programName: body.programName || "10X: Enabling growth of MSMEs through the digital economy",
    esoName: body.esoName || "",
    consentFormType: body.consentFormType || "sample-space",
    implementingOrganization: body.implementingOrganization || "Outbox (U) Limited",
    dataCollectorOrganization:
      body.dataCollectorOrganization ||
      "Outbox (U) Limited of 3rd Floor, Kalooli Lwanga Tower, Plot 83 & 85, Ntinda Road Kampala, Uganda",
    dataCollectorContact: body.dataCollectorContact || "+256 (0) 392 000 152; info@outbox.africa",
    privacyOrganization: body.privacyOrganization || "Outbox (U) Limited",
    privacyPolicyUrl: body.privacyPolicyUrl || "zulu@outbox.africa; +256 (0) 392 000 152",
    withdrawalContact: body.withdrawalContact || "zulu@outbox.africa; +256 (0) 392 000 152",
    dataSharingOrganization: body.dataSharingOrganization || "Outbox",
    consentDecision: body.consentDecision || "consented",
    serviceRequired: body.serviceRequired || "",
    authorizedPartners: Array.isArray(body.authorizedPartners) ? body.authorizedPartners : [],
    dataShared: Array.isArray(body.dataShared) ? body.dataShared : [],
    informationUnderstood: Boolean(body.informationUnderstood),
    signingMethod,
    signatureFile: fileUrl(signatureFileKey),
    signatureFileKey,
    interpreterUsed: Boolean(body.interpreterUsed),
    interpreterName: body.interpreterName || "",
    interpreterOrganization: body.interpreterOrganization || "",
    interpreterLanguage: body.interpreterLanguage || "",
    interpreterSignatureFile: fileUrl(interpreterSignatureFileKey),
    interpreterSignatureFileKey,
    collectorName: body.collectorName || "Demo Collector",
    collectorId: "usr-demo",
    consentDate: body.consentDate || new Date().toISOString().slice(0, 10),
    consentFormVersion: body.consentFormVersion || "10X-SAMPLE-v1",
    pdfFile: "",
    pdfFileKey: "",
    pdfGeneratedAt: "",
    status: "locked",
    createdAt: new Date().toISOString(),
  };

  const pdf = await generateConsentPdf(record);
  record.pdfFile = pdf.pdfFile;
  record.pdfFileKey = pdf.pdfFileKey;
  record.pdfGeneratedAt = pdf.pdfGeneratedAt;

  const savedRecord = await saveConsent(record);

  return NextResponse.json(savedRecord, { status: 201 });
}
