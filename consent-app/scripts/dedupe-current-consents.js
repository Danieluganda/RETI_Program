const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const duplicates = await prisma.$queryRaw`
    SELECT
      "participantId",
      "consentFormType",
      count(*)::int AS count,
      array_agg("referenceNumber" ORDER BY "createdAt" DESC, "referenceNumber" DESC) AS references
    FROM "Consent"
    WHERE "participantId" IS NOT NULL
      AND "status" IN ('locked', 'finalized')
      AND "supersededById" IS NULL
    GROUP BY "participantId", "consentFormType"
    HAVING count(*) > 1
    ORDER BY count DESC
  `;

  const updated = await prisma.$queryRaw`
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
    )
    UPDATE "Consent" c
    SET "supersededById" = ranked.keeper_id
    FROM ranked
    WHERE c.id = ranked.id
      AND ranked.rank > 1
    RETURNING c.id, c."referenceNumber", c."participantId", c."consentFormType", c."supersededById"
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "Consent_current_participant_form_unique"
    ON "Consent" ("participantId", "consentFormType")
    WHERE "participantId" IS NOT NULL
      AND "status" IN ('locked', 'finalized')
      AND "supersededById" IS NULL
  `;

  console.log(
    JSON.stringify(
      {
        duplicateGroupsFound: duplicates.length,
        supersededRows: updated.length,
        duplicates,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
