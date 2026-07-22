import type { ConsentRecord } from "./db";
import type { ParticipantSummary } from "./participants";

export type DashboardFilters = {
  eso?: string;
  decision?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
};

export type CurrentConsent = ConsentRecord & {
  participantKey: string;
};

function consentParticipantKey(record: ConsentRecord) {
  return record.participantId || record.participantExternalId || `${record.esoName}:${record.participantName}`.toLowerCase();
}

function participantKey(participant: ParticipantSummary) {
  return participant.id || participant.externalId || `${participant.esoName}:${participant.fullName}`.toLowerCase();
}

function isSuperseded(record: ConsentRecord) {
  return "supersededById" in record && Boolean((record as ConsentRecord & { supersededById?: string }).supersededById);
}

function isFinalized(record: ConsentRecord) {
  return ["locked", "finalized"].includes(record.status || "");
}

function isCompletedDecision(decision: string) {
  return decision === "consented" || decision === "declined";
}

function compareDateDesc(a: ConsentRecord, b: ConsentRecord) {
  return new Date(b.createdAt || b.consentDate).getTime() - new Date(a.createdAt || a.consentDate).getTime();
}

export function getCurrentConsents(records: ConsentRecord[]) {
  const current = new Map<string, CurrentConsent>();

  records
    .filter((record) => !isSuperseded(record) && isFinalized(record) && isCompletedDecision(record.consentDecision))
    .sort(compareDateDesc)
    .forEach((record) => {
      const key = consentParticipantKey(record);
      if (!current.has(key)) current.set(key, { ...record, participantKey: key });
    });

  return current;
}

export function applyRecordFilters(records: ConsentRecord[], filters: DashboardFilters) {
  const query = (filters.search || "").trim().toLowerCase();
  return records.filter((record) => {
    if (filters.eso && record.esoName !== filters.eso && record.esoId !== filters.eso) return false;
    if (filters.decision && record.consentDecision !== filters.decision) return false;
    if (filters.status && record.status !== filters.status) return false;
    if (filters.from && record.consentDate < filters.from) return false;
    if (filters.to && record.consentDate > filters.to) return false;
    if (
      query &&
      ![
        record.referenceNumber,
        record.participantExternalId,
        record.participantName,
        record.esoName,
        record.collectorName,
        record.status,
        record.consentDecision,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export function applyParticipantFilters(participants: ParticipantSummary[], filters: DashboardFilters) {
  const query = (filters.search || "").trim().toLowerCase();
  return participants.filter((participant) => {
    if (filters.eso && participant.esoName !== filters.eso && participant.esoId !== filters.eso) return false;
    if (filters.from && participant.createdAt.slice(0, 10) < filters.from) return false;
    if (filters.to && participant.createdAt.slice(0, 10) > filters.to) return false;
    if (
      query &&
      ![participant.externalId, participant.fullName, participant.phone, participant.esoName, participant.district, participant.region]
        .join(" ")
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
}

export function getDashboardStats(participants: ParticipantSummary[], records: ConsentRecord[], filters: DashboardFilters = {}) {
  const filteredParticipants = applyParticipantFilters(participants, filters);
  const filteredRecords = applyRecordFilters(records, filters);
  const currentConsents = getCurrentConsents(filteredRecords);
  const participantKeys = new Set(filteredParticipants.map(participantKey));
  const consented = new Set<string>();
  const declined = new Set<string>();

  currentConsents.forEach((record, key) => {
    if (!participantKeys.has(key) && filteredParticipants.length) return;
    if (record.consentDecision === "consented") consented.add(key);
    if (record.consentDecision === "declined") declined.add(key);
  });

  const completed = new Set([...consented, ...declined]);
  const totalParticipants = new Set(filteredParticipants.map(participantKey)).size;
  const pendingConsent = Math.max(totalParticipants - completed.size, 0);
  const coverage = totalParticipants ? (completed.size / totalParticipants) * 100 : 0;

  return {
    totalParticipants,
    consentRecords: filteredRecords.length,
    consented: consented.size,
    declined: declined.size,
    completed: completed.size,
    pendingConsent,
    coverage,
  };
}

export function getEsoProgress(participants: ParticipantSummary[], records: ConsentRecord[]) {
  const currentConsents = getCurrentConsents(records);
  const esoMap = new Map<
    string,
    {
      eso: string;
      totalParticipants: number;
      consented: number;
      declined: number;
      pending: number;
      coverage: number;
      lastConsentDate: string;
    }
  >();

  participants.forEach((participant) => {
    if (!esoMap.has(participant.esoName)) {
      esoMap.set(participant.esoName, {
        eso: participant.esoName,
        totalParticipants: 0,
        consented: 0,
        declined: 0,
        pending: 0,
        coverage: 0,
        lastConsentDate: "",
      });
    }
    esoMap.get(participant.esoName)!.totalParticipants += 1;
  });

  currentConsents.forEach((record) => {
    const eso = record.esoName || "Unassigned";
    if (!esoMap.has(eso)) {
      esoMap.set(eso, { eso, totalParticipants: 0, consented: 0, declined: 0, pending: 0, coverage: 0, lastConsentDate: "" });
    }
    const row = esoMap.get(eso)!;
    if (record.consentDecision === "consented") row.consented += 1;
    if (record.consentDecision === "declined") row.declined += 1;
    if (!row.lastConsentDate || record.consentDate > row.lastConsentDate) row.lastConsentDate = record.consentDate;
  });

  return [...esoMap.values()]
    .map((row) => {
      const completed = row.consented + row.declined;
      return {
        ...row,
        pending: Math.max(row.totalParticipants - completed, 0),
        coverage: row.totalParticipants ? (completed / row.totalParticipants) * 100 : 0,
      };
    })
    .sort((a, b) => a.coverage - b.coverage);
}

export function getPendingParticipants(participants: ParticipantSummary[], records: ConsentRecord[], filters: DashboardFilters = {}) {
  const current = getCurrentConsents(records);
  return applyParticipantFilters(participants, filters).filter((participant) => !current.has(participantKey(participant)));
}

export function getActionRequired(participants: ParticipantSummary[], records: ConsentRecord[]) {
  const current = getCurrentConsents(records);
  const seenCurrent = new Map<string, number>();

  records
    .filter((record) => !isSuperseded(record) && isFinalized(record) && isCompletedDecision(record.consentDecision))
    .forEach((record) => {
      const key = consentParticipantKey(record);
      seenCurrent.set(key, (seenCurrent.get(key) || 0) + 1);
    });

  return {
    pendingParticipants: getPendingParticipants(participants, records).length,
    finalizedWithoutPdf: records.filter((record) => isFinalized(record) && !record.pdfFileKey && !record.pdfFile).length,
    pdfFailures: records.filter((record) => record.pdfStatus === "failed").length,
    duplicateCurrentConsents: [...seenCurrent.values()].filter((count) => count > 1).length,
    participantsWithoutExternalId: participants.filter((participant) => !participant.externalId).length,
    participantsWithoutEso: participants.filter((participant) => !participant.esoName && !participant.esoId).length,
    historicalUnlinkedConsents: records.filter((record) => !record.participantId).length,
    currentConsentCount: current.size,
  };
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone ? "****" : "";
  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
}
