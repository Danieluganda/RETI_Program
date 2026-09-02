import type { ConsentRecord } from "./db";
import type { ParticipantSummary } from "./participants";

export function isPoaSampleSource(source = "") {
  const normalized = source.toLowerCase();
  return (
    normalized.includes("poa") ||
    normalized.includes("busala") ||
    normalized === "enterprise" ||
    normalized === "yiw" ||
    normalized.includes("weo")
  );
}

export function poaSampleStatus(record: ConsentRecord, participant?: ParticipantSummary) {
  if (participant?.source) return isPoaSampleSource(participant.source) ? "Yes" : "No";
  if (isPoaSampleSource(record.consentFormType) || isPoaSampleSource(record.serviceRequired)) return "Yes";
  return "Unknown";
}

export function participantForConsent(
  record: ConsentRecord,
  participantsById: Map<string, ParticipantSummary>,
  participantsByExternalId: Map<string, ParticipantSummary>,
) {
  return participantsById.get(record.participantId) || participantsByExternalId.get(record.participantExternalId);
}

export function withConsentParticipantContext(records: ConsentRecord[], participants: ParticipantSummary[]) {
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const participantsByExternalId = new Map(participants.map((participant) => [participant.externalId, participant]));

  return records.map((record) => {
    const participant = participantForConsent(record, participantsById, participantsByExternalId);
    return {
      ...record,
      participantEmail: participant?.email || "",
      poaSample: poaSampleStatus(record, participant),
    };
  });
}
