import JSZip from "jszip";
import { getConsents, type ConsentRecord } from "@/lib/db";
import { readPrivateFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeFolderName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "consent";
}

function inDateRange(record: ConsentRecord, from?: string, to?: string) {
  const date = record.consentDate;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function exportFileName(from?: string, to?: string) {
  if (from && to) return `10x-consent-pdfs-${from}_to_${to}.zip`;
  if (from) return `10x-consent-pdfs-from-${from}.zip`;
  if (to) return `10x-consent-pdfs-to-${to}.zip`;
  return "10x-consent-pdfs-all.zip";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const records = (await getConsents()).filter((record) => record.pdfFileKey && inDateRange(record, from, to));
  const zip = new JSZip();
  const summaryHeaders = [
    "referenceNumber",
    "participantName",
    "esoName",
    "consentFormType",
    "consentDecision",
    "consentDate",
    "collectorName",
    "pdfFileKey",
    "exportStatus",
  ];
  const summaryRows: string[] = [];

  for (const record of records) {
    const folder = zip.folder(safeFolderName(record.referenceNumber));
    let exportStatus = "included";

    try {
      const pdf = await readPrivateFile(record.pdfFileKey);
      folder?.file("consent-form.pdf", pdf);
      folder?.file(
        "metadata.json",
        JSON.stringify(
          {
            referenceNumber: record.referenceNumber,
            participantName: record.participantName,
            esoName: record.esoName,
            consentFormType: record.consentFormType,
            consentDecision: record.consentDecision,
            consentDate: record.consentDate,
            collectorName: record.collectorName,
            pdfFileKey: record.pdfFileKey,
          },
          null,
          2,
        ),
      );
    } catch {
      exportStatus = "pdf-missing";
    }

    summaryRows.push(
      [
        record.referenceNumber,
        record.participantName,
        record.esoName,
        record.consentFormType,
        record.consentDecision,
        record.consentDate,
        record.collectorName,
        record.pdfFileKey,
        exportStatus,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  zip.file("export-summary.csv", [summaryHeaders.join(","), ...summaryRows].join("\n"));
  const body = Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFileName(from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
}
