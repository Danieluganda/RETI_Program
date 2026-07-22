import Link from "next/link";
import { ClosePageButton } from "@/components/ClosePageButton";

export const dynamic = "force-dynamic";

export default async function ConsentThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; type?: string }>;
}) {
  const { type } = await searchParams;
  const nextFormUrl = type === "third-party-data-sharing" ? "/consent/partner" : "/consent/sample";

  return (
    <main className="standalone-form-page">
      <section className="thank-you-panel">
        <p className="eyebrow">10X Program</p>
        <h1>Thank you</h1>
        <p>Your consent form has been submitted successfully.</p>
        <p>You can submit another form or close this page.</p>
        <div className="thank-you-actions">
          <Link className="button primary" href={nextFormUrl}>
            Submit another
          </Link>
          <ClosePageButton />
        </div>
      </section>
    </main>
  );
}
