"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConsentRecord } from "@/lib/db";
import { applyRecordFilters } from "@/lib/analytics";

type Props = {
  records: ConsentRecord[];
  compact?: boolean;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function downloadHref(record: ConsentRecord) {
  return record.pdfFile || `/api/uploads?key=${encodeURIComponent(record.pdfFileKey)}`;
}

export function RecordsTable({ records, compact = false }: Props) {
  const [search, setSearch] = useState("");
  const [eso, setEso] = useState("");
  const [decision, setDecision] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(compact ? 5 : 10);

  const esos = useMemo(() => unique(records.map((record) => record.esoName)), [records]);
  const filtered = useMemo(
    () => applyRecordFilters(records, { search, eso, decision, status, from, to }),
    [records, search, eso, decision, status, from, to],
  );
  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const visible = compact ? filtered.slice(0, pageSize) : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetPage() {
    setPage(1);
  }

  if (!records.length) {
    return <div className="empty-state">No consent records yet.</div>;
  }

  return (
    <div className="records-browser">
      {!compact && (
        <div className="filters-grid">
          <div>
            <label htmlFor="recordSearch">Search</label>
            <input
              id="recordSearch"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Reference, participant, ESO, collector"
            />
          </div>
          <div>
            <label htmlFor="esoFilter">ESO filter</label>
            <select
              id="esoFilter"
              value={eso}
              onChange={(event) => {
                setEso(event.target.value);
                resetPage();
              }}
            >
              <option value="">All ESOs</option>
              {esos.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="decisionFilter">Decision filter</label>
            <select
              id="decisionFilter"
              value={decision}
              onChange={(event) => {
                setDecision(event.target.value);
                resetPage();
              }}
            >
              <option value="">All decisions</option>
              <option value="consented">Consented</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div>
            <label htmlFor="statusFilter">Status filter</label>
            <select
              id="statusFilter"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                resetPage();
              }}
            >
              <option value="">All statuses</option>
              <option value="locked">Locked</option>
              <option value="finalized">Finalized</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div>
            <label htmlFor="fromFilter">From</label>
            <input id="fromFilter" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <label htmlFor="toFilter">To</label>
            <input id="toFilter" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      )}

      {!filtered.length ? (
        <div className="empty-state">No records match the selected filters.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Consent Reference</th>
                <th>Participant Reference</th>
                <th>Participant</th>
                <th>ESO</th>
                <th>Decision</th>
                <th>Status</th>
                <th>Collected By</th>
                <th>Consent Date</th>
                <th>PDF</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.id}>
                  <td>{record.referenceNumber}</td>
                  <td>{record.participantExternalId || record.participantId || "N/A"}</td>
                  <td>{record.participantName}</td>
                  <td>{record.esoName || "Unassigned"}</td>
                  <td>
                    <span className="tag">{record.consentDecision || "pending"}</span>
                  </td>
                  <td>{record.status || "locked"}</td>
                  <td>{record.collectorName || "N/A"}</td>
                  <td>{record.consentDate}</td>
                  <td>
                    {record.pdfFile || record.pdfFileKey ? (
                      <a href={downloadHref(record)} target="_blank" rel="noreferrer">
                        Open PDF
                      </a>
                    ) : (
                      <span className="muted-text">Pending</span>
                    )}
                  </td>
                  <td>
                    <div className="action-menu">
                      <Link href={`/consent/${record.id}`}>View consent</Link>
                      <Link href={`/participants/pending?participant=${encodeURIComponent(record.participantExternalId || record.participantId)}`}>
                        View participant
                      </Link>
                      {record.pdfFile || record.pdfFileKey ? (
                        <>
                          <a href={downloadHref(record)} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                          <a href={downloadHref(record)} download>
                            Download PDF
                          </a>
                        </>
                      ) : null}
                      <Link href={`/records?audit=${encodeURIComponent(record.id)}`}>View audit history</Link>
                      <span className="muted-text">Replace consent: admin only</span>
                      <span className="muted-text">Withdraw consent: authorized only</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!compact && (
        <div className="pagination-bar">
          <span>
            Showing {visible.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <label>
            Rows per page
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="pagination-actions">
            <button className="secondary" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button className="secondary" type="button" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
