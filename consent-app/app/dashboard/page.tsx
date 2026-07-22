import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActionRequired, ConsentProgressByEso, DashboardSummaryCards } from "@/components/DashboardV2";
import { RecordsTable } from "@/components/RecordsTable";
import { getConsents } from "@/lib/db";
import { getActiveParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [records, participants] = await Promise.all([getConsents(), getActiveParticipants()]);

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
        <Link className="button secondary" href="/records">
          Bulk export
        </Link>
      </header>
      <DashboardSummaryCards participants={participants} records={records} />
      <ActionRequired participants={participants} records={records} />
      <ConsentProgressByEso participants={participants} records={records} />
      <section className="panel">
        <h2>Recent records</h2>
        <RecordsTable records={records} compact />
      </section>
    </AppShell>
  );
}
