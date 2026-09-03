import JSZip from "jszip";
import { getConsents, type ConsentRecord } from "@/lib/db";
import { poaSampleStatus } from "@/lib/poaSample";
import { getActiveParticipants } from "@/lib/participants";
import { readPrivateFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const maxPdfExportRecords = Number(process.env.PDF_EXPORT_MAX_RECORDS || 2000);
const defaultPdfBatchSize = Number(process.env.PDF_EXPORT_BATCH_SIZE || 200);

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

function exportFileName(from?: string, to?: string, eso?: string, part?: number) {
  const esoPart = eso ? `${safeFolderName(eso)}-` : "";
  const partSuffix = part ? `-part-${part}` : "";
  if (from && to) return `10x-consent-pdfs-${esoPart}${from}_to_${to}${partSuffix}.zip`;
  if (from) return `10x-consent-pdfs-${esoPart}from-${from}${partSuffix}.zip`;
  if (to) return `10x-consent-pdfs-${esoPart}to-${to}${partSuffix}.zip`;
  return `10x-consent-pdfs-${esoPart}all${partSuffix}.zip`;
}

function positiveInt(value: string | null, fallback = 0) {
  const parsed = Number(value || "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
  const eso = url.searchParams.get("eso") || "";
  const part = positiveInt(url.searchParams.get("part"));
  const batchSize = Math.min(positiveInt(url.searchParams.get("batchSize"), defaultPdfBatchSize), maxPdfExportRecords);

  const [allRecords, participants] = await Promise.all([getConsents(), getActiveParticipants()]);
  const participantsById = new Map(participants.map((participant) => [participant.id, participant]));
  const participantsByExternalId = new Map(participants.map((participant) => [participant.externalId, participant]));
  const matchedRecords = allRecords
    .filter((record) => {
      const participant = participantsById.get(record.participantId) || participantsByExternalId.get(record.participantExternalId);
      return Boolean(record.pdfFileKey && inDateRange(record, from, to) && (!eso || record.esoName === eso || participant?.esoName === eso));
    })
    .sort((a, b) => a.referenceNumber.localeCompare(b.referenceNumber));
  const records = part ? matchedRecords.slice((part - 1) * batchSize, part * batchSize) : matchedRecords;

  if (!records.length && matchedRecords.length) {
    return Response.json(
      { error: "PDF export part is empty", count: matchedRecords.length, part, batchSize },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (records.length > maxPdfExportRecords) {
    return Response.json(
      {
        error: "PDF export range is too large",
        count: records.length,
        max: maxPdfExportRecords,
        message: `This date range contains ${records.length} PDFs. Please export by ESO/date range or use part and batchSize parameters.`,
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
    "participantExternalId",
    "participantName",
    "participantEmail",
    "esoName",
    "poaSample",
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
    const participant = participantsById.get(record.participantId) || participantsByExternalId.get(record.participantExternalId);
    const folder = zip.folder(safeFolderName(record.referenceNumber));
    if (pdf) {
      folder?.file("consent-form.pdf", pdf);
    }

    summaryRows.push(
      [
        record.referenceNumber,
        record.participantExternalId,
        record.participantName,
        participant?.email || "",
        record.esoName,
        poaSampleStatus(record, participant),
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
      "Content-Disposition": `attachment; filename="${exportFileName(from, to, eso, part || undefined)}"`,
      "Cache-Control": "no-store",
      "X-Export-Record-Count": String(records.length),
      "X-Export-Total-Matched-Count": String(matchedRecords.length),
      "X-Export-Part": part ? String(part) : "",
      "X-Export-Batch-Size": part ? String(batchSize) : "",
    },
  });
}
