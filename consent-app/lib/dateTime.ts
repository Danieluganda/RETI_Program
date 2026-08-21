export function consentRecordedAt(record: { auditServerReceivedAt?: string; createdAt?: string; auditSubmittedAt?: string; consentDate: string }) {
  return record.auditServerReceivedAt || record.createdAt || record.auditSubmittedAt || record.consentDate;
}

export function formatConsentDateTime(value: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}
