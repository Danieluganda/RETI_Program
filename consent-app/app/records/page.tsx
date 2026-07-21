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
        <a className="button secondary" href="/api/reports">
          Download CSV
        </a>
      </header>
      <section className="panel">
        <RecordsTable records={records.slice().reverse()} />
      </section>
    </AppShell>
  );
}
