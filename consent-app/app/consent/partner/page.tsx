import { ConsentForm } from "@/components/ConsentForm";

export default function PartnerConsentPage() {
  return (
    <main className="standalone-form-page">
      <ConsentForm initialFormType="third-party-data-sharing" lockFormType />
    </main>
  );
}
