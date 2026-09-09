WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY "participantId", "consentFormType"
      ORDER BY "createdAt" DESC, "referenceNumber" DESC
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY "participantId", "consentFormType"
      ORDER BY "createdAt" DESC, "referenceNumber" DESC
    ) AS rank
  FROM "Consent"
  WHERE "participantId" IS NOT NULL
    AND "status" IN ('locked', 'finalized')
    AND "supersededById" IS NULL
),
updated AS (
  UPDATE "Consent" c
  SET "supersededById" = ranked.keeper_id
  FROM ranked
  WHERE c.id = ranked.id
    AND ranked.rank > 1
  RETURNING c.id, c."referenceNumber", c."participantId", c."consentFormType", c."supersededById"
)
SELECT * FROM updated
ORDER BY "participantId", "consentFormType", "referenceNumber";

CREATE UNIQUE INDEX IF NOT EXISTS "Consent_current_participant_form_unique"
ON "Consent" ("participantId", "consentFormType")
WHERE "participantId" IS NOT NULL
  AND "status" IN ('locked', 'finalized')
  AND "supersededById" IS NULL;
