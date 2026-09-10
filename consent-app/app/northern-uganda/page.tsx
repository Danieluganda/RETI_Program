import { AppShell } from "@/components/AppShell";
import { getConsents } from "@/lib/db";
import { formatConsentDateTime } from "@/lib/dateTime";
import { getNorthernUgandaActivityGate } from "@/lib/northernUgandaActivity";
import type { ConsentRecord } from "@/lib/db";
import { getActiveParticipants } from "@/lib/participants";
import type { ParticipantSummary } from "@/lib/participants";
import Link from "next/link";

export const dynamic = "force-dynamic";

function displayDate(value: string) {
  return value ? formatConsentDateTime(value) : "N/A";
}

function percent(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

function positivePage(value?: string) {
  const page = Number(value || "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export default async function NorthernUgandaActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string; eso?: string; page?: string }>;
}) {
  const params = await searchParams;
  const selectedDistrict = params.district?.trim() || "";
  const selectedEso = params.eso?.trim() || "";
  const requestedPage = positivePage(params.page);
  let consentRecords: ConsentRecord[] = [];
  let participants: ParticipantSummary[] = [];
  let consentMatchStatus = "Live consent records matched";
  let participantMatchStatus = "Main participant dataset checked";

  const [recordsResult, participantsResult] = await Promise.allSettled([getConsents(), getActiveParticipants()]);
  if (recordsResult.status === "fulfilled") {
    consentRecords = recordsResult.value;
  } else {
    consentMatchStatus = "Consent matching unavailable; showing workbook rows only";
  }
  if (participantsResult.status === "fulfilled") {
    participants = participantsResult.value;
  } else {
    participantMatchStatus = "Main participant dataset unavailable";
  }

  const gate = await getNorthernUgandaActivityGate(consentRecords, { district: selectedDistrict, eso: selectedEso, participants });
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(gate.summary.totalRows / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = gate.rows.slice(pageStart, pageStart + pageSize);
  const exportHref = selectedDistrict
    ? `/api/exports/northern-uganda?${new URLSearchParams({ district: selectedDistrict, ...(selectedEso ? { eso: selectedEso } : {}) }).toString()}`
    : selectedEso
      ? `/api/exports/northern-uganda?eso=${encodeURIComponent(selectedEso)}`
      : "/api/exports/northern-uganda";
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (selectedDistrict) query.set("district", selectedDistrict);
    if (selectedEso) query.set("eso", selectedEso);
    if (page > 1) query.set("page", String(page));
    const queryString = query.toString();
    return queryString ? `/northern-uganda?${queryString}` : "/northern-uganda";
  };
  const paginationControls = (
    <div className="pagination-actions activity-pagination">
      {currentPage > 1 ? (
        <>
          <Link className="button secondary compact-button" href={pageHref(1)}>
            First
          </Link>
          <Link className="button secondary compact-button" href={pageHref(currentPage - 1)}>
            Previous
          </Link>
        </>
      ) : null}
      <span>
        Page {currentPage} of {totalPages} - 50 per page
      </span>
      {currentPage < totalPages ? (
        <>
          <Link className="button secondary compact-button" href={pageHref(currentPage + 1)}>
            Next
          </Link>
          <Link className="button secondary compact-button" href={pageHref(totalPages)}>
            Last
          </Link>
        </>
      ) : null}
    </div>
  );

  return (
    <AppShell>
      <div className="activity-page">
        <header className="activity-header">
          <div>
            <h1>Northern Uganda Consent Activity</h1>
            <p>
              Daily follow-up for Finding XY and Challenges Uganda POA participants, checked against the main consent records.
            </p>
          </div>
          <a className="button primary activity-download" href={exportHref} download>
            Download CSV
          </a>
        </header>

        <section className="activity-toolbar" aria-label="Activity filters">
          <form className="activity-filter-form" action="/northern-uganda" method="get">
            <label className="activity-filter-field">
              <span>District</span>
              <select name="district" defaultValue={selectedDistrict}>
                <option value="">All districts</option>
                {gate.districtOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
            <label className="activity-filter-field">
              <span>ESO</span>
              <select name="eso" defaultValue={selectedEso}>
                <option value="">All ESOs</option>
                {gate.esoOptions.map((eso) => (
                  <option key={eso} value={eso}>
                    {eso}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="page" value="1" />
            <button className="button secondary compact-button" type="submit">
              Apply
            </button>
            {selectedDistrict || selectedEso ? (
              <Link className="button secondary compact-button" href="/northern-uganda">
                Clear
              </Link>
            ) : null}
          </form>
          <div className="activity-source-note">
            <strong>{[selectedEso || "All ESOs", selectedDistrict || "All districts"].join(" / ")}</strong>
            <span>
              {gate.summary.totalRows} shown from {gate.summary.sourceRows} workbook rows
            </span>
          </div>
        </section>

        <section className="activity-metrics" aria-label="Northern Uganda activity summary">
          <div className="activity-metric">
            <span>{selectedDistrict ? "Filtered" : "Activity list"}</span>
            <strong>{gate.summary.totalRows}</strong>
          </div>
          {selectedDistrict ? (
            <div className="activity-metric">
              <span>Full source</span>
              <strong>{gate.summary.sourceRows}</strong>
            </div>
          ) : null}
          <div className="activity-metric">
            <span>In main dataset</span>
            <strong>{gate.summary.inMainDataset}</strong>
          </div>
          <div className="activity-metric">
            <span>Finding XY</span>
            <strong>{gate.summary.findingXyRows}</strong>
          </div>
          <div className="activity-metric">
            <span>Challenges</span>
            <strong>{gate.summary.challengesRows}</strong>
          </div>
          <div className="activity-metric">
            <span>Complete</span>
            <strong>{gate.summary.completedConsent}</strong>
          </div>
          <div className="activity-metric warning">
            <span>Pending</span>
            <strong>{gate.summary.pendingConsent}</strong>
          </div>
          <div className="activity-metric">
            <span>Completion</span>
            <strong>{percent(gate.summary.completedConsent + gate.summary.declinedConsent, gate.summary.totalRows)}</strong>
          </div>
        </section>

        <section className="activity-panel">
          <div className="section-heading">
            <div>
              <h2>Daily Update Requirements</h2>
              <p>
                Source: {gate.sourceFile}. Last checked {displayDate(gate.summary.lastCheckedAt)}. {consentMatchStatus}.
                {" "}{participantMatchStatus}.
                {selectedDistrict ? ` District filter: ${selectedDistrict}.` : ""}
                {selectedEso ? ` ESO filter: ${selectedEso}.` : ""}
              </p>
            </div>
          </div>
          <div className="daily-update-grid">
            <div className="daily-update-card">
              <strong>{gate.summary.readyForConsentRoute}</strong>
              <span>Can use the original /consent/new route</span>
            </div>
            <div className="daily-update-card warning">
              <strong>{gate.summary.missingFromMainDataset}</strong>
              <span>Need import/sync into main participant dataset</span>
            </div>
            <div className="daily-update-card">
              <strong>{gate.summary.reached}</strong>
              <span>Reached or already matched to consent</span>
            </div>
            <div className="daily-update-card warning">
              <strong>{gate.summary.pendingConsent}</strong>
              <span>Need field update, consent, or clear reason</span>
            </div>
            <div className="daily-update-card">
              <strong>{gate.summary.youthInWorkCaptured}</strong>
              <span>Youth in Work statuses captured</span>
            </div>
            <div className="daily-update-card warning">
              <strong>{gate.summary.duplicateMainMatches}</strong>
              <span>Duplicate matches found in main dataset</span>
            </div>
          </div>
        </section>

        <section className="activity-panel">
          <div className="section-heading">
            <div>
              <h2>Activity List</h2>
              <p>
                Showing {gate.summary.totalRows ? pageStart + 1 : 0}-{Math.min(pageStart + pageSize, gate.summary.totalRows)} of{" "}
                {gate.summary.totalRows} rows. Download CSV for the full filtered list.
              </p>
            </div>
            {paginationControls}
          </div>
          <div className="table-scroll activity-table">
            <table>
              <thead>
                <tr>
                  <th>Workbook / Sheet</th>
                  <th>Main Dataset</th>
                  <th>Consent Route</th>
                  <th>ESO</th>
                  <th>Participant Ref</th>
                  <th>Participant</th>
                  <th>Phone</th>
                  <th>Possible Correct Phone</th>
                  <th>Phone Check</th>
                  <th>Email</th>
                  <th>Matched By</th>
                  <th>District</th>
                  <th>Reached</th>
                  <th>Consent</th>
                  <th>Reason / Next note</th>
                  <th>Youth in Work</th>
                  <th>Consent ref</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={`${row.sourceFile}-${row.sourceSheet}-${row.sourceRow}-${row.participantReference}`}>
                    <td>
                      <strong>{row.sourceFile.replace(" WEO, YIW & Enterprise POA Data.xlsx", "")}</strong>
                      <div className="muted-text">{row.sourceSheet}</div>
                    </td>
                    <td>
                      <span className="tag">{row.mainParticipantStatus}</span>
                      {row.mainParticipantSource ? <div className="muted-text">{row.mainParticipantSource}</div> : null}
                    </td>
                    <td>{row.consentRouteStatus}</td>
                    <td>{row.esoName}</td>
                    <td>{row.participantReference || "N/A"}</td>
                    <td>{row.participantName || "N/A"}</td>
                    <td>{row.phone || "N/A"}</td>
                    <td>{row.possibleCorrectPhone || "N/A"}</td>
                    <td>
                      <span className={row.phoneQuality === "Valid phone" ? "tag" : "tag warning-tag"}>{row.phoneQuality}</span>
                    </td>
                    <td>{row.email || "N/A"}</td>
                    <td>{row.matchedBy || "N/A"}</td>
                    <td>{row.district || row.region || "N/A"}</td>
                    <td>{row.reachedStatus}</td>
                    <td>
                      <span className="tag">{row.consentStatus}</span>
                    </td>
                    <td>{row.reasonNotCompleted || "N/A"}</td>
                    <td>{row.youthInWorkStatus}</td>
                    <td>{row.consentReference || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginationControls}
        </section>
      </div>
    </AppShell>
  );
}
