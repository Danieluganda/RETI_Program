export type ConsentPayload = {
  consentFormType?: "sample-space" | "third-party-data-sharing";
  consentFormVersion?: string;
  implementingOrganization?: string;
  dataCollectorOrganization?: string;
  dataCollectorContact?: string;
  privacyOrganization?: string;
  privacyPolicyUrl?: string;
  withdrawalContact?: string;
  dataSharingOrganization?: string;
  participantName?: string;
  participantPhone?: string;
  participantExternalId?: string;
  programName?: string;
  esoName?: string;
  consentDecision?: "consented" | "declined";
  serviceRequired?: string;
  authorizedPartners?: string[];
  dataShared?: string[];
  informationUnderstood?: boolean;
  signingMethod?: string;
  participantSignatureData?: string;
  interpreterUsed?: boolean;
  interpreterName?: string;
  interpreterOrganization?: string;
  interpreterLanguage?: string;
  interpreterSignatureData?: string;
  collectorName?: string;
  consentDate?: string;
};

export function validateConsentPayload(payload: ConsentPayload) {
  const errors: string[] = [];

  if (!payload.participantName?.trim()) errors.push("Participant name is required.");
  if (!payload.consentDecision) errors.push("Consent decision is required.");
  if (!payload.informationUnderstood) errors.push("Understanding confirmation is required.");

  return errors;
}
