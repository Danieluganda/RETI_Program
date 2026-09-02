import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActionRequired, ConsentProgressByEso, DashboardSummaryCards } from "@/components/DashboardV2";
import { RecordsTable } from "@/components/RecordsTable";
import { getConsents } from "@/lib/db";
import { withConsentParticipantContext } from "@/lib/poaSample";
import { getActiveParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ eso?: string }>;
}) {
  const params = await searchParams;
  const selectedEso = params.eso || "";
  const [records, participants] = await Promise.all([getConsents(), getActiveParticipants()]);
  const enrichedRecords = withConsentParticipantContext(records, participants);
  const esos = [...new Set(participants.map((participant) => participant.esoName).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const filteredParticipants = selectedEso
    ? participants.filter((participant) => participant.esoName === selectedEso || participant.esoId === selectedEso)
    : participants;
  const filteredRecords = selectedEso
    ? enrichedRecords.filter((record) => record.esoName === selectedEso || record.esoId === selectedEso)
    : enrichedRecords;

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>{selectedEso ? `${selectedEso} Progress` : "Dashboard"}</h1>
          <p>10X Program consent collection overview by Entrepreneurship Support Organization.</p>
        </div>
        <Link className="button primary" href="/consent/new">
          New Consent
        </Link>
        <Link className="button secondary" href="/records">
          Bulk export
        </Link>
      </header>
      <section className="panel">
        <form className="export-form dashboard-filter-form" action="/dashboard" method="get">
          <div>
            <label htmlFor="dashboardEso">View progress for ESO</label>
            <select id="dashboardEso" name="eso" defaultValue={selectedEso}>
              <option value="">All ESOs</option>
              {esos.map((eso) => (
                <option key={eso} value={eso}>
                  {eso}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" type="submit">
            View Progress
          </button>
          {selectedEso && (
            <Link className="button secondary" href="/dashboard">
              Clear
            </Link>
          )}
        </form>
      </section>
      <DashboardSummaryCards participants={filteredParticipants} records={filteredRecords} />
      <ActionRequired participants={filteredParticipants} records={filteredRecords} />
      <ConsentProgressByEso participants={participants} records={records} />
      <section className="panel">
        <h2>{selectedEso ? `Recent records for ${selectedEso}` : "Recent records"}</h2>
        <RecordsTable records={filteredRecords} compact />
      </section>
    </AppShell>
  );
}
