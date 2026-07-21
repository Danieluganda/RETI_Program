import { ConsentForm } from "@/components/ConsentForm";

export default function SampleSpaceConsentPage() {
  return (
    <main className="standalone-form-page">
      <ConsentForm initialFormType="sample-space" lockFormType />
    </main>
  );
}
