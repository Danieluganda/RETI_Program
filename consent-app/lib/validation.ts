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
  participantId?: string;
  programName?: string;
  esoId?: string;
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
  geoCaptureStatus?: "not_requested" | "capturing" | "captured" | "denied" | "unavailable" | "error";
  geoLatitude?: number | string | null;
  geoLongitude?: number | string | null;
  geoAccuracy?: number | string | null;
  geoCapturedAt?: string;
  geoCaptureError?: string;
  auditFormOpenedAt?: string;
  auditSubmittedAt?: string;
  auditTimezone?: string;
  auditLanguage?: string;
  auditUserAgent?: string;
  auditScreenWidth?: number | string | null;
  auditScreenHeight?: number | string | null;
  auditSubmissionPath?: string;
};

export function validateConsentPayload(payload: ConsentPayload) {
  const errors: string[] = [];

  if (!payload.participantId?.trim()) errors.push("Participant selection is required.");
  if (!payload.esoId?.trim()) errors.push("Entrepreneurship Support Organization is required.");
  if (!payload.consentDecision || !["consented", "declined"].includes(payload.consentDecision)) {
    errors.push("Consent decision must be consented or declined.");
  }
  if (!payload.informationUnderstood) errors.push("Understanding confirmation is required.");

  return errors;
}
