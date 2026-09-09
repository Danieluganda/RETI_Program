const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function duplicateSummary(label, whereSql) {
  const byParticipant = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS groups, COALESCE(sum(count), 0)::int AS rows
    FROM (
      SELECT COALESCE(NULLIF("participantExternalId", ''), "participantId") AS key, "consentFormType", count(*)::int AS count
      FROM "Consent"
      WHERE ${whereSql}
        AND COALESCE(NULLIF("participantExternalId", ''), "participantId") IS NOT NULL
      GROUP BY COALESCE(NULLIF("participantExternalId", ''), "participantId"), "consentFormType"
      HAVING count(*) > 1
    ) duplicate_groups
  `);

  const byPhone = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS groups, COALESCE(sum(count), 0)::int AS rows
    FROM (
      SELECT regexp_replace(COALESCE("participantPhone", ''), '[^0-9]', '', 'g') AS phone, "consentFormType", count(*)::int AS count
      FROM "Consent"
      WHERE ${whereSql}
        AND regexp_replace(COALESCE("participantPhone", ''), '[^0-9]', '', 'g') <> ''
      GROUP BY regexp_replace(COALESCE("participantPhone", ''), '[^0-9]', '', 'g'), "consentFormType"
      HAVING count(*) > 1
    ) duplicate_groups
  `);

  const byNameEso = await prisma.$queryRawUnsafe(`
    SELECT count(*)::int AS groups, COALESCE(sum(count), 0)::int AS rows
    FROM (
      SELECT lower(trim(COALESCE("participantName", ''))) AS name, COALESCE("esoName", '') AS eso, "consentFormType", count(*)::int AS count
      FROM "Consent"
      WHERE ${whereSql}
        AND trim(COALESCE("participantName", '')) <> ''
      GROUP BY lower(trim(COALESCE("participantName", ''))), COALESCE("esoName", ''), "consentFormType"
      HAVING count(*) > 1
    ) duplicate_groups
  `);

  return {
    label,
    byParticipant: byParticipant[0],
    byPhone: byPhone[0],
    byNameEso: byNameEso[0],
  };
}

async function main() {
  const summaries = await Promise.all([
    duplicateSummary("all locked/finalized rows", `"status" IN ('locked', 'finalized')`),
    duplicateSummary(
      "current export rows",
      `"status" IN ('locked', 'finalized') AND "supersededById" IS NULL AND "consentDecision" IN ('consented', 'declined')`,
    ),
    duplicateSummary(
      "rows created on 2026-09-08 UTC",
      `"createdAt" >= '2026-09-08'::date AND "createdAt" < '2026-09-09'::date`,
    ),
  ]);

  const latestExamples = await prisma.$queryRaw`
    SELECT
      COALESCE(NULLIF("participantExternalId", ''), "participantId") AS "participantKey",
      "consentFormType",
      count(*)::int AS count,
      array_agg("referenceNumber" ORDER BY "createdAt" DESC, "referenceNumber" DESC) AS references
    FROM "Consent"
    WHERE "status" IN ('locked', 'finalized')
      AND COALESCE(NULLIF("participantExternalId", ''), "participantId") IS NOT NULL
    GROUP BY COALESCE(NULLIF("participantExternalId", ''), "participantId"), "consentFormType"
    HAVING count(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summaries, latestExamples }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
