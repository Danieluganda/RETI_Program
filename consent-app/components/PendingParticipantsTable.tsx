"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { applyParticipantFilters, maskPhone } from "@/lib/analytics";
import type { ParticipantSummary } from "@/lib/participants";

export function PendingParticipantsTable({
  participants,
  initialEso = "",
}: {
  participants: ParticipantSummary[];
  initialEso?: string;
}) {
  const [search, setSearch] = useState("");
  const [eso, setEso] = useState(initialEso);
  const [district, setDistrict] = useState("");
  const [region, setRegion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const esos = useMemo(() => [...new Set(participants.map((item) => item.esoName).filter(Boolean))].sort(), [participants]);
  const districts = useMemo(() => [...new Set(participants.map((item) => item.district).filter(Boolean))].sort(), [participants]);
  const regions = useMemo(() => [...new Set(participants.map((item) => item.region).filter(Boolean))].sort(), [participants]);
  const filtered = useMemo(() => {
    return applyParticipantFilters(participants, { search, eso, from, to }).filter((participant) => {
      if (district && participant.district !== district) return false;
      if (region && participant.region !== region) return false;
      return true;
    });
  }, [participants, search, eso, district, region, from, to]);
  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="records-browser">
      <div className="filters-grid">
        <div>
          <label htmlFor="participantFollowupSearch">Search</label>
          <input
            id="participantFollowupSearch"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Reference, name, phone, ESO"
          />
        </div>
        <div>
          <label htmlFor="pendingEso">ESO</label>
          <select id="pendingEso" value={eso} onChange={(event) => setEso(event.target.value)}>
            <option value="">All ESOs</option>
            {esos.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pendingDistrict">District</label>
          <select id="pendingDistrict" value={district} onChange={(event) => setDistrict(event.target.value)}>
            <option value="">All districts</option>
            {districts.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pendingRegion">Region</label>
          <select id="pendingRegion" value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="">All regions</option>
            {regions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pendingFrom">Date imported from</label>
          <input id="pendingFrom" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div>
          <label htmlFor="pendingTo">Date imported to</label>
          <input id="pendingTo" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      {!filtered.length ? (
        <div className="empty-state">No pending participants match the selected filters.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Participant Reference</th>
                <th>Participant name</th>
                <th>Masked phone</th>
                <th>ESO</th>
                <th>District</th>
                <th>Region</th>
                <th>Date imported</th>
                <th>Consent status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((participant) => (
                <tr key={participant.id}>
                  <td>{participant.externalId || participant.id}</td>
                  <td>{participant.fullName}</td>
                  <td>{maskPhone(participant.phone)}</td>
                  <td>{participant.esoName || "Unassigned"}</td>
                  <td>{participant.district || "N/A"}</td>
                  <td>{participant.region || "N/A"}</td>
                  <td>{participant.createdAt ? participant.createdAt.slice(0, 10) : "N/A"}</td>
                  <td>
                    <span className="tag">pending</span>
                  </td>
                  <td>
                    <div className="action-menu">
                      <Link
                        href={`/consent/new?esoId=${encodeURIComponent(participant.esoId || participant.esoName)}&participantId=${encodeURIComponent(participant.id)}`}
                      >
                        Start consent
                      </Link>
                      <Link href={`/participants/pending?participant=${encodeURIComponent(participant.externalId || participant.id)}`}>
                        View participant
                      </Link>
                      <button
                        className="link-button"
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(participant.externalId || participant.id)}
                      >
                        Copy participant reference
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}
