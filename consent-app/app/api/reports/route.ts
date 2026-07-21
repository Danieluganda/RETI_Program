import { getConsents } from "@/lib/db";

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
    "pdfFileKey",
    "pdfGeneratedAt",
    "status",
    "createdAt",
  ];
  const rows = records.map((record) => headers.map((header) => cell(record[header as keyof typeof record])).join(","));
  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="10x-consents.csv"',
    },
  });
}
