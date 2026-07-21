import type { ConsentRecord } from "@/lib/db";
import Link from "next/link";

export function RecordsTable({ records }: { records: ConsentRecord[] }) {
  if (!records.length) {
    return <div className="panel">No consent records yet.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Reference</th>
          <th>Participant</th>
          <th>Decision</th>
          <th>Form</th>
          <th>Service</th>
          <th>Status</th>
          <th>Interpreter</th>
          <th>Date</th>
          <th>View</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr key={record.id}>
            <td>{record.referenceNumber}</td>
            <td>{record.participantName}</td>
            <td>
              <span className="tag">{record.consentDecision}</span>
            </td>
            <td>{record.consentFormType === "third-party-data-sharing" ? "Partner sharing" : "Sample space"}</td>
            <td>{record.serviceRequired || "N/A"}</td>
            <td>{record.status || "locked"}</td>
            <td>{record.interpreterUsed ? record.interpreterName || "Yes" : "No"}</td>
            <td>{record.consentDate}</td>
            <td>
              <Link href={`/consent/${record.id}`}>Open</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
