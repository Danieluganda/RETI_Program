import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getConsentById } from "@/lib/db";
import { consentRecordedAt, formatConsentDateTime } from "@/lib/dateTime";

export default async function ConsentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getConsentById(id);

  if (!record) notFound();

  return (
    <AppShell>
      <header className="topbar">
        <div>
          <h1>{record.referenceNumber}</h1>
          <p>{record.participantName}</p>
        </div>
        <Link className="button secondary" href="/records">
          Back to records
        </Link>
      </header>
      <section className="panel">
        <p>
          <strong>Decision:</strong> {record.consentDecision}
        </p>
        <p>
          <strong>Program:</strong> {record.programName}
        </p>
        <p>
          <strong>Entrepreneur Support Organization (ESO):</strong> {record.esoName || "N/A"}
        </p>
        <p>
          <strong>Consent Date &amp; Time:</strong> {formatConsentDateTime(consentRecordedAt(record))}
        </p>
        <p>
          <strong>Collector:</strong> {record.collectorName}
        </p>
        <p>
          <strong>Status:</strong> {record.status}
        </p>
        <p>
          <strong>Automated verification:</strong> {record.verificationStatus || "auto_verified"}
        </p>
        <p>
          <strong>Risk score:</strong> {record.riskScore || 0}
        </p>
        <p>
          <strong>Risk flags:</strong> {record.riskFlags.length ? record.riskFlags.join(", ") : "None"}
        </p>
        <p>
          <strong>Verification checked at:</strong> {record.verificationCheckedAt || "N/A"}
        </p>
        <p>
          <strong>Consent form version:</strong> {record.consentFormVersion}
        </p>
        <p>
          <strong>Consent form type:</strong> {record.consentFormType}
        </p>
        {record.consentFormType === "sample-space" && (
          <>
            <p>
              <strong>GPS status:</strong> {record.geoCaptureStatus || "not_requested"}
            </p>
            {record.geoCaptureStatus === "captured" && (
              <>
                <p>
                  <strong>GPS coordinates:</strong> {record.geoLatitude}, {record.geoLongitude}
                </p>
                <p>
                  <strong>GPS accuracy:</strong> {record.geoAccuracy === null ? "N/A" : `${Math.round(record.geoAccuracy)}m`}
                </p>
                <p>
                  <strong>GPS captured at:</strong> {record.geoCapturedAt || "N/A"}
                </p>
              </>
            )}
          </>
        )}
        {record.consentFormType === "third-party-data-sharing" && (
          <>
            <p>
              <strong>Service required:</strong> {record.serviceRequired}
            </p>
            <p>
              <strong>Authorized partners:</strong> {record.authorizedPartners.join(", ") || "N/A"}
            </p>
            <p>
              <strong>Data shared:</strong> {record.dataShared.join(", ") || "N/A"}
            </p>
          </>
        )}
        <p>
          <strong>PDF generated at:</strong> {record.pdfGeneratedAt}
        </p>
        <p>
          <strong>Submitted at:</strong> {record.auditSubmittedAt || "N/A"}
        </p>
        <p>
          <strong>Server received at:</strong> {record.auditServerReceivedAt || "N/A"}
        </p>
        <p>
          <strong>Digital footprint:</strong>{" "}
          {[record.auditTimezone, record.auditLanguage, record.auditRequestHost].filter(Boolean).join(" | ") || "N/A"}
        </p>
        {record.signatureFile && (
          <p>
            <a href={record.signatureFile} target="_blank" rel="noreferrer">
              View participant signature/thumbprint
            </a>
          </p>
        )}
        {record.interpreterSignatureFile && (
          <p>
            <a href={record.interpreterSignatureFile} target="_blank" rel="noreferrer">
              View interpreter signature
            </a>
          </p>
        )}
        {record.pdfFile && (
          <p>
            <a href={record.pdfFile} target="_blank" rel="noreferrer">
              Open locked consent PDF
            </a>
          </p>
        )}
      </section>
    </AppShell>
  );
}
