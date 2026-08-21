import JSZip from "jszip";
import { getConsents, type ConsentRecord } from "@/lib/db";
import { readPrivateFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const maxPdfExportRecords = Number(process.env.PDF_EXPORT_MAX_RECORDS || 200);

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

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const records = (await getConsents()).filter((record) => record.pdfFileKey && inDateRange(record, from, to));

  if (records.length > maxPdfExportRecords) {
    return Response.json(
      {
        error: "PDF export range is too large",
        count: records.length,
        max: maxPdfExportRecords,
        message: `This date range contains ${records.length} PDFs. Please export a smaller date range with ${maxPdfExportRecords} PDFs or fewer.`,
      },
      {
        status: 413,
        headers: {
          "Cache-Control": "no-store",
          "X-Export-Record-Count": String(records.length),
          "X-Export-Max-Record-Count": String(maxPdfExportRecords),
        },
      },
    );
  }

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

  const pdfs = await mapWithConcurrency(records, 12, async (record) => {
    try {
      return { record, pdf: await readPrivateFile(record.pdfFileKey), exportStatus: "included" };
    } catch {
      return { record, pdf: null, exportStatus: "pdf-missing" };
    }
  });

  for (const { record, pdf, exportStatus } of pdfs) {
    const folder = zip.folder(safeFolderName(record.referenceNumber));
    if (pdf) {
      folder?.file("consent-form.pdf", pdf);
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
  const body = Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "STORE" }));

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFileName(from, to)}"`,
      "Cache-Control": "no-store",
      "X-Export-Record-Count": String(records.length),
    },
  });
}
