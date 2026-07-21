import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RecordsTable } from "@/components/RecordsTable";
import { getConsents } from "@/lib/db";

export default async function DashboardPage() {
  const records = await getConsents();
  const consented = records.filter((record) => record.consentDecision === "consented").length;
  const declined = records.filter((record) => record.consentDecision === "declined").length;
  const signedPdfs = records.filter((record) => Boolean(record.pdfFile)).length;

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>Dashboard</h1>
          <p>10X Program consent collection overview.</p>
        </div>
        <Link className="button primary" href="/consent/new">
          New Consent
        </Link>
      </header>
      <section className="cards">
        <div className="metric">
          <span>Total records</span>
          <strong>{records.length}</strong>
        </div>
        <div className="metric">
          <span>Consented</span>
          <strong>{consented}</strong>
        </div>
        <div className="metric">
          <span>Declined</span>
          <strong>{declined}</strong>
        </div>
        <div className="metric">
          <span>Signed PDFs</span>
          <strong>{signedPdfs}</strong>
        </div>
      </section>
      <section className="panel">
        <h2>Recent records</h2>
        <RecordsTable records={records.slice(0, 5)} />
      </section>
    </AppShell>
  );
}
