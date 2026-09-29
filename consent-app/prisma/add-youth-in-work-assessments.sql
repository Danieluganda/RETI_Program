CREATE TABLE IF NOT EXISTS "YouthInWorkAssessment" (
  "id" TEXT PRIMARY KEY,
  "participantId" TEXT NOT NULL,
  "participantName" TEXT NOT NULL,
  "participantPhone" TEXT,
  "participantEmail" TEXT,
  "participantExternalId" TEXT,
  "esoName" TEXT,
  "district" TEXT,
  "region" TEXT,
  "businessName" TEXT,
  "businessSector" TEXT,
  "employmentStatus" TEXT,
  "youthInWorkStatus" TEXT NOT NULL,
  "trainingInterest" TEXT,
  "supportNeeded" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "assessorName" TEXT,
  "assessmentDate" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'youth_in_work_tool',
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "YouthInWorkAssessment_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "YouthInWorkAssessment_participantId_key"
  ON "YouthInWorkAssessment"("participantId");

CREATE INDEX IF NOT EXISTS "YouthInWorkAssessment_participantName_idx"
  ON "YouthInWorkAssessment"("participantName");

CREATE INDEX IF NOT EXISTS "YouthInWorkAssessment_participantPhone_idx"
  ON "YouthInWorkAssessment"("participantPhone");

CREATE INDEX IF NOT EXISTS "YouthInWorkAssessment_participantEmail_idx"
  ON "YouthInWorkAssessment"("participantEmail");

CREATE INDEX IF NOT EXISTS "YouthInWorkAssessment_esoName_idx"
  ON "YouthInWorkAssessment"("esoName");

CREATE INDEX IF NOT EXISTS "YouthInWorkAssessment_assessmentDate_idx"
  ON "YouthInWorkAssessment"("assessmentDate");
