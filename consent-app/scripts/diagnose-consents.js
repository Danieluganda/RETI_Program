const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const esoCounts = await prisma.$queryRaw`
    SELECT
      COALESCE("esoName", 'Unassigned') AS "esoName",
      count(*)::int AS "totalRecords",
      count(*) FILTER (
        WHERE "status" IN ('locked', 'finalized')
          AND "supersededById" IS NULL
          AND "consentDecision" IN ('consented', 'declined')
      )::int AS "currentRecords",
      max("createdAt") AS "latestCreatedAt"
    FROM "Consent"
    GROUP BY COALESCE("esoName", 'Unassigned')
    ORDER BY "esoName" ASC
  `;

  const stanbicRecent = await prisma.$queryRaw`
    SELECT
      "referenceNumber",
      "participantName",
      "participantExternalId",
      "consentFormType",
      "consentDecision",
      "createdAt",
      "supersededById"
    FROM "Consent"
    WHERE "esoName" ILIKE '%stanbic%'
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;

  const duplicateGroups = await prisma.$queryRaw`
    SELECT
      "participantId",
      "participantExternalId",
      "participantName",
      "esoName",
      "consentFormType",
      count(*)::int AS count,
      array_agg("referenceNumber" ORDER BY "createdAt" DESC, "referenceNumber" DESC) AS references
    FROM "Consent"
    WHERE "status" IN ('locked', 'finalized')
      AND "supersededById" IS NULL
      AND (
        "participantId" IS NOT NULL
        OR COALESCE("participantExternalId", '') <> ''
      )
    GROUP BY
      "participantId",
      "participantExternalId",
      "participantName",
      "esoName",
      "consentFormType"
    HAVING count(*) > 1
    ORDER BY count DESC, "esoName" ASC
    LIMIT 50
  `;

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        esoCounts,
        stanbicRecent,
        duplicateGroups,
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
