import { AppShell } from "@/components/AppShell";
import { RecordsTable } from "@/components/RecordsTable";
import { withTimeout } from "@/lib/asyncTimeout";
import { getConsents } from "@/lib/db";
import type { ConsentRecord } from "@/lib/db";
import { withConsentParticipantContext } from "@/lib/poaSample";
import { getActiveEsos, getActiveParticipants } from "@/lib/participants";
import type { ParticipantSummary } from "@/lib/participants";

export const dynamic = "force-dynamic";

const pdfBatchSize = 200;

function pdfExportHref(eso: string, part: number) {
  return `/api/exports/pdfs?eso=${encodeURIComponent(eso)}&part=${part}&batchSize=${pdfBatchSize}`;
}

export default async function RecordsPage() {
  const [recordsResult, esosResult, participantsResult] = await Promise.allSettled([
    withTimeout(getConsents()),
    withTimeout(getActiveEsos()),
    withTimeout(getActiveParticipants()),
  ]);
  const records: ConsentRecord[] = recordsResult.status === "fulfilled" ? recordsResult.value : [];
  const esos: Awaited<ReturnType<typeof getActiveEsos>> = esosResult.status === "fulfilled" ? esosResult.value : [];
  const participants: ParticipantSummary[] = participantsResult.status === "fulfilled" ? participantsResult.value : [];
  const enrichedRecords = withConsentParticipantContext(records, participants);
  const pdfCountsByEso = esos
    .map((eso) => ({
      name: eso.name,
      count: enrichedRecords.filter((record) => record.pdfFileKey && (record.esoName === eso.name || record.esoId === eso.id)).length,
    }))
    .filter((eso) => eso.count > pdfBatchSize);

  return (
    <AppShell>
      <div className="records-page">
        <header className="topbar records-topbar">
          <div>
            <h1>Consent Records</h1>
            <p>Submitted participant consent forms, exports, and PDF batches.</p>
          </div>
          <div className="records-actions">
            <a className="button secondary" href="/api/reports" download>
              Download CSV
            </a>
            <a className="button secondary" href="/api/exports/richblack" download>
              Richblack data
            </a>
            <a className="button primary" href="/api/exports/pdfs" download>
              Export PDFs
            </a>
          </div>
        </header>
        <section className="panel export-panel records-export-panel">
          <div className="section-heading">
            <div>
              <h2>Export PDFs by ESO and Consent Date</h2>
              <p>PDF exports are capped at 2,000 files per ZIP. Select an ESO or shorter date range for very large batches.</p>
            </div>
          </div>
          <form className="export-form records-export-form" action="/api/exports/pdfs" method="get">
            <div>
              <label htmlFor="pdfEso">Entrepreneurship Support Organization (ESO)</label>
              <select id="pdfEso" name="eso">
                <option value="">All ESOs</option>
                {esos.map((eso) => (
                  <option key={eso.id || eso.name} value={eso.name}>
                    {eso.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="from">From</label>
              <input id="from" name="from" type="date" />
            </div>
            <div>
              <label htmlFor="to">To</label>
              <input id="to" name="to" type="date" />
            </div>
            <button className="primary" type="submit">
              Export PDFs
            </button>
          </form>
          <form className="export-form secondary-export-form records-csv-form" action="/api/reports" method="get">
            <div>
              <label htmlFor="csvEso">CSV extract for ESO</label>
              <select id="csvEso" name="eso">
                <option value="">All ESOs</option>
                {esos.map((eso) => (
                  <option key={eso.id || eso.name} value={eso.name}>
                    {eso.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="secondary" type="submit">
              Download CSV
            </button>
          </form>
          {pdfCountsByEso.length > 0 && (
            <div className="export-batches">
              <div>
                <h3>Large PDF exports</h3>
                <p className="field-hint">
                  Large ESO exports are split into parts of {pdfBatchSize} PDFs. Download every part listed for that ESO to get the complete export.
                </p>
              </div>
              {pdfCountsByEso.map((eso) => {
                const parts = Math.ceil(eso.count / pdfBatchSize);

                return (
                  <div className="export-batch-row" key={eso.name}>
                    <span>
                      <strong>{eso.name}</strong>
                      <small>
                        {eso.count} PDFs split into {parts} parts
                      </small>
                    </span>
                    <div>
                      {Array.from({ length: parts }, (_, index) => (
                        <a className="button secondary compact-link" href={pdfExportHref(eso.name, index + 1)} download key={`${eso.name}-${index + 1}`}>
                          Part {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="panel records-table-panel">
          <div className="section-heading">
            <div>
              <h2>Record Browser</h2>
              <p>Filter, inspect, and open participant consent records.</p>
            </div>
          </div>
          <RecordsTable records={enrichedRecords} />
        </section>
      </div>
    </AppShell>
  );
}
