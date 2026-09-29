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
  "foundationCourseStatus" TEXT,
  "foundationLearning" TEXT,
  "incomeFromProgram" TEXT,
  "incomeAmount" INTEGER,
  "workImproved" TEXT,
  "workImprovementDescription" TEXT,
  "improvementOutcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "youthInWorkStatus" TEXT NOT NULL,
  "trainingInterest" TEXT,
  "supportNeeded" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "assessorName" TEXT,
  "gpsLatitude" DOUBLE PRECISION,
  "gpsLongitude" DOUBLE PRECISION,
  "gpsAccuracy" DOUBLE PRECISION,
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

ALTER TABLE "YouthInWorkAssessment"
  ADD COLUMN IF NOT EXISTS "foundationCourseStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "foundationLearning" TEXT,
  ADD COLUMN IF NOT EXISTS "incomeFromProgram" TEXT,
  ADD COLUMN IF NOT EXISTS "incomeAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "workImproved" TEXT,
  ADD COLUMN IF NOT EXISTS "workImprovementDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "improvementOutcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "gpsLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gpsLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gpsAccuracy" DOUBLE PRECISION;
