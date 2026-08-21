import { buildRichblackWorkbook, getRichblackGate, type RichblackExportFilters } from "./richblackExport";

export { buildRichblackWorkbook as buildUncdfWorkbook, getRichblackGate as getUncdfGate };
export type UncdfExportFilters = RichblackExportFilters;

export function uncdfExportFileName(filters: UncdfExportFilters = {}) {
  const scope = filters.eso ? filters.eso.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") : "all-esos";
  const today = new Date().toISOString().slice(0, 10);
  return `uncdf-consented-participants-${scope}-${today}.xlsx`;
}
