import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { formatConsentDateTime } from "@/lib/dateTime";
import { getConsentRedoRequests, reviewConsentRedoRequest } from "@/lib/db";

export const dynamic = "force-dynamic";

async function reviewRequest(formData: FormData) {
  "use server";

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const reviewNote = String(formData.get("reviewNote") || "");

  if (status === "approved" || status === "rejected") {
    await reviewConsentRedoRequest(id, status, "System Administrator", reviewNote);
  }

  revalidatePath("/redo-requests");
}

export default async function RedoRequestsPage() {
  const requests = await getConsentRedoRequests();
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <AppShell>
      <div className="records-page">
        <header className="topbar records-topbar">
          <div>
            <h1>Redo Requests</h1>
            <p>Admin approval queue for participants who need to correct an already submitted consent.</p>
          </div>
        </header>

        <section className="cards dashboard-cards">
          <div className="metric">
            <span>Pending approval</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="metric">
            <span>Total requests</span>
            <strong>{requests.length}</strong>
          </div>
        </section>

        <section className="panel records-table-panel">
          <div className="section-heading">
            <div>
              <h2>Approval Queue</h2>
              <p>Approved requests allow one corrected submission. The previous consent is retained and marked superseded.</p>
            </div>
          </div>
          {requests.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>ESO</th>
                    <th>Existing consent</th>
                    <th>Reason</th>
                    <th>Requested by</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.participantName}</strong>
                        <div className="muted-text">{request.participantExternalId || request.participantId || "N/A"}</div>
                      </td>
                      <td>{request.esoName || "N/A"}</td>
                      <td>{request.existingReferenceNumber || "N/A"}</td>
                      <td>{request.reason}</td>
                      <td>
                        {request.requestedByName || "N/A"}
                        {request.requestedByContact ? <div className="muted-text">{request.requestedByContact}</div> : null}
                      </td>
                      <td>
                        <span className={request.status === "rejected" ? "tag warning-tag" : "tag"}>{request.status}</span>
                      </td>
                      <td>{formatConsentDateTime(request.createdAt)}</td>
                      <td>
                        {request.status === "pending" ? (
                          <form className="inline-review-form" action={reviewRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <input name="reviewNote" placeholder="Review note" />
                            <button className="secondary compact-button" name="status" value="rejected" type="submit">
                              Reject
                            </button>
                            <button className="primary compact-button" name="status" value="approved" type="submit">
                              Approve
                            </button>
                          </form>
                        ) : (
                          <span className="muted-text">
                            {request.reviewedAt ? formatConsentDateTime(request.reviewedAt) : "No review date"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No redo requests yet.</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
