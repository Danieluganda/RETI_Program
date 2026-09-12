import { NextResponse } from "next/server";
import { createConsentRedoRequest, getExistingParticipantConsent } from "@/lib/db";
import { getParticipantForConsent } from "@/lib/participants";

export async function POST(request: Request) {
  const body = await request.json();
  const participantId = String(body.participantId || "").trim();
  const consentFormType = String(body.consentFormType || "sample-space").trim();
  const reason = String(body.reason || "").trim();

  if (!participantId || !consentFormType || reason.length < 10) {
    return NextResponse.json(
      { error: "Participant, consent form type, and a clear reason are required." },
      { status: 422 },
    );
  }

  const participant = await getParticipantForConsent(participantId, String(body.esoId || body.esoName || ""));
  if (!participant) {
    return NextResponse.json({ error: "Selected participant could not be verified." }, { status: 422 });
  }

  const existingConsent = await getExistingParticipantConsent(participant.id, consentFormType, {
    participantExternalId: participant.externalId || "",
    participantName: participant.fullName,
    esoId: participant.esoId || "",
    esoName: participant.eso?.name || participant.esoName || "",
  });
  if (!existingConsent) {
    return NextResponse.json({ error: "No existing submitted consent was found for this participant." }, { status: 404 });
  }

  const redoRequest = await createConsentRedoRequest({
    participantId: participant.id,
    participantName: participant.fullName,
    participantExternalId: participant.externalId || "",
    esoId: participant.esoId || "",
    esoName: participant.eso?.name || participant.esoName || "",
    consentFormType,
    existingConsentId: existingConsent.id,
    existingReferenceNumber: existingConsent.referenceNumber,
    reason,
    requestedByName: String(body.requestedByName || "").trim(),
    requestedByContact: String(body.requestedByContact || "").trim(),
  });

  return NextResponse.json({ redoRequest }, { status: redoRequest.status === "pending" ? 201 : 200 });
}
