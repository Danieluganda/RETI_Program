import { AppShell } from "@/components/AppShell";
import { PendingParticipantsTable } from "@/components/PendingParticipantsTable";
import { getPendingParticipants } from "@/lib/analytics";
import { getConsents } from "@/lib/db";
import { getActiveParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";

export default async function PendingParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ eso?: string }>;
}) {
  const params = await searchParams;
  const [records, participants] = await Promise.all([getConsents(), getActiveParticipants()]);
  const pending = getPendingParticipants(participants, records, { eso: params.eso || "" });

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>Pending Participants</h1>
          <p>Participants who do not yet have a current finalized consent decision.</p>
        </div>
      </header>
      <section className="panel">
        <PendingParticipantsTable participants={pending} initialEso={params.eso || ""} />
      </section>
    </AppShell>
  );
}
