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
  const dataWarning =
    recordsResult.status === "rejected" || participantsResult.status === "rejected"
      ? "Live participant records are temporarily unavailable from this environment."
      : "";
  const pending = getPendingParticipants(participants, records, { eso: params.eso || "" });

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>Pending Participants</h1>
          <p>Participants who do not yet have a current finalized consent decision.</p>
        </div>
      </header>
      {dataWarning ? <div className="error-state">{dataWarning}</div> : null}
      <section className="panel">
        <PendingParticipantsTable participants={pending} initialEso={params.eso || ""} />
      </section>
    </AppShell>
  );
}
