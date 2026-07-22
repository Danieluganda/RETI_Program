import { ConsentForm } from "@/components/ConsentForm";

export default async function NewConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ esoId?: string; participantId?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="standalone-form-page">
      <ConsentForm initialEsoId={params.esoId || ""} initialParticipantId={params.participantId || ""} />
    </main>
  );
}
