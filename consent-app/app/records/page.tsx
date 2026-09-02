import { AppShell } from "@/components/AppShell";
import { RecordsTable } from "@/components/RecordsTable";
import { getConsents } from "@/lib/db";
import { withConsentParticipantContext } from "@/lib/poaSample";
import { getActiveEsos, getActiveParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const [records, esos, participants] = await Promise.all([getConsents(), getActiveEsos(), getActiveParticipants()]);
  const enrichedRecords = withConsentParticipantContext(records, participants);

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
        <p className="field-hint">PDF exports are capped at 200 files per ZIP. Select an ESO or shorter date range for larger batches.</p>
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
      </section>
      <section className="panel">
        <RecordsTable records={enrichedRecords} />
      </section>
    </AppShell>
  );
}
