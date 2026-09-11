import { AppShell } from "@/components/AppShell";
import { PendingParticipantsTable } from "@/components/PendingParticipantsTable";
import { getPendingParticipants } from "@/lib/analytics";
import { withTimeout } from "@/lib/asyncTimeout";
import { getConsents } from "@/lib/db";
import type { ConsentRecord } from "@/lib/db";
import { getActiveParticipants } from "@/lib/participants";
import type { ParticipantSummary } from "@/lib/participants";

export const dynamic = "force-dynamic";

export default async function PendingParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ eso?: string }>;
}) {
  const params = await searchParams;
  const [recordsResult, participantsResult] = await Promise.allSettled([
    withTimeout(getConsents()),
    withTimeout(getActiveParticipants()),
  ]);
  const records: ConsentRecord[] = recordsResult.status === "fulfilled" ? recordsResult.value : [];
  const participants: ParticipantSummary[] = participantsResult.status === "fulfilled" ? participantsResult.value : [];
  const pending = getPendingParticipants(participants, records, { eso: params.eso || "" });

  return (
    <AppShell>
      <div className="records-page">
        <header className="topbar records-topbar">
          <div>
            <h1>Pending Participants</h1>
            <p>Participants who do not yet have a current finalized consent decision.</p>
          </div>
        </header>
        <section className="panel records-table-panel">
          <PendingParticipantsTable participants={pending} initialEso={params.eso || ""} />
        </section>
      </div>
    </AppShell>
  );
}
