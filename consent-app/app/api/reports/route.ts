import { getConsents } from "@/lib/db";
import { consentRecordedAt, formatConsentDateTime } from "@/lib/dateTime";
import { poaSampleStatus } from "@/lib/poaSample";
import { getActiveParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";

function cell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "consents";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eso = url.searchParams.get("eso") || "";
  const [allRecords, participants] = await Promise.all([getConsents(), getActiveParticipants()]);
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const participantsByExternalId = new Map(participants.map((participant) => [participant.externalId, participant]));
  const records = allRecords.filter((record) => {
    const participant = participantsById.get(record.participantId) || participantsByExternalId.get(record.participantExternalId);
    return !eso || record.esoName === eso || participant?.esoName === eso;
  });
  const headers = [
    "referenceNumber",
    "participantExternalId",
    "participantName",
    "participantPhone",
    "participantEmail",
    "poaSample",
    "programName",
    "esoName",
    "consentFormType",
    "consentFormVersion",
    "consentDecision",
    "serviceRequired",
    "authorizedPartners",
    "dataShared",
    "signingMethod",
    "interpreterUsed",
    "interpreterName",
    "interpreterLanguage",
    "collectorName",
    "consentDate",
    "consentDateTime",
    "geoCaptureStatus",
    "geoLatitude",
    "geoLongitude",
    "geoAccuracy",
    "geoCapturedAt",
    "geoCaptureError",
    "auditFormOpenedAt",
    "auditSubmittedAt",
    "auditServerReceivedAt",
    "auditTimezone",
    "auditLanguage",
    "auditUserAgent",
    "auditIpAddress",
    "auditScreenWidth",
    "auditScreenHeight",
    "auditSubmissionPath",
    "auditRequestHost",
    "verificationStatus",
    "riskScore",
    "riskFlags",
    "verificationCheckedAt",
    "pdfFileKey",
    "pdfGeneratedAt",
    "status",
    "createdAt",
  ];
  const rows = records.map((record) =>
    headers
      .map((header) => {
        if (header === "consentDateTime") return cell(formatConsentDateTime(consentRecordedAt(record)));
        const participant = participantsById.get(record.participantId) || participantsByExternalId.get(record.participantExternalId);
        if (header === "participantEmail") return cell(participant?.email || "");
        if (header === "poaSample") return cell(poaSampleStatus(record, participant));
        return cell(record[header as keyof typeof record]);
      })
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${eso ? `10x-consents-${safeFilePart(eso)}.csv` : "10x-consents.csv"}"`,
    },
  });
}
