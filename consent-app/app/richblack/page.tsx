import { RichblackShell } from "@/components/RichblackShell";
import { getConsents } from "@/lib/db";
import { formatConsentDateTime } from "@/lib/dateTime";
import { getRichblackGate } from "@/lib/richblackExport";

export const dynamic = "force-dynamic";

function displayDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function RichblackPage() {
  const records = await getConsents();
  const gate = await getRichblackGate(records);
  const previewRows = gate.shareableRows.slice(0, 100);

  return (
    <RichblackShell>
      <header className="topbar">
        <div>
          <h1>Richblack Data Gate</h1>
          <p>Device-financing participants available only after signed consent is verified.</p>
        </div>
        <div className="records-actions">
          <a className="button secondary" href="/api/exports/richblack">
            Download consented data
          </a>
        </div>
      </header>

      <section className="cards richblack-cards" aria-label="Richblack sharing summary">
        <div className="metric">
          <span>Device dataset</span>
          <strong>{gate.summary.totalRows}</strong>
        </div>
        <div className="metric">
          <span>Ready to share</span>
          <strong>{gate.summary.shareableRows}</strong>
        </div>
        <div className="metric">
          <span>Pending consent</span>
          <strong>{gate.summary.pendingRows}</strong>
        </div>
        <div className="metric">
          <span>Last checked</span>
          <strong className="compact-metric">{displayDate(gate.summary.exportedAt)}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Consented Participants</h2>
            <p>Only these rows are included in the Richblack export.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ESO</th>
                <th>Name</th>
                <th>MTN</th>
                <th>Airtel</th>
                <th>Business</th>
                <th>Device</th>
                <th>Payment</th>
                <th>Consent ref</th>
                <th>Consent Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.match?.referenceNumber}`}>
                  <td>{row.values.ESO}</td>
                  <td>{row.values.NAME}</td>
                  <td>{row.values.MTN}</td>
                  <td>{row.values.AIRTEL}</td>
                  <td>{row.values["Type of Business"]}</td>
                  <td>{row.values["Type of device needed"]}</td>
                  <td>{row.values["Prefered mode payment"]}</td>
                  <td>{row.match?.referenceNumber}</td>
                  <td>{row.match ? formatConsentDateTime(row.match.recordedAt) : ""}</td>
                </tr>
              ))}
              {!previewRows.length && (
                <tr>
                  <td colSpan={9}>No participants are currently cleared for Richblack sharing.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </RichblackShell>
  );
}
