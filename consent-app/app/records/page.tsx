import { AppShell } from "@/components/AppShell";
import { RecordsTable } from "@/components/RecordsTable";
import { getConsents } from "@/lib/db";

export default async function RecordsPage() {
  const records = await getConsents();

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>Consent Records</h1>
          <p>Submitted participant consent forms.</p>
        </div>
        <div className="records-actions">
          <a className="button secondary" href="/api/reports">
            Download CSV
          </a>
          <a className="button primary" href="/api/exports/pdfs">
            Export all PDFs
          </a>
        </div>
      </header>
      <section className="panel export-panel">
        <h2>Export PDFs by Consent Date</h2>
        <form className="export-form" action="/api/exports/pdfs" method="get">
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
      </section>
      <section className="panel">
        <RecordsTable records={records} />
      </section>
    </AppShell>
  );
}
