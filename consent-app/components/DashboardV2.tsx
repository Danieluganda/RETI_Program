import Link from "next/link";
import type { ConsentRecord } from "@/lib/db";
import type { ParticipantSummary } from "@/lib/participants";
import { getActionRequired, getDashboardStats, getEsoProgress } from "@/lib/analytics";
import { formatConsentDateTime } from "@/lib/dateTime";

export function DashboardSummaryCards({
  participants,
  records,
}: {
  participants: ParticipantSummary[];
  records: ConsentRecord[];
}) {
  const stats = getDashboardStats(participants, records);
  const hasConsentRecords = records.length > 0;
  const hasParticipantBaseline = participants.length > 0;
  const cards = [
    ["Total Participants", hasParticipantBaseline ? stats.totalParticipants : hasConsentRecords ? "Not synced" : 0],
    ["Consent Records", stats.consentRecords],
    ["Consented", stats.consented],
    ["Declined", stats.declined],
    ["Pending Consent", hasParticipantBaseline ? stats.pendingConsent : hasConsentRecords ? "N/A" : 0],
    ["Consent Coverage", hasParticipantBaseline ? `${stats.coverage.toFixed(1)}%` : "N/A"],
  ];

  return (
    <section className="cards dashboard-cards">
      {cards.map(([label, value]) => (
        <div className="metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

export function ConsentProgressByEso({
  participants,
  records,
}: {
  participants: ParticipantSummary[];
  records: ConsentRecord[];
}) {
  const rows = getEsoProgress(participants, records);
  const hasParticipantBaseline = participants.length > 0;

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Consent Progress by ESO</h2>
          <p>
            Current finalized consent records by ESO
            {hasParticipantBaseline ? " against the active participant baseline." : ". Participant baseline is not synced yet."}
          </p>
        </div>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ESO</th>
                <th>Total Participants</th>
                <th>Consented</th>
                <th>Declined</th>
                <th>Pending</th>
                <th>Coverage</th>
                <th>Last Consent Date &amp; Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.eso}>
                  <td>
                    <Link href={`/dashboard?eso=${encodeURIComponent(row.eso)}`}>{row.eso || "Unassigned"}</Link>
                  </td>
                  <td>{row.totalParticipants || (row.consented || row.declined ? "Not synced" : 0)}</td>
                  <td>{row.consented}</td>
                  <td>{row.declined}</td>
                  <td>{row.totalParticipants ? row.pending : row.consented || row.declined ? "N/A" : 0}</td>
                  <td>{row.totalParticipants ? `${row.coverage.toFixed(1)}%` : "N/A"}</td>
                  <td>{row.lastConsentAt ? formatConsentDateTime(row.lastConsentAt) : "N/A"}</td>
                  <td>
                    <Link href={row.totalParticipants ? `/participants/pending?eso=${encodeURIComponent(row.eso)}` : `/records?eso=${encodeURIComponent(row.eso)}`}>
                      {row.totalParticipants ? "Open pending" : "Review records"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No ESO progress data yet.</div>
      )}
    </section>
  );
}

export function ActionRequired({
  participants,
  records,
}: {
  participants: ParticipantSummary[];
  records: ConsentRecord[];
}) {
  const issues = getActionRequired(participants, records);
  const hasConsentRecords = records.length > 0;
  const hasParticipantBaseline = participants.length > 0;
  const items = [
    ...(!hasParticipantBaseline && hasConsentRecords
      ? [
          {
            count: records.length,
            text: "consent records exist, but participant baseline is not synced",
            href: "/records",
          },
        ]
      : []),
    {
      count: issues.pendingParticipants,
      text: "participants are pending consent",
      href: "/participants/pending",
    },
    {
      count: issues.finalizedWithoutPdf,
      text: "finalized consents have no PDF",
      href: "/records?pdf=missing",
    },
    {
      count: issues.pdfFailures,
      text: "consent PDF generations failed",
      href: "/records?pdf=failed",
    },
    {
      count: issues.duplicateCurrentConsents,
      text: "possible duplicate consents need review",
      href: "/records?issue=duplicates",
    },
    {
      count: issues.participantsWithoutExternalId,
      text: "participants have no valid external ID",
      href: "/participants/pending?issue=missing-external-id",
    },
    {
      count: issues.participantsWithoutEso,
      text: "participants have no ESO assignment",
      href: "/participants/pending?issue=missing-eso",
    },
    {
      count: issues.historicalUnlinkedConsents,
      text: "historical consent records are not linked to participants",
      href: "/records?issue=unlinked",
    },
  ].filter((item) => item.count > 0);

  return (
    <section className="panel">
      <h2>Action Required</h2>
      {items.length ? (
        <div className="action-list">
          {items.map((item) => (
            <Link className="action-item" href={item.href} key={item.text}>
              <strong>{item.count}</strong>
              <span>{item.text}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="health-state">All clear. No operational consent issues need action.</div>
      )}
    </section>
  );
}
