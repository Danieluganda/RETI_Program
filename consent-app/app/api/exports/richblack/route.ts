import { getConsents } from "@/lib/db";
import { buildRichblackWorkbook, richblackExportFileName } from "@/lib/richblackExport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = {
    eso: url.searchParams.get("eso") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  };

  const records = await getConsents();
  const { workbook, count, totalRows, pendingRows } = await buildRichblackWorkbook(records, filters);

  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${richblackExportFileName(filters)}"`,
      "Cache-Control": "no-store",
      "X-Export-Record-Count": String(count),
      "X-Source-Record-Count": String(totalRows),
      "X-Pending-Consent-Count": String(pendingRows),
    },
  });
}
