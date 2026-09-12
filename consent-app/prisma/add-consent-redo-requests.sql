CREATE TABLE IF NOT EXISTS "ConsentRedoRequest" (
  id TEXT PRIMARY KEY,
  "participantId" TEXT,
  "participantName" TEXT NOT NULL,
  "participantExternalId" TEXT,
  "esoId" TEXT,
  "esoName" TEXT,
  "consentFormType" TEXT NOT NULL,
  "existingConsentId" TEXT,
  "existingReferenceNumber" TEXT,
  reason TEXT NOT NULL,
  "requestedByName" TEXT,
  "requestedByContact" TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "usedByConsentId" TEXT,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ConsentRedoRequest_participantId_idx" ON "ConsentRedoRequest" ("participantId");
CREATE INDEX IF NOT EXISTS "ConsentRedoRequest_consentFormType_idx" ON "ConsentRedoRequest" ("consentFormType");
CREATE INDEX IF NOT EXISTS "ConsentRedoRequest_status_idx" ON "ConsentRedoRequest" (status);
CREATE INDEX IF NOT EXISTS "ConsentRedoRequest_createdAt_idx" ON "ConsentRedoRequest" ("createdAt");
