import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getConsents, getExistingParticipantConsent, nextReference, saveConsent, type ConsentRecord } from "@/lib/db";
import { getParticipantForConsent } from "@/lib/participants";
import { generateConsentPdf } from "@/lib/pdf";
import { fileUrl, saveDataImage } from "@/lib/storage";
import { validateConsentPayload, type ConsentPayload } from "@/lib/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const participantId = searchParams.get("participantId") || "";
  const consentFormType = searchParams.get("consentFormType") || "";

  if (participantId && consentFormType) {
    const existingConsent = await getExistingParticipantConsent(participantId, consentFormType);
    return NextResponse.json({
      exists: Boolean(existingConsent),
      consent: existingConsent
        ? {
            id: existingConsent.id,
            referenceNumber: existingConsent.referenceNumber,
            participantName: existingConsent.participantName,
            consentDate: existingConsent.consentDate,
            consentFormType: existingConsent.consentFormType,
          }
        : null,
    });
  }

  return NextResponse.json(await getConsents());
}

export async function POST(request: Request) {
  const body = (await request.json()) as ConsentPayload;
  const errors = validateConsentPayload(body);

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
  }

  const participant = await getParticipantForConsent(body.participantId || "", body.esoId || "");
  if (!participant) {
    return NextResponse.json(
      { error: "Selected participant is invalid, inactive, or does not belong to the selected ESO." },
      { status: 422 },
    );
  }

  const existingConsent = await getExistingParticipantConsent(participant.id, body.consentFormType || "sample-space");
  if (existingConsent) {
    return NextResponse.json(
      {
        error: `Consent for ${participant.fullName} has already been submitted.`,
        existingConsent: {
          id: existingConsent.id,
          referenceNumber: existingConsent.referenceNumber,
          participantName: existingConsent.participantName,
          consentDate: existingConsent.consentDate,
          consentFormType: existingConsent.consentFormType,
        },
      },
      { status: 409 },
    );
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
    participantId: participant.id,
    esoId: participant.esoId || "",
    participantName: participant.fullName,
    participantPhone: participant.phone || "",
    participantExternalId: participant.externalId || "",
    programName: body.programName || "10X: Enabling growth of MSMEs through the digital economy",
    esoName: participant.eso?.name || participant.esoName || "",
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
    consentDecision: body.consentDecision || "",
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
    pdfStatus: "pending",
    status: "locked",
    createdAt: new Date().toISOString(),
  };

  const pdf = await generateConsentPdf(record);
  record.pdfFile = pdf.pdfFile;
  record.pdfFileKey = pdf.pdfFileKey;
  record.pdfGeneratedAt = pdf.pdfGeneratedAt;
  record.pdfStatus = "generated";

  const savedRecord = await saveConsent(record);

  return NextResponse.json(savedRecord, { status: 201 });
}
