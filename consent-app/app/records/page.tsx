import { AppShell } from "@/components/AppShell";
import { RecordsTable } from "@/components/RecordsTable";
import { getConsents } from "@/lib/db";
import { withConsentParticipantContext } from "@/lib/poaSample";
import { getActiveEsos, getActiveParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";

const pdfBatchSize = 200;

function pdfExportHref(eso: string, part: number) {
  return `/api/exports/pdfs?eso=${encodeURIComponent(eso)}&part=${part}&batchSize=${pdfBatchSize}`;
}

export default async function RecordsPage() {
  const [records, esos, participants] = await Promise.all([getConsents(), getActiveEsos(), getActiveParticipants()]);
  const enrichedRecords = withConsentParticipantContext(records, participants);
  const pdfCountsByEso = esos
    .map((eso) => ({
      name: eso.name,
      count: enrichedRecords.filter((record) => record.pdfFileKey && (record.esoName === eso.name || record.esoId === eso.id)).length,
    }))
    .filter((eso) => eso.count > pdfBatchSize);

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>Consent Records</h1>
          <p>Submitted participant consent forms.</p>
        </div>
        <div className="records-actions">
          <a className="button secondary" href="/api/reports" download>
            Download CSV
          </a>
          <a className="button secondary" href="/api/exports/richblack" download>
            Export Richblack consented data
          </a>
          <a className="button primary" href="/api/exports/pdfs" download>
            Export all PDFs
          </a>
        </div>
      </header>
      <section className="panel export-panel">
        <h2>Export PDFs by ESO and Consent Date</h2>
        <p className="field-hint">PDF exports are capped at 2,000 files per ZIP. Select an ESO or shorter date range for very large batches.</p>
        <form className="export-form" action="/api/exports/pdfs" method="get">
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
        <form className="export-form secondary-export-form" action="/api/reports" method="get">
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
            <h3>Large PDF exports</h3>
            {pdfCountsByEso.map((eso) => {
              const parts = Math.ceil(eso.count / pdfBatchSize);

              return (
                <div className="export-batch-row" key={eso.name}>
                  <span>
                    {eso.name}: {eso.count} PDFs
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
      <section className="panel">
        <RecordsTable records={enrichedRecords} />
      </section>
    </AppShell>
  );
}
