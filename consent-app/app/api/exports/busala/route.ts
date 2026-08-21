import { buildBusalaExport, busalaExportFileName } from "@/lib/busalaExport";
import { getConsents } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await getConsents();
    const { archive, count, totalRows, pendingRows } = await buildBusalaExport(records);

    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${busalaExportFileName()}"`,
        "Cache-Control": "no-store",
        "X-Export-Record-Count": String(count),
        "X-Source-Record-Count": String(totalRows),
        "X-Pending-Consent-Count": String(pendingRows),
      },
    });
  } catch (error) {
    console.error("Busala export failed", error);
    return Response.json({ error: "Busala export failed" }, { status: 500 });
  }
}
