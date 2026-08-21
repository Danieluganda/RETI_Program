ALTER TABLE "Consent" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'auto_verified';
ALTER TABLE "Consent" ADD COLUMN IF NOT EXISTS "riskScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Consent" ADD COLUMN IF NOT EXISTS "riskFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Consent" ADD COLUMN IF NOT EXISTS "verificationCheckedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Consent_verificationStatus_idx" ON "Consent"("verificationStatus");
