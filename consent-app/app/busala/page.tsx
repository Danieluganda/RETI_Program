import { BusalaShell } from "@/components/BusalaShell";
import { busalaRowDistrict, busalaRowName, busalaRowPartner, busalaRowPhone, getBusalaGate } from "@/lib/busalaExport";
import { getConsents } from "@/lib/db";
import { formatConsentDateTime } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

function displayDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function BusalaPage() {
  const records = await getConsents();
  const gate = await getBusalaGate(records);
  const previewRows = gate.shareableRows.slice(0, 100);

  return (
    <BusalaShell>
      <header className="topbar">
        <div>
          <h1>Busala Data Gate</h1>
          <p>Sample dataset participants available only after signed consent is verified.</p>
        </div>
        <div className="records-actions">
          <a className="button secondary" href="/api/exports/busala" download>
            Download consented data
          </a>
        </div>
      </header>

      <section className="cards richblack-cards" aria-label="Busala sharing summary">
        <div className="metric">
          <span>Sample dataset</span>
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
            <h2>Dataset Breakdown</h2>
            <p>Pending rows are counted only; their participant details are not shown.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Source rows</th>
                <th>Ready to share</th>
                <th>Pending consent</th>
              </tr>
            </thead>
            <tbody>
              {gate.datasets.map((dataset) => (
                <tr key={dataset.dataset}>
                  <td>{dataset.dataset}</td>
                  <td>{dataset.totalRows}</td>
                  <td>{dataset.shareableRows}</td>
                  <td>{dataset.pendingRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Consented Participants</h2>
            <p>Only these rows are included in the Busala export.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Partner</th>
                <th>Name</th>
                <th>Primary phone</th>
                <th>District/region</th>
                <th>Program</th>
                <th>Consent ref</th>
                <th>Consent Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.dataset}-${row.rowNumber}-${row.match?.referenceNumber}`}>
                  <td>{row.dataset}</td>
                  <td>{busalaRowPartner(row.values)}</td>
                  <td>{busalaRowName(row.values)}</td>
                  <td>{busalaRowPhone(row.values)}</td>
                  <td>{busalaRowDistrict(row.values)}</td>
                  <td>{row.values["Program Name"]}</td>
                  <td>{row.match?.referenceNumber}</td>
                  <td>{row.match ? formatConsentDateTime(row.match.recordedAt) : ""}</td>
                </tr>
              ))}
              {!previewRows.length && (
                <tr>
                  <td colSpan={8}>No participants are currently cleared for Busala sharing.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </BusalaShell>
  );
}
