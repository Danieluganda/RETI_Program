export default async function ConsentThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <main className="standalone-form-page">
      <section className="thank-you-panel">
        <p className="eyebrow">10X Program</p>
        <h1>Thank you</h1>
        <p>Your consent form has been submitted successfully.</p>
        {ref && (
          <p className="reference-note">
            Reference number: <strong>{ref}</strong>
          </p>
        )}
      </section>
    </main>
  );
}
