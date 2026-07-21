import Link from "next/link";
import { getConsentById } from "@/lib/db";

export default async function ConsentThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const record = ref ? await getConsentById(ref) : undefined;

  return (
    <main className="standalone-form-page">
      <section className="thank-you-panel">
        <p className="eyebrow">10X Program</p>
        <h1>Thank you</h1>
        <p>Your consent form has been submitted successfully and the record is locked.</p>
        {record ? (
          <>
            <dl className="submission-summary">
              <div>
                <dt>Reference number</dt>
                <dd>{record.referenceNumber}</dd>
              </div>
              <div>
                <dt>Participant</dt>
                <dd>{record.participantName}</dd>
              </div>
              <div>
                <dt>Form</dt>
                <dd>{record.consentFormType === "third-party-data-sharing" ? "Third-party partner data sharing" : "Program participant consent"}</dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd>{record.consentDecision}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{record.status}</dd>
              </div>
              <div>
                <dt>PDF generated</dt>
                <dd>{record.pdfGeneratedAt ? new Date(record.pdfGeneratedAt).toLocaleString("en-UG") : "Pending"}</dd>
              </div>
            </dl>
            <div className="submission-actions">
              {record.pdfFile && (
                <a className="button" href={record.pdfFile} target="_blank" rel="noreferrer">
                  Open signed PDF
                </a>
              )}
              <Link className="button secondary" href={`/consent/${record.referenceNumber}`}>
                View saved data
              </Link>
              {record.signatureFile && (
                <a className="button secondary" href={record.signatureFile} target="_blank" rel="noreferrer">
                  View signature
                </a>
              )}
            </div>
          </>
        ) : (
          ref && (
            <p className="reference-note">
              Reference number: <strong>{ref}</strong>
            </p>
          )
        )}
      </section>
    </main>
  );
}
