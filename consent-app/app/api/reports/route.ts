import { getConsents } from "@/lib/db";
import { consentRecordedAt, formatConsentDateTime } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

function cell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET() {
  const records = await getConsents();
  const headers = [
    "referenceNumber",
    "participantName",
    "participantPhone",
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
        return cell(record[header as keyof typeof record]);
      })
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="10x-consents.csv"',
    },
  });
}
